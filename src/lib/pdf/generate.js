import { buildDocumentHtml, buildPdfPageOptions } from '../document/html.js';
import { withPrintableFonts } from '../document/fonts.js';
import { resolveDesign } from '../document/settings.js';
import { withBrowser } from './browser.js';
import { collectDomSnapshot } from './inspect.js';
import { buildLayoutReport } from './layout.js';

// Vercel kills the function at maxDuration (60s). These waits have to fit after Chromium launch.
const CONTENT_TIMEOUT_MS = 15_000;
const READY_TIMEOUT_MS = 10_000;
const PDF_TIMEOUT_MS = 25_000;

/**
 * Render markdown + settings to a PDF buffer plus an agent-facing layout report.
 * @param {{ markdown: string, settings?: object, assets?: Record<string,string>, title?: string, includeLayout?: boolean }} input
 * @returns {Promise<{ pdf: Buffer, title: string, layout?: object }>}
 */
export async function renderPdf({ markdown, settings, assets, title, includeLayout = false }) {
  const html = await withPrintableFonts(buildDocumentHtml({ markdown, settings, assets, mode: 'pdf', title }));
  const pageOptions = buildPdfPageOptions(settings, markdown, title);
  const design = resolveDesign(settings);

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

      const buffer = Buffer.from(pdf);
      if (!includeLayout) return { pdf: buffer, title: pageOptions.title };
      const layout = await describeLayout(page, buffer, { settings, design, title: pageOptions.title });
      return { pdf: buffer, title: pageOptions.title, layout };
    } finally {
      await page.close().catch(() => {});
    }
  });
}

async function describeLayout(page, pdf, { settings, design, title }) {
  try {
    const { extractPdfLayout } = await import('./extract.js');
    const headerBandPx = design.hasRunningHeader ? Math.round(design.margins.y * 0.55) + 18 : 8;
    const footerBandPx = design.hasRunningFooter ? Math.round(design.margins.y * 0.55) + 18 : 8;
    const [printed, dom] = await Promise.all([
      extractPdfLayout(pdf, {
        pageWidth: design.pageWidth,
        pageHeight: design.pageHeight,
        headerBandPx,
        footerBandPx,
      }),
      page.evaluate(collectDomSnapshot),
    ]);
    return buildLayoutReport({ printed, dom, settings, design, title });
  } catch (err) {
    console.error('[pdf] layout report failed:', err);
    return {
      pageCount: 0,
      pages: [],
      issues: [{ severity: 'warning', code: 'layout-unavailable', message: err.message }],
      text: `Layout report unavailable (${err.message}). Download the PDF to inspect page breaks.\n`,
    };
  }
}
