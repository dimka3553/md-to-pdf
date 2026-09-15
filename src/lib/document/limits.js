/**
 * Request-size limits shared by the REST API (`/api/convert`) and the MCP
 * server (`/api/mcp`). Keeping them in one place means both surfaces reject
 * the same inputs with the same messages.
 */

export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
export const MAX_ASSETS = 24;
export const MAX_ASSET_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024;

/** Throws when the markdown is missing or too large. */
export function assertMarkdownSize(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('Markdown content is required.');
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) throw new Error('Markdown is too large (max 2 MB).');
}

/**
 * Keep only `data:image/…` entries, enforce per-image and total size caps.
 * Throws with a user-facing message when a cap is exceeded.
 * @param {unknown} input
 * @returns {Record<string, string>}
 */
export function sanitizeAssets(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  let total = 0;
  for (const [name, dataUrl] of Object.entries(input).slice(0, MAX_ASSETS)) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
    if (dataUrl.length > MAX_ASSET_BYTES) throw new Error(`Image "${name}" is too large (max 3 MB).`);
    total += dataUrl.length;
    if (total > MAX_TOTAL_ASSET_BYTES) throw new Error('Total embedded image size exceeds 8 MB.');
    out[String(name).slice(0, 200)] = dataUrl;
  }
  return out;
}

/** Turn a title / requested file name into a safe `*.pdf` file name. */
export function safeFileName(title, ext = 'pdf') {
  const base = String(title || 'document')
    .replace(/\.(md|pdf|html?)$/i, '')
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${base || 'document'}.${ext}`;
}
