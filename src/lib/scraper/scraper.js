import { withBrowser } from '../pdf/browser.js';
import { extractPageDocument } from './page-script.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

/** Options accepted by {@link scrapePage}, the REST handler and the MCP tool. */
export const SCRAPE_OPTION_DEFAULTS = Object.freeze({ stripImages: false, stripLinks: false });

/** Time budget (ms). Vercel functions are capped at 60 s, so the whole run has to fit well inside that. */
const TIMEOUTS = Object.freeze({ navigation: 20_000, networkIdle: 8_000, content: 6_000, scroll: 4_000, settle: 3_000 });

/** Third parties that only ever slow a page down (analytics, ads, consent walls, chat widgets). */
const BLOCKED_HOSTS =
  /(?:^|\.)(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google\.\w+|facebook\.net|connect\.facebook\.com|hotjar\.com|segment\.(?:io|com)|intercom(?:cdn)?\.(?:io|com)|fullstory\.com|mixpanel\.com|amplitude\.com|sentry\.io|newrelic\.com|nr-data\.net|optimizely\.com|criteo\.(?:com|net)|taboola\.com|outbrain\.com|quantserve\.com|scorecardresearch\.com|chartbeat\.com|onetrust\.com|cookielaw\.org|cookiebot\.com|trustarc\.com|consensu\.org|adnxs\.com|rubiconproject\.com|pubmatic\.com|openx\.net|moatads\.com|disqus\.com|disquscdn\.com|crisp\.chat|drift\.com|zdassets\.com|tawk\.to|hubspot\.com|hs-scripts\.com|clarity\.ms|bat\.bing\.com|snap\.licdn\.com|ads-twitter\.com|t\.co|branch\.io|braze\.com|klaviyo\.com|mailchimp\.com|list-manage\.com|sumo\.com|addthis\.com|sharethis\.com)$/i;
const BLOCKED_TYPES = new Set(['font', 'media', 'texttrack', 'manifest', 'ping', 'eventsource', 'websocket']);

/**
 * @typedef {Object} ScrapeResult
 * @property {string} content   Markdown or HTML of the main content
 * @property {string} title     Page title with the site-name suffix removed
 * @property {string} description  Meta description / og:description
 * @property {string} siteName  og:site_name or the hostname
 * @property {string} author    Byline from meta tags / JSON-LD when available
 * @property {string} published ISO-ish publish date from meta tags / JSON-LD when available
 * @property {string} canonical Canonical URL (falls back to the requested URL)
 * @property {string} lang      Document language (`<html lang>`), may be empty
 * @property {'article'|'page'} mode  Whether a single content column was isolated or the whole page was kept
 */

/**
 * Render a web page in headless Chromium — waiting for its JavaScript, scrolling
 * so lazy content loads — then strip the chrome and convert what is actually
 * visible into GitHub-flavoured Markdown (or cleaned HTML) plus metadata.
 * @param {string} url
 * @param {'html'|'md'} format
 * @param {{ stripImages?: boolean, stripLinks?: boolean }} [options]
 * @returns {Promise<ScrapeResult>}
 */
export async function scrapePage(url, format = 'html', options = {}) {
  const opts = { ...SCRAPE_OPTION_DEFAULTS, ...options };
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await preparePage(page);

    let response;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    } catch (err) {
      throw new Error(`Failed to load page: ${err.message}`);
    }
    const status = response ? response.status() : 200;
    if (status >= 400 && status !== 999) {
      // Some sites answer 403/503 to a challenge page but still serve content; only bail when the body is empty-ish.
      const textLength = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length).catch(() => 0);
      if (textLength < 400) throw new Error(`Failed to load page: HTTP ${status}`);
    }

    await settle(page);

    const extracted = await page.evaluate(extractPageDocument, { stripImages: opts.stripImages, stripLinks: opts.stripLinks, html: format === 'html' });

    if (extracted.error) {
      const visible = extracted.visibleText || '';
      if (/just a moment|attention required|access denied|verify you are human|enable javascript and cookies|captcha|are you a robot/i.test(`${extracted.title} ${visible}`)) {
        throw new Error('Blocked: the site is protecting itself against automated access');
      }
      throw new Error('No content could be extracted from the page');
    }

    const { markdown, html, headline: _headline, trace: _trace, ...meta } = extracted;

    if (format === 'md') {
      const content = tidyMarkdown(markdown, opts);
      if (!content) throw new Error('No content could be extracted from the page');
      return { content, ...meta };
    }

    if (!html || !html.trim()) throw new Error('No content could be extracted from the page');
    return { content: html, ...meta };
  });
}

/** Realistic desktop client, dialogs auto-dismissed, trackers and heavy media never requested. */
async function preparePage(page) {
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  page.setDefaultTimeout(TIMEOUTS.navigation);
  page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    try {
      if (BLOCKED_TYPES.has(request.resourceType())) return request.abort();
      const host = new URL(request.url()).hostname;
      if (BLOCKED_HOSTS.test(host)) return request.abort();
      return request.continue();
    } catch {
      return request.continue().catch(() => {});
    }
  });
}

/**
 * Give client-side rendering a chance: wait for the network to go quiet, for
 * the body to contain real text, scroll through the page so lazy-loaded
 * images/sections mount, then go back to the top so geometry is measured
 * from a known scroll position.
 */
async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 600, timeout: TIMEOUTS.networkIdle }).catch(() => {});
  await page
    .waitForFunction(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length > 300, { timeout: TIMEOUTS.content, polling: 200 })
    .catch(() => {});
  await autoScroll(page, TIMEOUTS.scroll);
  await page.waitForNetworkIdle({ idleTime: 500, timeout: TIMEOUTS.settle }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function autoScroll(page, budgetMs) {
  await page
    .evaluate(async (budget) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const started = Date.now();
      // Some SPAs scroll an inner container rather than the window.
      const scrollers = [];
      for (const el of document.querySelectorAll('body *')) {
        if (scrollers.length >= 3) break;
        const s = getComputedStyle(el);
        if (!/(auto|scroll)/.test(s.overflowY)) continue;
        const r = el.getBoundingClientRect();
        if (r.height >= innerHeight * 0.5 && r.width >= innerWidth * 0.4 && el.scrollHeight > el.clientHeight + 200) scrollers.push(el);
      }
      const step = Math.max(400, Math.floor(innerHeight * 0.85));
      let y = 0;
      let lastHeight = 0;
      let stable = 0;
      while (Date.now() - started < budget) {
        const height = Math.min(document.documentElement.scrollHeight, 60_000);
        y = Math.min(y + step, height);
        window.scrollTo(0, y);
        for (const el of scrollers) el.scrollTop = Math.min(el.scrollTop + step, el.scrollHeight);
        await sleep(110);
        if (y >= height) {
          stable = height === lastHeight ? stable + 1 : 0;
          if (stable >= 2 || height >= 60_000) break;
        }
        lastHeight = height;
      }
      // Back to the top so geometry is measured from a known position.
      for (const el of scrollers) el.scrollTop = 0;
      window.scrollTo(0, 0);
    }, budgetMs)
    .catch(() => {});
}

/**
 * Post-process converted Markdown: drop empty links/images, tighten callouts
 * and collapse runs of blank lines. Trailing backslashes (hard breaks) are kept.
 */
export function tidyMarkdown(markdown, opts = {}) {
  let out = String(markdown || '').replace(/\r\n?/g, '\n');
  if (opts.stripImages) out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  if (opts.stripLinks) out = out.replace(/(^|[^!])\[([^\]]+)\]\([^)]*\)/g, '$1$2');
  return out
    .replace(/(^|[^!])\[\s*\]\([^)]*\)/gm, '$1') // empty anchors (but not images with an empty alt)
    .replace(/!\[[^\]]*\]\(\s*\)/g, '') // images without a source
    .replace(/^> \[!(\w+)\]\n>\n/gm, '> [!$1]\n') // "> [!NOTE]" directly followed by its body
    .replace(/[ \t]+$/gm, '')
    .replace(/^(\*\*|\*|~~)\s*\1$/gm, '') // emphasis left empty by removals
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
  if (/^Blocked:/.test(msg)) return { status: 403, message: 'The site blocked automated access (bot protection or a CAPTCHA). Try a different URL for the same content, such as an AMP or print version.' };
  if (/Failed to load page: HTTP (\d+)/.test(msg)) {
    const code = msg.match(/HTTP (\d+)/)[1];
    return { status: 502, message: `The webpage responded with HTTP ${code}.` };
  }
  if (msg.includes('Failed to load page')) return { status: 502, message: `Failed to load the webpage: ${msg.replace('Failed to load page: ', '')}` };
  if (/timeout/i.test(msg)) return { status: 504, message: 'The webpage took too long to load. Try again, or try a lighter page.' };
  if (msg.includes('No content could be extracted')) return { status: 422, message: 'No readable content found on the webpage. It may require sign-in, or the content may live inside an embedded frame.' };
  if (/Could not find|executablePath|Failed to launch|spawn/i.test(msg)) return { status: 500, message: 'The browser engine could not be started.' };
  return { status: 500, message: 'An unexpected error occurred during scraping.' };
}
