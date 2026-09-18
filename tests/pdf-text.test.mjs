import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDocumentHtml } from '../src/lib/document/html.js';
import { withPrintableFonts } from '../src/lib/document/fonts.js';
import { normalizeSettings } from '../src/lib/document/settings.js';
import { extractPdfLayout } from '../src/lib/pdf/extract.js';
import { renderPdf } from '../src/lib/pdf/generate.js';

test('PDF HTML inlines TrueType faces instead of Google Fonts WOFF2', { timeout: 30_000 }, async () => {
  const html = buildDocumentHtml({ markdown: '# Official file', settings: normalizeSettings({}) });
  assert.match(html, /fonts\.googleapis\.com\/css2/);
  const printable = await withPrintableFonts(html);
  assert.match(printable, /data-print-fonts="1"/);
  assert.match(printable, /data:font\/ttf;base64,/);
  assert.match(printable, /format\('truetype'\)/);
  assert.doesNotMatch(printable, /fonts\.googleapis\.com/);
  assert.doesNotMatch(printable, /fonts\.gstatic\.com/);
});

test('rendered PDF embeds TrueType so copied text stays intact', { timeout: 120_000 }, async () => {
  const markdown = `# Official first file

The office workflow is efficient. Affiliates offer official verification of files.

A sentence with normal spacing and punctuation: Hello, world! The quick brown fox jumps.
`;
  const { pdf } = await renderPdf({ markdown, settings: normalizeSettings({ theme: 'editorial' }) });
  const raw = pdf.toString('latin1');
  assert.match(raw, /CIDFontType2/);
  assert.doesNotMatch(raw, /\/Subtype \/Type3/);

  const printed = await extractPdfLayout(pdf, { pageWidth: 794, pageHeight: 1123 });
  const text = printed.pages.map((p) => p.text).join('\n');
  assert.match(text, /Official first file/);
  assert.match(text, /The office workflow is efficient/);
  assert.match(text, /Hello, world!/);
  assert.doesNotMatch(text, /[\uFB00-\uFB04]/);
});
