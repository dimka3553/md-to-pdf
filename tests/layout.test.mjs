import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignBlocksToPages, buildLayoutReport, detectLayoutIssues } from '../src/lib/pdf/layout.js';
import { extractPdfLayout } from '../src/lib/pdf/extract.js';
import { normalizeSettings, resolveDesign } from '../src/lib/document/settings.js';
import { renderPdf } from '../src/lib/pdf/generate.js';

function minimalPdf() {
  const objects = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
    '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R/Resources<<>>>>endobj\n',
  ];
  let body = '%PDF-1.1\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body);
  body += 'xref\n0 4\n0000000000 65535 f \n';
  for (let i = 1; i <= 3; i++) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer<</Size 4/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body);
}

function printedPages(specs) {
  return {
    pageCount: specs.length,
    pages: specs.map((p, i) => ({
      number: i + 1,
      header: p.header || '',
      footer: p.footer || `${i + 1} / ${specs.length}`,
      text: p.body.map((l) => l.text).join(' '),
      body: p.body,
      usedPct: p.body.length ? p.body[p.body.length - 1].yPct + 2 : 0,
      lines: p.body,
    })),
  };
}

test('pdf.js loads in Node without browser geometry APIs', async () => {
  const printed = await extractPdfLayout(minimalPdf(), { pageWidth: 200, pageHeight: 200 });
  assert.equal(printed.pageCount, 1);
  assert.equal(printed.pages[0].body.length, 0);
});

test('layout report maps blocks onto printed pages and flags a repeating header', () => {
  const printed = printedPages([
    { body: [{ text: 'Terms', yPct: 8 }, { text: 'Previous section', yPct: 22 }] },
    { body: [{ text: 'Pay', yPct: 10 }, { text: 'All amounts are in USD', yPct: 16 }, { text: 'Row 1 1500', yPct: 24 }] },
  ]);
  const dom = {
    look: { pageBackground: '#FFFFFF', text: '#1E293B', headingColor: '#0B2A5B', h1Size: '22px', h2Size: '16px', h2Rule: true },
    overflow: [],
    blocks: [
      { kind: 'h1', text: 'Terms', look: { fontSize: '22px', fontWeight: '700', color: '#0B2A5B', lines: 1 }, flags: {} },
      { kind: 'p', text: 'Previous section', look: { fontSize: '14px', lines: 2, color: '#1E293B' }, flags: {} },
      { kind: 'h2', text: 'Pay', look: { fontSize: '16px', fontWeight: '700', color: '#0B2A5B', borderBottom: '1px #E5E7EB' }, flags: { manualPageStart: true } },
      { kind: 'p', text: 'All amounts are in USD', look: { fontSize: '14px', lines: 1 }, flags: {} },
      {
        kind: 'table',
        text: 'Item Amount Row 1 1500',
        look: { fontSize: '12px' },
        flags: {},
        table: {
          cols: 2,
          rows: 1,
          hasHeader: true,
          header: ['Item', 'Amount'],
          rowNeedles: ['Row 1 1500'],
          headerColor: '#FFFFFF',
          headerBackground: '#0B2A5B',
        },
      },
    ],
  };
  const settings = normalizeSettings({ theme: 'corporate', header: { text: 'Terms' }, footer: { pageNumbers: true } });
  const report = buildLayoutReport({ printed, dom, settings, design: resolveDesign(settings), title: 'Terms' });

  assert.equal(report.pageCount, 2);
  assert.equal(report.pages[0].blocks.map((b) => b.kind).join(), 'h1,p');
  assert.equal(report.pages[1].blocks.map((b) => b.kind).join(), 'h2,p,table');
  assert.equal(report.pages[1].blocks[0].yPct, 10);
  assert.ok(report.issues.some((i) => i.code === 'header-repeats-title'));
  assert.match(report.text, /LAYOUT REPORT — 2 pages/);
  assert.match(report.text, /p\.1 → p\.2/);
  assert.match(report.text, /manual \\pagebreak/);
  assert.match(report.text, /H2\s+"Pay"/);
  assert.match(report.text, /TABLE\s+2 cols/);
  assert.match(report.text, /Do not screenshot/);
});

test('split tables are reported as continuations across pages', () => {
  const printed = printedPages([
    { body: [{ text: 'Pay', yPct: 8 }, { text: 'Item Amount', yPct: 20 }, { text: 'Row 1', yPct: 28 }] },
    { body: [{ text: 'Item Amount', yPct: 8 }, { text: 'Row 2', yPct: 16 }, { text: 'Row 3', yPct: 24 }] },
  ]);
  const pages = assignBlocksToPages({
    blocks: [{
      kind: 'h2',
      text: 'Pay',
      look: {},
      flags: {},
    }, {
      kind: 'table',
      text: 'Item Amount Row 1 Row 2 Row 3',
      look: {},
      flags: {},
      table: {
        cols: 2,
        rows: 3,
        hasHeader: true,
        header: ['Item', 'Amount'],
        rowNeedles: ['Row 1', 'Row 2', 'Row 3'],
      },
    }],
    overflow: [],
  }, printed);
  assert.equal(pages[0].blocks.filter((b) => b.kind === 'table').length, 1);
  assert.equal(pages[1].blocks.filter((b) => b.kind === 'table').length, 1);
  assert.deepEqual(pages[0].blocks.find((b) => b.kind === 'table').split, { from: 1, to: 1 });
  assert.deepEqual(pages[1].blocks.find((b) => b.kind === 'table').split, { from: 2, to: 3 });
});

test('short headings do not match inside longer words', () => {
  const printed = printedPages([
    { body: [{ text: 'Do not skip payroll.', yPct: 20 }] },
    { body: [{ text: 'Pay', yPct: 10 }, { text: 'All amounts', yPct: 16 }] },
  ]);
  const pages = assignBlocksToPages({
    blocks: [
      { kind: 'p', text: 'Do not skip payroll.', look: {}, flags: {} },
      { kind: 'h2', text: 'Pay', look: {}, flags: { manualPageStart: true } },
    ],
    overflow: [],
  }, printed);
  assert.equal(pages[0].blocks.map((b) => b.kind).join(), 'p');
  assert.equal(pages[1].blocks.map((b) => b.kind).join(), 'h2');
});

test('heading stranded at the bottom of a page is a warning', () => {
  const pages = [{
    number: 1,
    usedPct: 92,
    header: '',
    footer: '1 / 1',
    body: [],
    blocks: [{ kind: 'h2', text: 'Appendix', yPct: 88, flags: {}, look: {} }],
  }];
  const issues = detectLayoutIssues(pages, { title: 'Doc', settings: normalizeSettings({}) });
  assert.ok(issues.some((i) => i.code === 'heading-at-bottom'));
});

test('real Chromium render_pdf includes a layout report with page map', { timeout: 120_000 }, async () => {
  const table = '| Item | Monthly amount |\n| --- | --- |\n'
    + Array.from({ length: 4 }, (_, i) => `| Row ${i + 1} | ${1500 + i * 10} USD |`).join('\n');
  const markdown = `# Terms\n\nIntro paragraph on the first page.\n\n\\pagebreak\n\n## Pay\n\nAll amounts are in USD per month.\n\n${table}`;
  const settings = normalizeSettings({ theme: 'corporate', footer: { pageNumbers: true } });
  const { pdf, title, layout } = await renderPdf({ markdown, settings, includeLayout: true });

  assert.ok(pdf.length > 1000);
  assert.equal(title, 'Terms');
  assert.ok(layout.pageCount >= 2, `expected at least 2 pages, got ${layout.pageCount}`);
  assert.match(layout.text, /LAYOUT REPORT/);
  assert.match(layout.text, /PAGE 1\//);
  assert.match(layout.text, /H1/);
  assert.match(layout.text, /Pay/);
  assert.match(layout.text, /p\.1 → p\.2/);
  const payPage = layout.pages.find((p) => p.blocks.some((b) => b.kind === 'h2' && /Pay/.test(b.text)));
  assert.ok(payPage, 'Pay heading should be assigned to a printed page');
  assert.notEqual(payPage.number, 1, 'manual page break should move Pay off page 1');
  const tableBlock = layout.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'table');
  assert.ok(tableBlock);
  assert.equal(tableBlock.table.cols, 2);
  assert.ok(tableBlock.look?.color || tableBlock.table);

  const withCover = await renderPdf({
    markdown: '# Terms\n\n## Pay\n\nHello.\n\n' + table,
    settings: normalizeSettings({ cover: { enabled: true, subtitle: 'Review' }, toc: true, theme: 'corporate' }),
    includeLayout: true,
  });
  assert.ok(withCover.layout.pageCount >= 3);
  assert.match(withCover.layout.text, /cover/i);
  assert.match(withCover.layout.text, /TOC|contents/i);
});
