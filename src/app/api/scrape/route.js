import { NextResponse } from 'next/server';
import { scrapePage, validateUrl, sanitizeUrl } from '../lib/scraper.js';
import { corsHeaders } from '../convert/lib/utils.js';

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const noCache = searchParams.get('noCache') === 'true';

    console.log(`[/api/scrape] Incoming request for URL: ${url}, noCache: ${noCache}`);

    // Validate URL parameter
    if (!url) {
      console.error('[/api/scrape] No URL provided');
      return NextResponse.json(
        { status: 'Error', message: 'No url provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!validateUrl(url)) {
      console.error(`[/api/scrape] Invalid URL: ${url}`);
      return NextResponse.json(
        { status: 'Error', message: 'Invalid url format' },
        { status: 400, headers: corsHeaders }
      );
    }

    let sanitizedUrl;
    try {
      sanitizedUrl = sanitizeUrl(url);
    } catch (sanitizeError) {
      console.error(`[/api/scrape] URL sanitization failed: ${sanitizeError.message}`);
      return NextResponse.json(
        { status: 'Error', message: `Invalid url: ${sanitizeError.message}` },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[/api/scrape] Scraping ${sanitizedUrl} for markdown conversion`);

    // Scrape the page and convert to markdown
    const markdown = await scrapePage(sanitizedUrl, 'md');

    const duration = Date.now() - startTime;
    console.log(`[/api/scrape] Successfully scraped ${sanitizedUrl} in ${duration}ms`);

    return NextResponse.json(
      {
        status: 'Ok',
        page: {
          url: sanitizedUrl,
          content: markdown
        },
        metadata: {
          duration,
          timestamp: new Date().toISOString()
        }
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[/api/scrape] Error after ${duration}ms:`, {
      message: error.message,
      stack: error.stack
    });

    let errorMessage = 'An unexpected error occurred during scraping.';
    let statusCode = 500;

    if (error.message.includes('Failed to load page')) {
      errorMessage = `Failed to load the webpage: ${error.message}`;
      statusCode = 502;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout: The webpage took too long to load.';
      statusCode = 504;
    } else if (error.message.includes('No content could be extracted')) {
      errorMessage = 'No readable content found on the webpage.';
      statusCode = 422;
    } else if (error.message.includes('Invalid URL')) {
      errorMessage = error.message;
      statusCode = 400;
    }

    return NextResponse.json(
      {
        status: 'Error',
        message: errorMessage,
        details: {
          originalError: error.message,
          duration,
          timestamp: new Date().toISOString()
        }
      },
      { status: statusCode, headers: corsHeaders }
    );
  }
}
