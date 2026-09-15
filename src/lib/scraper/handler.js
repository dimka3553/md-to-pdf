import { NextResponse } from 'next/server';
import { corsHeaders } from '../cors.js';
import { describeScrapeError, parseFlag, scrapePage, validateUrl, sanitizeUrl } from './scraper.js';

/**
 * Shared GET handler for /api/scrape (markdown) and /api/scrapehtml (html).
 *
 *   GET /api/scrape?url=https://…[&images=false][&links=false]
 *
 * Response shape is kept backwards compatible with the original API; the
 * `page` object gained `description`, `siteName`, `author`, `published` and
 * `canonical`, and `metadata` reports the options that were applied.
 */
export function createScrapeHandler(format) {
  return async function GET(request) {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) return error(400, 'No url provided');
    if (!validateUrl(url)) return error(400, 'Invalid url format');

    let sanitizedUrl;
    try {
      sanitizedUrl = sanitizeUrl(url);
    } catch (err) {
      return error(400, `Invalid url: ${err.message}`);
    }
    if (!validateUrl(sanitizedUrl)) return error(400, 'Invalid url format');

    const options = {
      stripImages: !parseFlag(searchParams.get('images'), true),
      stripLinks: !parseFlag(searchParams.get('links'), true),
    };

    try {
      const { content, ...meta } = await scrapePage(sanitizedUrl, format, options);
      return NextResponse.json(
        {
          status: 'Ok',
          page: { url: sanitizedUrl, ...meta, content },
          metadata: { format: format === 'md' ? 'markdown' : 'html', options, duration: Date.now() - startTime, timestamp: new Date().toISOString() },
        },
        { status: 200, headers: corsHeaders },
      );
    } catch (err) {
      console.error(`[scrape:${format}] ${sanitizedUrl}:`, err.message);
      const { status, message } = describeScrapeError(err);
      return error(status, message);
    }
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function error(status, message) {
  return NextResponse.json({ status: 'Error', message }, { status, headers: corsHeaders });
}
