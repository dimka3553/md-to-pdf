import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { markdownToHtml } from '../src/lib/document/markdown.js';
import { buildDocumentHtml } from '../src/lib/document/html.js';
import { normalizeSettings, resolveDesign } from '../src/lib/document/settings.js';
import { withBrowser } from '../src/lib/pdf/browser.js';
import { analyzeMarkdown } from '../src/lib/mcp/analyze.js';

const directives = ['\\pagebreak', '\\newpage', '<!-- pagebreak -->', '<!-- page-break -->', '<!-- newpage -->', '---pagebreak---', '{: .newpage }', '{:.newpage}', '{: .pagebreak }', '{: .page-break }'];
const headingIals = ['## Pay {: .newpage }', '## Pay {:.newpage}', '## Pay {: .pagebreak }', '## Pay\n{: .newpage }'];
const table = (count) => '| Item | Monthly amount |\n| --- | --- |\n'
  + Array.from({ length: count }, (_, i) => `| Row ${i + 1} | ${1500 + i * 10} USD |`).join('\n');

test('all documented page-break forms agree with the analyzer', () => {
  for (const directive of directives) {
    const md = `# Terms\n\n${directive}\n\n## Pay`;
    assert.equal((markdownToHtml(md).match(/class="page-break"/g) || []).length, 1, directive);
    assert.equal(analyzeMarkdown(md).stats.pageBreaks, 1, directive);
  }
  for (const heading of headingIals) {
    const md = `# Terms\n\n${heading}\n\nAll amounts.`;
    const html = markdownToHtml(md);
    assert.equal((html.match(/class="page-break"/g) || []).length, 1, heading);
    assert.match(html, /<h2 id="pay">Pay<\/h2>/, heading);
    assert.doesNotMatch(html, /\{:/, heading);
    const analysis = analyzeMarkdown(md);
    assert.equal(analysis.stats.pageBreaks, 1, heading);
    assert.equal(analysis.outline.at(-1).text, 'Pay', heading);
    assert.match(html, /<h1[^>]*>Terms<\/h1>[\s\S]*<div class="page-break"><\/div>\s*<h2 id="pay">Pay<\/h2>/, heading);
  }
  const kpi = '# Terms\n\n## 4. KPIs {: .newpage }\n\nVideo channels.';
  const kpiHtml = markdownToHtml(kpi);
  assert.match(kpiHtml, /<div class="page-break"><\/div>\s*<h2 id="4-kpis">4. KPIs<\/h2>/);
  assert.doesNotMatch(kpiHtml, /\{:/);
  assert.equal(analyzeMarkdown(kpi).outline.at(-1).text, '4. KPIs');
  const between = markdownToHtml('# Terms\n\n## Intro\n\nText.\n\n{: .newpage }\n\n## Pay\n\nMore.');
  assert.match(between, /Intro<\/h2>[\s\S]*<div class="page-break"><\/div>\s*<h2 id="pay">Pay<\/h2>/);
});

test('page-break words and examples are literal, including unhighlighted HTML code', () => {
  for (const text of ['pagebreak', 'newpage', '\\pagebreak is a command', '`\\pagebreak`',
    '```text\n<!-- pagebreak -->\n\\pagebreak\n---pagebreak---\n{: .newpage }\n```',
    '    <!-- pagebreak -->', 'before <!-- pagebreak --> after', '## Pay {: .foo }',
    'A heading {: .foo } stays literal', 'In prose {: .newpage } is not a break']) {
    assert.doesNotMatch(markdownToHtml(text), /class="page-break"/, text);
  }
});

test('analyzer flags a divider immediately before a heading', () => {
  const flagged = analyzeMarkdown('# Terms\n\n---\n\n## Pay\n\nText.');
  assert.ok(flagged.warnings.some((w) => w.code === 'hr-before-heading'));
  const ok = analyzeMarkdown('# Terms\n\n## Pay\n\nText.\n\n---\n\nA break in the middle of a section.');
  assert.ok(!ok.warnings.some((w) => w.code === 'hr-before-heading'));
});

test('empty table headers omit the coloured header row', () => {
  const html = markdownToHtml('|  |  |\n| --- | --- |\n| From | Acme |\n| To | Jane |');
  assert.doesNotMatch(html, /<thead>/);
  assert.doesNotMatch(html, /<th[>\s]/);
  assert.match(html, /class="no-header"/);
  assert.match(html, /<td>From<\/td>/);
  const headed = markdownToHtml('| Name | Role |\n| --- | --- |\n| Ada | Eng |');
  assert.match(headed, /<thead>/);
  assert.match(headed, /<th>Name<\/th>/);
  assert.doesNotMatch(headed, /no-header/);
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
      for (const heading of ['## Pay {: .newpage }', '## Pay\n{: .newpage }']) {
        const pages = await pdfPages(fixture(0.1, 4, {}, '').replace('## Pay', heading), { pageBreaks: 'h2' });
        assert.equal(pages.length, 2, heading);
        assert.doesNotMatch(pages[0], /Pay/);
        assert.match(pages[1], /Pay.*Row 4/);
        assert.doesNotMatch(pages.join(' '), /newpage|\{:/);
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
    await t.test('preview splits long tables on row boundaries and repeats a real header', async () => {
      const page = await render(fixture(0.2, 65), {}, 'preview');
      try {
        const info = await page.evaluate(() => ({
          cont: document.querySelectorAll('.table-wrap[data-pg-cont]').length,
          theads: document.querySelectorAll('thead').length,
          th: (document.querySelector('thead th') || {}).textContent,
          gaps: document.querySelectorAll('.page-gap').length,
          guides: document.querySelectorAll('.page-guide').length,
        }));
        assert.ok(info.cont >= 1, 'long tables must continue on a following preview page');
        assert.equal(info.theads, info.cont + 1);
        assert.equal(info.th, 'Item');
        assert.ok(info.gaps >= 1, 'continuations must start on a new preview page');
        assert.equal(info.guides, 0);
      } finally { await page.close(); }
    });
    await t.test('headerless tables do not draw a header bar when they continue', async () => {
      const md = '# Terms\n\n|  |  |\n| --- | --- |\n'
        + Array.from({ length: 65 }, (_, i) => `| Row ${i + 1} | ${1500 + i * 10} USD |`).join('\n');
      const page = await render(md, { theme: 'corporate' }, 'preview');
      try {
        const info = await page.evaluate(() => ({
          theads: document.querySelectorAll('thead').length,
          ths: document.querySelectorAll('th').length,
          cont: document.querySelectorAll('.table-wrap[data-pg-cont]').length,
          gaps: document.querySelectorAll('.page-gap').length,
          guides: document.querySelectorAll('.page-guide').length,
        }));
        assert.equal(info.theads, 0);
        assert.equal(info.ths, 0);
        assert.ok(info.cont >= 1);
        assert.ok(info.gaps >= 1);
        assert.equal(info.guides, 0);
      } finally { await page.close(); }
    });
    await t.test('corporate table headers keep light text, including bold cells', async () => {
      const md = '# Terms\n\n| **Dmytro Shkabura, CEO** | Andrej |\n| --- | --- |\n| Signature | |';
      const page = await render(md, { theme: 'corporate' }, 'pdf');
      try {
        const colors = await page.evaluate(() => {
          const ths = [...document.querySelectorAll('th')];
          const cs = (el) => getComputedStyle(el);
          return ths.map((th) => ({
            color: cs(th).color,
            fill: cs(th).webkitTextFillColor,
            background: cs(th).backgroundColor,
            strongColor: th.querySelector('strong') ? cs(th.querySelector('strong')).color : null,
            strongFill: th.querySelector('strong') ? cs(th.querySelector('strong')).webkitTextFillColor : null,
          }));
        });
        assert.equal(colors.length, 2);
        for (const c of colors) {
          assert.equal(c.color, 'rgb(255, 255, 255)');
          assert.equal(c.fill, 'rgb(255, 255, 255)');
          assert.equal(c.background, 'rgb(11, 42, 91)');
        }
        assert.equal(colors[0].strongColor, 'rgb(255, 255, 255)');
        assert.equal(colors[0].strongFill, 'rgb(255, 255, 255)');
      } finally { await page.close(); }
    });
  });
});
