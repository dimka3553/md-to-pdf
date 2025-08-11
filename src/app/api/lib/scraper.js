import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { NodeHtmlMarkdown } from 'node-html-markdown';

// Remote Chromium executable path for Vercel (matches chromium-min v133)
const remoteExecutablePath = "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

export async function scrapePage(url, format = 'html') {
  let browser;
  
  try {
    console.log(`[scrapePage] Scraping ${url} with format: ${format}`);
    
    // Validate URL
    try {
      new URL(url);
    } catch (err) {
      throw new Error('Invalid URL provided');
    }

    const executablePath = await chromium.executablePath(remoteExecutablePath);

    browser = await puppeteerCore.launch({
      executablePath,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    }).catch(err => {
      throw new Error(`Failed to launch browser: ${err.message}`);
    });

    const page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    // Navigate to the page with proper error handling
    try {
      await page.goto(url, {
        waitUntil: ['networkidle2', 'domcontentloaded'],
        timeout: 30000
      });
    } catch (navigationError) {
      console.error(`[scrapePage] Navigation failed for ${url}:`, navigationError.message);
      throw new Error(`Failed to load page: ${navigationError.message}`);
    }

    // Wait for page to be fully loaded
    await page.waitForSelector('body', { timeout: 10000 });

    // Extract content from the page
    const content = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());
      
      // Remove common unwanted elements
      const unwanted = document.querySelectorAll(
        'nav, header, footer, aside, .advertisement, .ad, .ads, ' +
        '.cookie-banner, .popup, .modal, .overlay, .sidebar, ' +
        '.social-share, .related-posts, .comments'
      );
      unwanted.forEach(el => el.remove());

      // Try to find main content
      let mainContent = document.querySelector('main, article, .content, .post, .entry');
      
      // If no main content found, use body but clean it up
      if (!mainContent) {
        mainContent = document.body;
      }

      return mainContent ? mainContent.innerHTML : document.body.innerHTML;
    });

    await page.close();

    if (!content || content.trim() === '') {
      throw new Error('No content could be extracted from the page');
    }

    // Convert to markdown if requested
    if (format === 'md') {
      console.log(`[scrapePage] Converting HTML to Markdown for ${url}`);
      const markdown = NodeHtmlMarkdown.translate(content, {
        useInlineLinks: true,
        useLinkReferenceDefinitions: false,
        keepDataImages: false,
        maxConsecutiveNewlines: 2,
        bulletMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        strikeDelimiter: '~~'
      });
      
      return markdown;
    }

    console.log(`[scrapePage] Successfully scraped ${url} as HTML`);
    return content;

  } catch (error) {
    console.error(`[scrapePage] Error scraping ${url}:`, error);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn(`[scrapePage] Error closing browser:`, closeError.message);
      }
    }
  }
}

export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(url) {
  if (typeof url !== 'string') {
    throw new Error('URL must be a string');
  }
  
  try {
    const urlObj = new URL(decodeURIComponent(url));
    return urlObj.toString();
  } catch {
    throw new Error('Invalid URL format');
  }
}
