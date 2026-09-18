/**
 * Read a Chromium-generated PDF into per-page lines with positions.
 * Used to tell agents what actually printed, without screenshots.
 */

import { ensurePdfJsDom } from './pdfjs-dom.js';

let pdfjsModule;

function loadPdfJs() {
  if (!pdfjsModule) {
    // Next evaluates externals independently of local imports, so the polyfill
    // must run in this function — not as a sibling static import of pdfjs-dist.
    ensurePdfJsDom();
    pdfjsModule = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsModule;
}

/**
 * @param {Buffer|Uint8Array} pdf
 * @param {object} [options]
 */
export async function openPdfDocument(pdf, options = {}) {
  const { getDocument } = await loadPdfJs();
  const data = Buffer.isBuffer(pdf) ? new Uint8Array(pdf) : pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  return getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
    ...options,
  }).promise;
}

const LINE_Y_TOLERANCE = 3.2;

function fontSizeOf(item) {
  const t = item.transform || [];
  const h = Math.hypot(t[2] || 0, t[3] || 0);
  return h || item.height || 0;
}

function round(n, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function clusterLines(items, pageHeight, pageWidth) {
  const sorted = items
    .map((item) => {
      const t = item.transform || [1, 0, 0, 1, 0, 0];
      const str = String(item.str || '');
      if (!str) return null;
      return {
        x: t[4] || 0,
        y: t[5] || 0,
        width: item.width || 0,
        fontSize: fontSizeOf(item),
        text: str,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(LINE_Y_TOLERANCE, (item.fontSize || 10) * 0.35);
    if (last && Math.abs(last.y - item.y) <= tol) {
      last.items.push(item);
      last.y = (last.y * (last.items.length - 1) + item.y) / last.items.length;
      last.fontSize = Math.max(last.fontSize, item.fontSize);
    } else {
      lines.push({ y: item.y, fontSize: item.fontSize, items: [item] });
    }
  }

  return lines.map((line) => {
    const itemsInLine = line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let prev = null;
    for (const it of itemsInLine) {
      if (prev) {
        const gap = it.x - (prev.x + prev.width);
        if (gap > Math.max(1.2, (prev.fontSize || 10) * 0.28)) text += ' ';
      }
      text += it.text;
      prev = it;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const x = itemsInLine[0].x;
    const right = itemsInLine[itemsInLine.length - 1].x + itemsInLine[itemsInLine.length - 1].width;
    const yFromTop = pageHeight - line.y;
    return {
      text,
      x: round(x),
      y: round(yFromTop),
      yPct: round((yFromTop / pageHeight) * 100),
      xPct: round((x / pageWidth) * 100),
      width: round(Math.max(0, right - x)),
      fontSize: round(line.fontSize, 1),
    };
  }).filter(Boolean);
}

function band(yPct, headerMaxPct, footerMinPct) {
  if (yPct <= headerMaxPct) return 'header';
  if (yPct >= footerMinPct) return 'footer';
  return 'body';
}

/**
 * @param {Buffer|Uint8Array} pdf
 * @param {{ pageHeight: number, pageWidth: number, headerBandPx?: number, footerBandPx?: number }} geometry
 */
export async function extractPdfLayout(pdf, geometry) {
  const doc = await openPdfDocument(pdf);
  try {
    const headerMaxPct = ((geometry.headerBandPx || 0) / geometry.pageHeight) * 100 + 1.2;
    const footerMinPct = 100 - ((geometry.footerBandPx || 0) / geometry.pageHeight) * 100 - 1.2;
    const pages = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent({ includeMarkedContent: false });
        const lines = clusterLines(content.items || [], viewport.height, viewport.width).map((line) => ({
          ...line,
          band: band(line.yPct, headerMaxPct, footerMinPct),
        }));
        const body = lines.filter((l) => l.band === 'body');
        const header = lines.filter((l) => l.band === 'header').map((l) => l.text).join(' ').trim();
        const footer = lines.filter((l) => l.band === 'footer').map((l) => l.text).join(' ').trim();
        const lastBody = body[body.length - 1];
        pages.push({
          number: i,
          width: round(viewport.width, 0),
          height: round(viewport.height, 0),
          header: header || '',
          footer: footer || '',
          lines,
          body,
          text: body.map((l) => l.text).join(' '),
          usedPct: lastBody ? round(Math.min(100, lastBody.yPct + 2)) : 0,
        });
      } finally {
        page.cleanup();
      }
    }

    return {
      pageCount: doc.numPages,
      pageWidth: geometry.pageWidth,
      pageHeight: geometry.pageHeight,
      pages,
    };
  } finally {
    await doc.destroy();
  }
}
