import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  contentDisposition,
  downloadUrl,
  parseDownloadId,
  persistDownload,
  readDownload,
  removeDownload,
} from '../src/lib/downloads.js';

const pdfBytes = Buffer.from('%PDF-1.4 test fixture\n%%EOF\n');

async function withDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'md-downloads-'));
  const prevDir = process.env.DOWNLOAD_DIR;
  const prevVercel = process.env.VERCEL;
  process.env.DOWNLOAD_DIR = dir;
  delete process.env.VERCEL;
  try {
    await fn(dir);
  } finally {
    if (prevDir === undefined) delete process.env.DOWNLOAD_DIR;
    else process.env.DOWNLOAD_DIR = prevDir;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    await rm(dir, { recursive: true, force: true });
  }
}

test('parseDownloadId accepts hex ids with or without .pdf', () => {
  const id = 'a'.repeat(32);
  assert.equal(parseDownloadId(id), id);
  assert.equal(parseDownloadId(`${id}.pdf`), id);
  assert.equal(parseDownloadId(`${id}.PDF`), id);
  assert.equal(parseDownloadId('nope'), null);
  assert.equal(parseDownloadId('../etc/passwd'), null);
  assert.equal(parseDownloadId(''), null);
});

test('persistDownload writes a local file and returns a /d URL', async () => {
  await withDir(async () => {
    const saved = await persistDownload({
      body: pdfBytes,
      fileName: 'Offer-of-Engagement.pdf',
      origin: 'https://md.dima.ua',
    });
    assert.match(saved.id, /^[a-f0-9]{32}$/);
    assert.equal(saved.url, downloadUrl('https://md.dima.ua', saved.id));
    assert.equal(saved.url, `https://md.dima.ua/d/${saved.id}.pdf`);
    assert.ok(saved.expiresAt > Date.now());

    const rec = await readDownload(saved.id);
    assert.ok(rec);
    assert.equal(rec.fileName, 'Offer-of-Engagement.pdf');
    assert.equal(rec.mimeType, 'application/pdf');
    assert.ok(Buffer.isBuffer(rec.body));
    assert.equal(Buffer.compare(rec.body, pdfBytes), 0);
  });
});

test('contentDisposition is inline with the file name', () => {
  const header = contentDisposition('Hello.pdf');
  assert.match(header, /^inline;/);
  assert.match(header, /filename="Hello\.pdf"/);
  assert.match(header, /filename\*=UTF-8''Hello\.pdf/);
});

test('expired and unknown ids are gone', async () => {
  await withDir(async () => {
    const saved = await persistDownload({
      body: pdfBytes,
      fileName: 'gone.pdf',
      origin: 'http://localhost:3000',
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(await readDownload(saved.id), null);
    assert.equal(await readDownload('b'.repeat(32)), null);
    assert.equal(parseDownloadId('../secrets.pdf'), null);
  });
});

test('removeDownload deletes the files', async () => {
  await withDir(async () => {
    const saved = await persistDownload({
      body: pdfBytes,
      fileName: 'x.pdf',
      origin: 'http://localhost:3000',
    });
    await removeDownload(saved.id);
    assert.equal(await readDownload(saved.id), null);
  });
});

test('Vercel without a Blob store refuses to persist', async () => {
  await withDir(async () => {
    process.env.VERCEL = '1';
    const prevStore = process.env.BLOB_STORE_ID;
    const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      await assert.rejects(
        () => persistDownload({ body: pdfBytes, fileName: 'x.pdf', origin: 'https://md.dima.ua' }),
        /not configured/,
      );
    } finally {
      if (prevStore === undefined) delete process.env.BLOB_STORE_ID;
      else process.env.BLOB_STORE_ID = prevStore;
      if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
    }
  });
});
