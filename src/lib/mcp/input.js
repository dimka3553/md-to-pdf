import { persistDocument, readDocument } from '../documents.js';
import { assertMarkdownSize, sanitizeAssets } from '../document/limits.js';
import { mergeSettings } from '../document/settings.js';

/**
 * Resolve markdown/assets/settings from a fresh payload or a stored documentId.
 * Refreshes the snapshot in place when an id is reused.
 */
export async function resolveDocumentSource({ markdown, documentId, settings, assets, fileName } = {}) {
  let stored = null;
  if (documentId) {
    stored = await readDocument(documentId);
    if (!stored) {
      throw new Error(`Unknown or expired documentId "${documentId}". Call analyze_markdown (or import_web_page) again with the Markdown.`);
    }
  }

  const md = typeof markdown === 'string' && markdown.trim() ? markdown : stored?.markdown;
  if (!md) throw new Error('Pass markdown or a documentId from analyze_markdown / import_web_page.');
  assertMarkdownSize(md);

  const incomingAssets = assets && typeof assets === 'object' && Object.keys(assets).length
    ? sanitizeAssets(assets)
    : null;
  const cleanAssets = incomingAssets || stored?.assets || {};
  const normalized = mergeSettings(stored?.settings, settings);
  const name = (typeof fileName === 'string' && fileName.trim() ? fileName : stored?.fileName || '').slice(0, 120);

  const saved = await persistDocument({
    id: stored ? documentId : undefined,
    markdown: md,
    assets: cleanAssets,
    settings: normalized,
    fileName: name,
  });

  return {
    markdown: md,
    assets: cleanAssets,
    settings: normalized,
    fileName: name,
    documentId: saved?.id || documentId || null,
    expiresAt: saved?.expiresAt || stored?.expiresAt || null,
  };
}

export function documentIdNote(doc) {
  if (!doc?.documentId) return '';
  return `documentId: ${doc.documentId} (reuse this with a settings patch; expires in 24h).`;
}
