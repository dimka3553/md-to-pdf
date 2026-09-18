import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDocumentHtml } from '../src/lib/document/html.js';
import { withBrowser } from '../src/lib/pdf/browser.js';

const DIAGRAM = `# Incident

\`\`\`mermaid
flowchart TD
  Q{All eight servers updated:}
  Q -->|eight of eight| A[An ordinary Wednesday]
  Q -->|seven of eight| B[Repurposed flag wakes dormant 2003 code]
\`\`\`
`;

test('diagram CSS keeps mermaid label padding outside the text box', { timeout: 120_000 }, async () => {
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      await page.setRequestInterception(true);
      page.on('request', (request) => request.abort());
      await page.setContent(buildDocumentHtml({ markdown: '# Diagrams\n\nText.', mode: 'pdf' }).replace(/<link[^>]*>/g, ''));
      await page.waitForSelector('html[data-ready="1"]');
      const metrics = await page.evaluate(() => {
        const fig = document.createElement('figure');
        fig.className = 'diagram';
        fig.innerHTML = '<pre class="mermaid"><span class="probe" style="display:inline-block;width:40px;padding:0 10px;border:0">Label</span></pre>';
        document.querySelector('.doc').appendChild(fig);
        const el = fig.querySelector('.probe');
        return { boxSizing: getComputedStyle(el).boxSizing, clientWidth: el.clientWidth };
      });
      // content-box: width 40 + padding 20. border-box would report 40 and clip the text.
      assert.equal(metrics.boxSizing, 'content-box');
      assert.equal(metrics.clientWidth, 60);
    } finally {
      await page.close();
    }
  });
});

test('flowchart node and edge labels are not clipped', { timeout: 120_000 }, async (t) => {
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().includes('mermaid')) request.continue();
        else request.abort();
      });
      await page.emulateMediaType('print');
      await page.setContent(buildDocumentHtml({ markdown: DIAGRAM, mode: 'pdf' }).replace(/<link[^>]*>/g, ''));
      await page.waitForSelector('html[data-ready="1"]');
      const loaded = await page.evaluate(() => !!window.mermaid);
      if (!loaded) {
        t.skip('mermaid runtime did not load');
        return;
      }
      await page.waitForSelector('figure.diagram svg');
      const clipped = await page.evaluate(() => {
        const overflow = [];
        for (const el of document.querySelectorAll('.nodeLabel, .edgeLabel')) {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          if (el.scrollWidth > el.clientWidth + 1) overflow.push(text);
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let last = null;
          while (walker.nextNode()) last = walker.currentNode;
          if (!last || !last.length) continue;
          const range = document.createRange();
          range.setStart(last, last.length - 1);
          range.setEnd(last, last.length);
          const glyph = range.getBoundingClientRect();
          if (!glyph.width) continue;
          const clipper = el.closest('foreignObject') || el;
          const box = clipper.getBoundingClientRect();
          if (glyph.right > box.right + 1 || glyph.left < box.left - 1) overflow.push(text);
        }
        return overflow;
      });
      assert.deepEqual(clipped, []);
    } finally {
      await page.close();
    }
  });
});
