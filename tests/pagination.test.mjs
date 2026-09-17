import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { markdownToHtml } from '../src/lib/document/markdown.js';
import { buildDocumentHtml } from '../src/lib/document/html.js';
import { normalizeSettings, resolveDesign } from '../src/lib/document/settings.js';
import { withBrowser } from '../src/lib/pdf/browser.js';
import { analyzeMarkdown } from '../src/lib/mcp/analyze.js';

const directives = ['\\pagebreak', '\\newpage', '<!-- pagebreak -->', '<!-- page-break -->', '<!-- newpage -->', '---pagebreak---'];
const table = (count) => '| Item | Monthly amount |\n| --- | --- |\n'
  + Array.from({ length: count }, (_, i) => `| Row ${i + 1} | ${1500 + i * 10} USD |`).join('\n');

test('all documented page-break forms agree with the analyzer', () => {
  for (const directive of directives) {
    const md = `# Terms\n\n${directive}\n\n## Pay`;
    assert.equal((markdownToHtml(md).match(/class="page-break"/g) || []).length, 1, directive);
    assert.equal(analyzeMarkdown(md).stats.pageBreaks, 1, directive);
  }
});

test('page-break words and examples are literal, including unhighlighted HTML code', () => {
  for (const text of ['pagebreak', 'newpage', '\\pagebreak is a command', '`\\pagebreak`',
    '```text\n<!-- pagebreak -->\n\\pagebreak\n---pagebreak---\n```',
    '    <!-- pagebreak -->', 'before <!-- pagebreak --> after']) {
    assert.doesNotMatch(markdownToHtml(text), /class="page-break"/, text);
  }
});

test('real Chromium pagination keeps section openings together', { timeout: 120_000 }, async (t) => {
  await withBrowser(async (browser) => {
    async function render(markdown, settings = {}, mode = 'pdf') {
      const page = await browser.newPage();
      // Use installed fallback fonts and no network to keep layout tests deterministic.
      await page.setRequestInterception(true);
      page.on('request', (request) => request.abort());
      await page.emulateMediaType(mode === 'pdf' ? 'print' : 'screen');
      await page.setContent(buildDocumentHtml({ markdown, settings, mode }).replace(/<link[^>]*>/g, ''));
      await page.waitForSelector('html[data-ready="1"]');
      return page;
    }
    async function pdfPages(markdown, settings) {
      const page = await render(markdown, settings);
      try {
        const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
        try {
          const pages = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            pages.push((await (await pdf.getPage(i)).getTextContent()).items.map((item) => item.str).join(' '));
          }
          return pages;
        } finally { await pdf.destroy(); }
      } finally { await page.close(); }
    }
    function fixture(fraction, rows, settings = {}, divider = '') {
      const design = resolveDesign(normalizeSettings(settings));
      const usable = design.pageHeight - 2 * design.margins.y
        - (design.hasRunningHeader ? 30 : 0) - (design.hasRunningFooter ? 30 : 0);
      // A controlled prior block places the section at reproducible page positions.
      return `# Terms\n\n<div style="height:${usable * fraction}px">Previous section</div>\n\n${divider}## Pay\n\nAll amounts are in USD per month.\n\n${table(rows)}`;
    }

    for (const settings of [{ theme: 'corporate' }, { paperSize: 'Letter', margins: 'wide', fontSize: 'lg', header: { text: 'Terms' } },
      { paperSize: 'Legal', orientation: 'landscape', margins: 'narrow', fontSize: 'sm' }]) {
      await t.test(`compact opening moves together: ${JSON.stringify(settings)}`, async () => {
        const pages = await pdfPages(fixture(0.74, 4, settings), settings);
        assert.equal(pages.length, 2);
        assert.doesNotMatch(pages[0], /Pay|All amounts|Row 1/);
        assert.match(pages[1], /Pay.*All amounts.*Row 1.*Row 4/);
      });
    }
    await t.test('section near the middle stays on the current page', async () => {
      const pages = await pdfPages(fixture(0.42, 4));
      assert.equal(pages.length, 1);
      assert.match(pages[0], /Pay.*All amounts.*Row 4/);
    });
    for (const fraction of [0.42, 0.77]) {
      await t.test(`long table flows with repeated headers at ${fraction}`, async () => {
        const pages = await pdfPages(fixture(fraction, 65));
        const opening = pages.find((text) => text.includes('Pay'));
        assert.match(opening, /All amounts.*Monthly amount.*Row 1.*Row 2/);
        for (const text of pages.filter((text) => text.includes('Row '))) assert.match(text, /Monthly amount/);
        assert.equal((pages.join(' ').match(/Row \d+/g) || []).length, 65);
        assert.ok(pages.length < 5, 'long tables must not be forced onto one overflowing page');
      });
    }
    await t.test('explicit break overrides available space and h2 mode does not add a blank page', async () => {
      for (const directive of directives) {
        const pages = await pdfPages(fixture(0.1, 4, {}, `${directive}\n\n`), { pageBreaks: 'h2' });
        assert.equal(pages.length, 2, directive);
        assert.doesNotMatch(pages[0], /Pay/);
        assert.match(pages[1], /Pay.*Row 4/);
      }
    });
    await t.test('leading, repeated and trailing markers do not create blank pages', async () => {
      const pages = await pdfPages('\\pagebreak\n\n\\pagebreak\n\n# First\n\nText.\n\n\\pagebreak\n\n\\pagebreak\n\n## Second\n\nText.\n\n\\pagebreak\n\n\\pagebreak');
      assert.equal(pages.length, 2);
      assert.match(pages[0], /First/);
      assert.match(pages[1], /Second/);
    });
    await t.test('cover and contents still own separate pages', async () => {
      const pages = await pdfPages('# Terms\n\n## Pay\n\nAll amounts are in USD per month.\n\n' + table(4), { cover: { enabled: true }, toc: true });
      assert.equal(pages.length, 3);
      assert.match(pages[0], /Terms/);
      assert.match(pages[1], /Contents/);
      assert.match(pages[2], /Pay.*Row 4/);
    });
    await t.test('divider and heading breaks coalesce in PDF and preview', async () => {
      const md = fixture(0.1, 4, {}, '\\pagebreak\n\n---\n\n');
      const pages = await pdfPages(md, { pageBreaks: 'h2' });
      assert.equal(pages.length, 2);
      assert.match(pages[1], /Pay.*Row 4/);
      const page = await render(md, { pageBreaks: 'h2' }, 'preview');
      try { assert.equal(await page.$$eval('.page-gap', (gaps) => gaps.length), 1); }
      finally { await page.close(); }
    });
    await t.test('an oversized table row can flow without losing its end', async () => {
      const md = '# Terms\n\n## Pay\n\nAll amounts are in USD per month.\n\n| Item | Detail |\n| --- | --- |\n| Tall | '
        + 'Large row content. '.repeat(500) + 'ROW END |\n| Last | TABLE END |';
      const pages = await pdfPages(md);
      assert.ok(pages.length > 1 && pages.length < 10);
      assert.match(pages.join(' '), /ROW END.*TABLE END/);
    });
    await t.test('preview moves the heading before the table and remains stable on resize', async () => {
      const page = await render(fixture(0.74, 4, {}, '---\n\n'), {}, 'preview');
      try {
        const layout = () => page.evaluate(() => ({
          gaps: document.querySelectorAll('.page-gap').length,
          moved: document.querySelector('hr').previousElementSibling.classList.contains('page-gap'),
          intact: document.querySelector('h2').nextElementSibling.nextElementSibling.classList.contains('keep-block'),
        }));
        assert.deepEqual(await layout(), { gaps: 1, moved: true, intact: true });
        await page.setViewport({ width: 1000, height: 800 });
        // Wait for the preview's 120ms resize debounce before checking idempotence.
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 180)));
        assert.deepEqual(await layout(), { gaps: 1, moved: true, intact: true });
      } finally { await page.close(); }
    });
  });
});
