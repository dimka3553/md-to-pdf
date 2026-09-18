/**
 * Short-lived private snapshots of Markdown + assets so MCP tools can reuse
 * a documentId instead of resending the full source on every call.
 */

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { del, get, put } from '@vercel/blob';
import {
  blobConfigured,
  blobStoreEnabled,
  DOWNLOAD_ID_RE,
  DOWNLOAD_TTL_MS,
  localDir,
} from './downloads.js';

export const DOCUMENT_ID_RE = DOWNLOAD_ID_RE;
export const DOCUMENT_TTL_MS = DOWNLOAD_TTL_MS;

const BLOB_PREFIX = 'documents';
const MAX_LOCAL_DOCS = 40;

function blobOptions() {
  return { access: 'private' };
}

function ttlSeconds(ttlMs) {
  return Math.max(60, Math.round((ttlMs ?? DOCUMENT_TTL_MS) / 1000));
}

function docsDir() {
  return join(localDir(), 'documents');
}

function newId() {
  return randomBytes(16).toString('hex');
}

/**
 * Store (or refresh) a document snapshot. Returns null when storage is
 * unavailable (e.g. Vercel without a Blob store) so callers can still lint/render.
 * @param {{ markdown: string, assets?: Record<string,string>, settings?: object|null, fileName?: string, id?: string }} input
 */
export async function persistDocument({ markdown, assets = {}, settings = null, fileName = '', id } = {}) {
  const docId = id && DOCUMENT_ID_RE.test(id) ? id : newId();
  const expiresAt = Date.now() + DOCUMENT_TTL_MS;
  const record = {
    markdown,
    assets: assets && typeof assets === 'object' ? assets : {},
    settings: settings && typeof settings === 'object' ? settings : null,
    fileName: typeof fileName === 'string' ? fileName.slice(0, 120) : '',
    expiresAt,
    createdAt: Date.now(),
  };

  if (process.env.VERCEL && !blobConfigured()) return null;

  try {
    if (blobStoreEnabled()) await putBlob(docId, record, DOCUMENT_TTL_MS);
    else await putLocal(docId, record);
  } catch (err) {
    console.error('[documents] persist failed:', err);
    return null;
  }

  return { id: docId, expiresAt };
}

export async function readDocument(id) {
  const parsed = DOCUMENT_ID_RE.test(id) ? id : null;
  if (!parsed) return null;
  const record = blobStoreEnabled() ? await readBlob(parsed) : await readLocal(parsed);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    await removeDocument(parsed).catch(() => {});
    return null;
  }
  return record;
}

export async function removeDocument(id) {
  const parsed = DOCUMENT_ID_RE.test(id) ? id : null;
  if (!parsed) return;
  if (blobStoreEnabled()) {
    await del(`${BLOB_PREFIX}/${parsed}.json`).catch(() => {});
    return;
  }
  await rm(join(docsDir(), `${parsed}.json`), { force: true });
}

async function putBlob(id, record, ttlMs) {
  await put(`${BLOB_PREFIX}/${id}.json`, JSON.stringify(record), {
    ...blobOptions(),
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: ttlSeconds(ttlMs),
    contentType: 'application/json',
  });
}

async function readBlob(id) {
  const result = await get(`${BLOB_PREFIX}/${id}.json`, blobOptions());
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(Buffer.from(await new Response(result.stream).arrayBuffer()).toString('utf8'));
}

async function putLocal(id, record) {
  const dir = docsDir();
  await mkdir(dir, { recursive: true });
  await pruneLocal(dir).catch(() => {});
  await writeFile(join(dir, `${id}.json`), JSON.stringify(record));
}

async function readLocal(id) {
  try {
    return JSON.parse(await readFile(join(docsDir(), `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function pruneLocal(dir) {
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.json'));
  const now = Date.now();
  const kept = [];
  for (const name of names) {
    const id = name.slice(0, -5);
    try {
      const meta = JSON.parse(await readFile(join(dir, name), 'utf8'));
      if (meta.expiresAt <= now) await removeDocument(id);
      else kept.push({ id, expiresAt: meta.expiresAt });
    } catch {
      await removeDocument(id).catch(() => {});
    }
  }
  kept.sort((a, b) => a.expiresAt - b.expiresAt);
  while (kept.length > MAX_LOCAL_DOCS) {
    const extra = kept.shift();
    if (extra) await removeDocument(extra.id).catch(() => {});
  }
}
