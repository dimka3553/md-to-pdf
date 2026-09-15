import { NodeHtmlMarkdown } from 'node-html-markdown';
import { launchBrowser } from '../pdf/browser.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

/** Options accepted by {@link scrapePage}, the REST handler and the MCP tool. */
export const SCRAPE_OPTION_DEFAULTS = Object.freeze({ stripImages: false, stripLinks: false });

/**
 * @typedef {Object} ScrapeResult
 * @property {string} content   Markdown or HTML of the main content
 * @property {string} title     Page <title> (or og:title)
 * @property {string} description  Meta description / og:description
 * @property {string} siteName  og:site_name or the hostname
 * @property {string} author    Byline from meta tags when available
 * @property {string} published ISO-ish publish date from meta tags when available
 * @property {string} canonical Canonical URL (falls back to the requested URL)
 */

/**
 * Fetch a web page in headless Chromium, strip chrome (nav/ads/etc.) and
 * return the main content as HTML or Markdown plus page metadata.
 * @param {string} url
 * @param {'html'|'md'} format
 * @param {{ stripImages?: boolean, stripLinks?: boolean }} [options]
 * @returns {Promise<ScrapeResult>}
 */
export async function scrapePage(url, format = 'html', options = {}) {
  const opts = { ...SCRAPE_OPTION_DEFAULTS, ...options };
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    try {
      await page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 30_000 });
    } catch (err) {
      throw new Error(`Failed to load page: ${err.message}`);
    }

    const extracted = await page.evaluate((o) => {
      const meta = (...names) => {
        for (const n of names) {
          const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
          const v = el?.getAttribute('content')?.trim();
          if (v) return v;
        }
        return '';
      };
      const title = meta('og:title') || document.title || '';
      const description = meta('description', 'og:description', 'twitter:description');
      const siteName = meta('og:site_name') || location.hostname.replace(/^www\./, '');
      const author = meta('author', 'article:author', 'parsely-author', 'byl');
      const published = meta('article:published_time', 'datePublished', 'date', 'parsely-pub-date') || document.querySelector('time[datetime]')?.getAttribute('datetime') || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;

      document.querySelectorAll('script, style, noscript, iframe, svg, form, button, input, video, audio, canvas').forEach((el) => el.remove());
      document
        .querySelectorAll(
          'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], ' +
            '.advertisement, .ad, .ads, .cookie-banner, .popup, .modal, .overlay, .sidebar, .social-share, .share, .related-posts, .comments, .newsletter, .breadcrumbs, .toc, .table-of-contents',
        )
        .forEach((el) => el.remove());

      if (o.stripImages) document.querySelectorAll('img, picture, figure > img').forEach((el) => el.remove());
      if (o.stripLinks) {
        document.querySelectorAll('a[href]').forEach((a) => {
          const span = document.createElement('span');
          span.innerHTML = a.innerHTML;
          a.replaceWith(span);
        });
      }

      // Make relative links & images absolute so the markdown is portable.
      document.querySelectorAll('a[href]').forEach((a) => a.setAttribute('href', a.href));
      document.querySelectorAll('img[src]').forEach((img) => img.setAttribute('src', img.currentSrc || img.src));
      // Lazy-loaded images often keep the real URL in data-src.
      document.querySelectorAll('img[data-src]:not([src])').forEach((img) => img.setAttribute('src', new URL(img.getAttribute('data-src'), location.href).href));

      const main = document.querySelector('main, article, [role="main"], .content, .post, .entry, #content') || document.body;
      return { html: main ? main.innerHTML : '', title, description, siteName, author, published, canonical };
    }, opts);

    const { html, ...meta } = extracted;
    if (!html || !html.trim()) throw new Error('No content could be extracted from the page');

    if (format === 'md') {
      let markdown = NodeHtmlMarkdown.translate(html, {
        useInlineLinks: true,
        useLinkReferenceDefinitions: false,
        keepDataImages: false,
        maxConsecutiveNewlines: 2,
        bulletMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        strikeDelimiter: '~~',
      });
      markdown = tidyMarkdown(markdown, opts);
      const withTitle = meta.title && !/^#\s/m.test(markdown) ? `# ${meta.title.trim()}\n\n${markdown}` : markdown;
      return { content: withTitle.trim(), ...meta };
    }

    return { content: html, ...meta };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Post-process converted Markdown: drop empty links/images left behind by the
 * DOM clean-up and collapse runs of blank lines.
 */
export function tidyMarkdown(markdown, opts = {}) {
  let out = String(markdown || '');
  if (opts.stripImages) out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  if (opts.stripLinks) out = out.replace(/(^|[^!])\[([^\]]+)\]\([^)]*\)/g, '$1$2');
  return out
    .replace(/\[\s*\]\([^)]*\)/g, '') // empty anchors
    .replace(/!\[[^\]]*\]\(\s*\)/g, '') // images without a source
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse a boolean-ish query/tool value ("1", "true", "yes" → true). */
export function parseFlag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

export function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    // Block obvious SSRF targets.
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === '::1' || host === '[::1]') return false;
    return true;
  } catch {
    return false;
  }
}

export function sanitizeUrl(url) {
  if (typeof url !== 'string') throw new Error('URL must be a string');
  try {
    return new URL(url).toString();
  } catch {
    try {
      return new URL(decodeURIComponent(url)).toString();
    } catch {
      throw new Error('Invalid URL format');
    }
  }
}

/** Map a scraper error to an HTTP-ish status and a user-facing message. */
export function describeScrapeError(err) {
  const msg = err?.message || '';
  if (msg.includes('Failed to load page')) return { status: 502, message: `Failed to load the webpage: ${msg.replace('Failed to load page: ', '')}` };
  if (/timeout/i.test(msg)) return { status: 504, message: 'The webpage took too long to load. Try again, or try a lighter page.' };
  if (msg.includes('No content could be extracted')) return { status: 422, message: 'No readable content found on the webpage. It may require sign-in or render entirely with JavaScript.' };
  if (/Could not find|executablePath|Failed to launch|spawn/i.test(msg)) return { status: 500, message: 'The browser engine could not be started.' };
  return { status: 500, message: 'An unexpected error occurred during scraping.' };
}
