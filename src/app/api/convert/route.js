import { NextResponse } from 'next/server';
import { renderPdf } from '@/lib/pdf/generate.js';
import { buildDocumentHtml } from '@/lib/document/html.js';
import { normalizeSettings } from '@/lib/document/settings.js';
import { corsHeaders } from '@/lib/cors.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const MAX_ASSETS = 24;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400, headers: corsHeaders });
}

function sanitizeAssets(input) {
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

/** Accept the legacy body shape ({ theme: 'light'|'dark', paperSize }) as well as the new { settings }. */
function settingsFromBody(body) {
  if (body.settings && typeof body.settings === 'object') return normalizeSettings(body.settings);
  return normalizeSettings({
    theme: body.theme === 'dark' ? 'midnight' : 'clean',
    paperSize: body.paperSize,
  });
}

function safeFileName(title) {
  const base = String(title || 'document')
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${base || 'document'}.pdf`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be JSON.');
  }

  const markdown = typeof body?.markdown === 'string' ? body.markdown : '';
  if (!markdown.trim()) return badRequest('Markdown content is required.');
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) return badRequest('Markdown is too large (max 2 MB).');

  let assets;
  try {
    assets = sanitizeAssets(body.assets);
  } catch (err) {
    return badRequest(err.message);
  }

  const settings = settingsFromBody(body);
  const requestedName = body.fileName ? String(body.fileName).replace(/\.(md|pdf)$/i, '').slice(0, 120) : '';

  if (body.format === 'html') {
    const html = buildDocumentHtml({ markdown, settings, assets, mode: body.mode === 'preview' ? 'preview' : 'pdf', title: requestedName });
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders } });
  }

  try {
    const started = Date.now();
    const { pdf, title } = await renderPdf({ markdown, settings, assets, title: requestedName });
    const fileName = safeFileName(requestedName || title);
    const disposition = body.inline ? 'inline' : 'attachment';

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Content-Disposition': `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
        'X-Render-Time': String(Date.now() - started),
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('[api/convert] PDF generation failed:', error);
    const hint = /Could not find|executablePath|Failed to launch|spawn/i.test(error.message)
      ? 'The PDF engine (Chromium) could not be started. Install Google Chrome locally or set PUPPETEER_EXECUTABLE_PATH.'
      : /timeout/i.test(error.message)
        ? 'Rendering timed out. Very large documents or slow remote images can cause this — try again or remove heavy images.'
        : 'An unexpected error occurred while rendering the PDF.';

    return NextResponse.json(
      { error: hint, details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500, headers: corsHeaders },
    );
  }
}
