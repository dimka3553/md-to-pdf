import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { persistDocument, readDocument, removeDocument } from '../src/lib/documents.js';
import { resolveDocumentSource } from '../src/lib/mcp/input.js';

async function withDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'md-docs-'));
  const prevDir = process.env.DOWNLOAD_DIR;
  const prevVercel = process.env.VERCEL;
  process.env.DOWNLOAD_DIR = dir;
  delete process.env.VERCEL;
  try {
    await fn();
  } finally {
    if (prevDir === undefined) delete process.env.DOWNLOAD_DIR;
    else process.env.DOWNLOAD_DIR = prevDir;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    await rm(dir, { recursive: true, force: true });
  }
}

test('persistDocument round-trips markdown, assets and settings', async () => {
  await withDir(async () => {
    const saved = await persistDocument({
      markdown: '# Hello\n\nWorld',
      assets: { mark: 'data:image/png;base64,AAA' },
      settings: { theme: 'corporate' },
      fileName: 'Hello',
    });
    assert.match(saved.id, /^[a-f0-9]{32}$/);
    const rec = await readDocument(saved.id);
    assert.equal(rec.markdown, '# Hello\n\nWorld');
    assert.equal(rec.assets.mark, 'data:image/png;base64,AAA');
    assert.equal(rec.settings.theme, 'corporate');
    assert.equal(rec.fileName, 'Hello');
    await removeDocument(saved.id);
    assert.equal(await readDocument(saved.id), null);
  });
});

test('resolveDocumentSource reuses an id and merges a settings patch', async () => {
  await withDir(async () => {
    const first = await resolveDocumentSource({
      markdown: '# Spec\n\nBody.',
      settings: { theme: 'clean', toc: true },
      fileName: 'Spec',
    });
    assert.ok(first.documentId);
    const second = await resolveDocumentSource({
      documentId: first.documentId,
      settings: { theme: 'midnight' },
    });
    assert.equal(second.documentId, first.documentId);
    assert.equal(second.markdown, '# Spec\n\nBody.');
    assert.equal(second.settings.theme, 'midnight');
    assert.equal(second.settings.toc, true);
    assert.equal(second.fileName, 'Spec');
  });
});

test('resolveDocumentSource rejects a missing documentId', async () => {
  await withDir(async () => {
    await assert.rejects(
      () => resolveDocumentSource({ documentId: 'a'.repeat(32) }),
      /Unknown or expired documentId/,
    );
  });
});
