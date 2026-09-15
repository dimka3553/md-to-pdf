import { NextResponse } from 'next/server';
import { corsHeaders } from '../cors.js';
import { scrapePage, validateUrl, sanitizeUrl } from './scraper.js';

/**
 * Shared GET handler for /api/scrape (markdown) and /api/scrapehtml (html).
 * Response shape is kept backwards compatible with the original API.
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

    try {
      const { content, title } = await scrapePage(sanitizedUrl, format);
      return NextResponse.json(
        {
          status: 'Ok',
          page: { url: sanitizedUrl, title, content },
          metadata: { duration: Date.now() - startTime, timestamp: new Date().toISOString() },
        },
        { status: 200, headers: corsHeaders },
      );
    } catch (err) {
      console.error(`[scrape:${format}] ${sanitizedUrl}:`, err.message);
      const msg = err.message || '';
      if (msg.includes('Failed to load page')) return error(502, `Failed to load the webpage: ${msg}`);
      if (/timeout/i.test(msg)) return error(504, 'The webpage took too long to load.');
      if (msg.includes('No content could be extracted')) return error(422, 'No readable content found on the webpage.');
      if (/Could not find|executablePath|Failed to launch/i.test(msg)) return error(500, 'The browser engine could not be started.');
      return error(500, 'An unexpected error occurred during scraping.');
    }
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function error(status, message) {
  return NextResponse.json({ status: 'Error', message }, { status, headers: corsHeaders });
}
