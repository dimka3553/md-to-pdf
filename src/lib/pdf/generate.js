import { buildDocumentHtml, buildPdfPageOptions } from '../document/html.js';
import { withBrowser } from './browser.js';

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
    await page.emulateMediaType('print');

    await page.setContent(html, { waitUntil: ['load', 'networkidle0'], timeout: 45_000 });

    // The document script flips data-ready once fonts, images and diagrams are settled.
    await page.waitForFunction(() => document.documentElement.getAttribute('data-ready') === '1', { timeout: 20_000 }).catch(() => {});

    // Page size, margins, background and running header/footer are all defined by the
    // document's `@page` rule (see buildPageCss), so Chromium's own margins/templates are off.
    const pdf = await page.pdf({
      format: pageOptions.format,
      landscape: pageOptions.landscape,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false,
      printBackground: true,
      timeout: 60_000,
    });

    return { pdf: Buffer.from(pdf), title: pageOptions.title };
  });
}
