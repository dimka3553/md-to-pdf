/**
 * Short-lived public downloads (PDF and HTML). Local `next dev` writes to
 * disk; Vercel uses a private Blob store. The public URL is `/d/<id>.pdf`
 * or `/d/<id>.html` on this origin.
 */

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { del, get, put } from '@vercel/blob';

export const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const DOWNLOAD_ID_RE = /^[a-f0-9]{32}$/;

const BLOB_PREFIX = 'downloads';
const MAX_LOCAL_FILES = 80;

export function parseDownloadId(raw) {
  const id = String(raw || '').replace(/\.(pdf|html)$/i, '');
  return DOWNLOAD_ID_RE.test(id) ? id : null;
}

export function extensionForMime(mimeType) {
  return mimeType === 'text/html' ? 'html' : 'pdf';
}

export function downloadUrl(origin, id, mimeType = 'application/pdf') {
  return `${String(origin).replace(/\/$/, '')}/d/${id}.${extensionForMime(mimeType)}`;
}

export function contentDisposition(fileName, disposition = 'inline') {
  const ascii = String(fileName || 'document.pdf')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '');
  return `${disposition}; filename="${ascii || 'document.pdf'}"; filename*=UTF-8''${encodeURIComponent(fileName || 'document.pdf')}`;
}

export function blobStoreEnabled() {
  return Boolean(process.env.VERCEL) && Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export function blobConfigured() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export function localDir() {
  return process.env.DOWNLOAD_DIR || join(tmpdir(), 'markdown-studio-downloads');
}

function blobOptions() {
  return { access: 'private' };
}

function ttlSeconds(ttlMs) {
  return Math.max(60, Math.round((ttlMs ?? DOWNLOAD_TTL_MS) / 1000));
}

/**
 * Store a rendered file and return a public download URL.
 * @param {{ body: Buffer, fileName: string, origin: string, mimeType?: string, ttlMs?: number }} input
 */
export async function persistDownload({ body, fileName, origin, mimeType = 'application/pdf', ttlMs = DOWNLOAD_TTL_MS }) {
  if (!Buffer.isBuffer(body) && !(body instanceof Uint8Array)) throw new Error('File body is missing.');
  const bytes = body.length;
  if (!bytes) throw new Error('File body is empty.');

  if (process.env.VERCEL && !blobConfigured()) {
    throw new Error('Download storage is not configured. Connect a private Vercel Blob store to this project.');
  }

  const id = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + ttlMs;
  const ext = extensionForMime(mimeType);
  const meta = { fileName, mimeType, ext, expiresAt, bytes, etag: createHash('sha256').update(body).digest('hex').slice(0, 32) };

  if (blobStoreEnabled()) await putBlob(id, body, meta, ttlMs);
  else await putLocal(id, body, meta);

  return { id, url: downloadUrl(origin, id, mimeType), expiresAt, fileName, bytes, mimeType };
}

/**
 * Load a stored PDF. Returns null when missing or expired (and deletes expired files).
 * `body` is a Buffer (filesystem) or a Web ReadableStream (Blob).
 */
export async function readDownload(id) {
  const parsed = parseDownloadId(id);
  if (!parsed) return null;

  const record = blobStoreEnabled() ? await readBlob(parsed) : await readLocal(parsed);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    await removeDownload(parsed).catch(() => {});
    return null;
  }
  return record;
}

export async function removeDownload(id) {
  const parsed = parseDownloadId(id);
  if (!parsed) return;
  if (blobStoreEnabled()) {
    await del([`${BLOB_PREFIX}/${parsed}.pdf`, `${BLOB_PREFIX}/${parsed}.html`, `${BLOB_PREFIX}/${parsed}.json`]).catch(() => {});
    return;
  }
  const dir = localDir();
  await Promise.all([
    rm(join(dir, `${parsed}.pdf`), { force: true }),
    rm(join(dir, `${parsed}.html`), { force: true }),
    rm(join(dir, `${parsed}.json`), { force: true }),
  ]);
}

async function putBlob(id, body, meta, ttlMs) {
  const cacheControlMaxAge = ttlSeconds(ttlMs);
  const opts = { ...blobOptions(), addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge };
  await put(`${BLOB_PREFIX}/${id}.json`, JSON.stringify(meta), { ...opts, contentType: 'application/json' });
  const ext = meta.ext || extensionForMime(meta.mimeType);
  try {
    await put(`${BLOB_PREFIX}/${id}.${ext}`, body, { ...opts, contentType: meta.mimeType });
  } catch (err) {
    await del(`${BLOB_PREFIX}/${id}.json`).catch(() => {});
    throw err;
  }
}

async function readBlob(id) {
  const metaResult = await get(`${BLOB_PREFIX}/${id}.json`, blobOptions());
  if (!metaResult || metaResult.statusCode !== 200 || !metaResult.stream) return null;
  const meta = JSON.parse(Buffer.from(await new Response(metaResult.stream).arrayBuffer()).toString('utf8'));
  const ext = meta.ext || extensionForMime(meta.mimeType);
  const fileResult = await get(`${BLOB_PREFIX}/${id}.${ext}`, blobOptions());
  if (!fileResult || fileResult.statusCode !== 200 || !fileResult.stream) return null;
  return { ...meta, body: fileResult.stream };
}

async function putLocal(id, body, meta) {
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  await pruneLocal(dir).catch(() => {});
  const ext = meta.ext || extensionForMime(meta.mimeType);
  await writeFile(join(dir, `${id}.json`), JSON.stringify(meta));
  await writeFile(join(dir, `${id}.${ext}`), body);
}

async function readLocal(id) {
  const dir = localDir();
  let raw;
  try {
    raw = await readFile(join(dir, `${id}.json`), 'utf8');
  } catch {
    return null;
  }
  const meta = JSON.parse(raw);
  const ext = meta.ext || extensionForMime(meta.mimeType);
  let body;
  try {
    body = await readFile(join(dir, `${id}.${ext}`));
  } catch {
    return null;
  }
  return { ...meta, body };
}

async function pruneLocal(dir) {
  const names = await readdir(dir).catch(() => []);
  const jsons = names.filter((n) => n.endsWith('.json'));
  const now = Date.now();
  const kept = [];
  for (const name of jsons) {
    const id = name.slice(0, -5);
    try {
      const meta = JSON.parse(await readFile(join(dir, name), 'utf8'));
      if (meta.expiresAt <= now) await removeDownload(id);
      else kept.push({ id, expiresAt: meta.expiresAt });
    } catch {
      await removeDownload(id).catch(() => {});
    }
  }
  kept.sort((a, b) => a.expiresAt - b.expiresAt);
  while (kept.length > MAX_LOCAL_FILES) {
    const extra = kept.shift();
    if (extra) await removeDownload(extra.id).catch(() => {});
  }
}
