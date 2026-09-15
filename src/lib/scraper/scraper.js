import { NodeHtmlMarkdown } from 'node-html-markdown';
import { launchBrowser } from '../pdf/browser.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

/**
 * Fetch a web page in headless Chromium, strip chrome (nav/ads/etc.) and
 * return the main content as HTML or Markdown.
 * @param {string} url
 * @param {'html'|'md'} format
 * @returns {Promise<{ content: string, title: string }>}
 */
export async function scrapePage(url, format = 'html') {
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

    const { html, title } = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, iframe, svg, form, button, input').forEach((el) => el.remove());
      document
        .querySelectorAll(
          'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], ' +
            '.advertisement, .ad, .ads, .cookie-banner, .popup, .modal, .overlay, .sidebar, .social-share, .related-posts, .comments, .newsletter',
        )
        .forEach((el) => el.remove());

      // Make relative links & images absolute so the markdown is portable.
      document.querySelectorAll('a[href]').forEach((a) => a.setAttribute('href', a.href));
      document.querySelectorAll('img[src]').forEach((img) => img.setAttribute('src', img.currentSrc || img.src));

      const main = document.querySelector('main, article, [role="main"], .content, .post, .entry, #content') || document.body;
      return { html: main ? main.innerHTML : '', title: document.title || '' };
    });

    if (!html || !html.trim()) throw new Error('No content could be extracted from the page');

    if (format === 'md') {
      const markdown = NodeHtmlMarkdown.translate(html, {
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
      const withTitle = title && !/^#\s/m.test(markdown) ? `# ${title.trim()}\n\n${markdown}` : markdown;
      return { content: withTitle.trim(), title };
    }

    return { content: html, title };
  } finally {
    await browser.close().catch(() => {});
  }
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
