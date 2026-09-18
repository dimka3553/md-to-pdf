/**
 * Chrome's PDF backend (Skia) can only embed static TrueType. Google Fonts
 * served to a browser is WOFF2 (often variable), which Skia converts to Type 3
 * outline fonts. macOS Preview then copy-pastes those as broken runs
 * ("O / fficial / file"). Fetch the same families as .ttf in Node, inline them,
 * and Chromium embeds CIDFontType2 with working ToUnicode.
 */

const GOOGLE_CSS_RE = /<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)">/;
const PRECONNECT_RE = /<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>/g;
const TTF_URL_RE = /url\((['"]?)(https:\/\/fonts\.gstatic\.com\/[^)'"]+\.ttf)\1\)/g;
const TTF_UA = 'MarkdownStudio/1.0';
const FETCH_MS = 8_000;
const MAX_FACES = 16;
const MAX_TTF_BYTES = 1.5 * 1024 * 1024;

/** @type {Map<string, Promise<string>>} */
const cache = new Map();

function isTtf(buf) {
  if (!buf || buf.length < 4) return false;
  const tag = buf.toString('ascii', 0, 4);
  return tag === 'true' || tag === 'OTTO' || (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00);
}

async function fetchOk(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

async function buildPrintFontCss(cssUrl) {
  const sheet = await (await fetchOk(cssUrl, { headers: { 'User-Agent': TTF_UA } })).text();
  const urls = [...new Set([...sheet.matchAll(TTF_URL_RE)].map((m) => m[2]))];
  if (!urls.length) throw new Error('Google Fonts CSS did not list TrueType files');
  if (urls.length > MAX_FACES) throw new Error(`Too many font files (${urls.length})`);

  const files = await Promise.all(
    urls.map(async (url) => {
      const buf = Buffer.from(await (await fetchOk(url, { headers: { 'User-Agent': TTF_UA } })).arrayBuffer());
      if (buf.length > MAX_TTF_BYTES) throw new Error(`Font file too large: ${url}`);
      if (!isTtf(buf)) throw new Error(`Not a TrueType font: ${url}`);
      return [url, `data:font/ttf;base64,${buf.toString('base64')}`];
    }),
  );
  const dataUrls = new Map(files);
  const css = sheet.replace(TTF_URL_RE, (_, _q, url) => `url(${dataUrls.get(url)})`);
  if (css.includes('fonts.gstatic.com')) throw new Error('Uninlined font URL remains in CSS');
  return css;
}

function printFontCss(cssUrl) {
  let pending = cache.get(cssUrl);
  if (!pending) {
    pending = buildPrintFontCss(cssUrl).catch((err) => {
      cache.delete(cssUrl);
      throw err;
    });
    cache.set(cssUrl, pending);
  }
  return pending;
}

/**
 * Replace the Google Fonts stylesheet in a PDF HTML document with inlined TTF
 * @font-face rules. On fetch failure, returns the original HTML.
 * @param {string} html
 */
export async function withPrintableFonts(html) {
  const match = html.match(GOOGLE_CSS_RE);
  if (!match) return html;
  try {
    const css = await printFontCss(match[1]);
    return html.replace(PRECONNECT_RE, '').replace(GOOGLE_CSS_RE, `<style data-print-fonts="1">${css}</style>`);
  } catch (err) {
    console.warn('[pdf] printable fonts unavailable, copy-paste may be broken:', err.message);
    return html;
  }
}
