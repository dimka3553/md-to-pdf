import { buildDocumentHtml, buildPdfPageOptions } from '../document/html.js';
import { withBrowser } from './browser.js';

// Vercel kills the function at maxDuration (60s). These waits have to fit after Chromium launch.
const CONTENT_TIMEOUT_MS = 15_000;
const READY_TIMEOUT_MS = 10_000;
const PDF_TIMEOUT_MS = 25_000;

/**
 * Render markdown + settings to a PDF buffer.
 * @param {{ markdown: string, settings?: object, assets?: Record<string,string>, title?: string }} input
 * @returns {Promise<{ pdf: Buffer, title: string }>}
 */
export async function renderPdf({ markdown, settings, assets, title }) {
  const html = buildDocumentHtml({ markdown, settings, assets, mode: 'pdf', title });
  const pageOptions = buildPdfPageOptions(settings, markdown, title);

  // withBrowser closes Chromium and removes its temp profile/socket directories afterwards.
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      page.setDefaultTimeout(READY_TIMEOUT_MS);
      await page.emulateMediaType('print');

      // Do not wait for networkidle0: Google Fonts, Mermaid and remote images keep connections
      // open and that wait alone can eat the whole 60s Vercel budget. DOMContentLoaded is
      // enough for the in-page script to start; data-ready covers fonts, images and diagrams.
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: CONTENT_TIMEOUT_MS });

      await page.waitForFunction(() => document.documentElement.getAttribute('data-ready') === '1', { timeout: READY_TIMEOUT_MS }).catch(() => {});

      // Page size, margins, background and running header/footer are all defined by the
      // document's `@page` rule (see buildPageCss), so Chromium's own margins/templates are off.
      const pdf = await page.pdf({
        format: pageOptions.format,
        landscape: pageOptions.landscape,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        displayHeaderFooter: false,
        printBackground: true,
        timeout: PDF_TIMEOUT_MS,
      });

      return { pdf: Buffer.from(pdf), title: pageOptions.title };
    } finally {
      await page.close().catch(() => {});
    }
  });
}
