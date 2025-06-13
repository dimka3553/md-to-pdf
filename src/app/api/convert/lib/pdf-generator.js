import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

// Remote Chromium executable path for Vercel (matches chromium-min v133)
const remoteExecutablePath = "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

export async function generatePdf(styledHtml, paperSize) {
  try {
    const executablePath = await chromium.executablePath(remoteExecutablePath);

    const browser = await puppeteerCore.launch({
      executablePath,
      args: [...chromium.args, '--no-sandbox'],
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    }).catch(err => {
      throw new Error(`Failed to launch browser: ${err.message}. This might be due to:
        1. Chromium binary not found or corrupted
        2. Insufficient permissions to execute Chromium
        3. System resources (memory/CPU) constraints
        Details: ${err.stack}`);
    });

    const page = await browser.newPage();
    
    await page.setViewport({
      width: paperSize === 'A4' ? 794 : 1087,
      height: 1123,
      deviceScaleFactor: 2,
    });

    await page.setContent(styledHtml, {
      waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for fonts to load completely
    await page.evaluate(async () => {
      await document.fonts.ready;
      
      // Additional check for specific fonts
      const fontFaces = [
        'Inter', 'JetBrains Mono', 'Noto Sans', 
        'Noto Sans Mono', 'Noto Sans Symbols', 'Noto Sans Symbols 2'
      ];
      
      const fontPromises = fontFaces.map(fontFamily => {
        return document.fonts.load(`400 16px "${fontFamily}"`).catch(() => {
          // Ignore errors for fonts that might not be available
          console.warn(`Font ${fontFamily} could not be loaded, using fallback`);
        });
      });
      
      await Promise.allSettled(fontPromises);
      
      // Force a repaint to ensure font rendering
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';
    });

    // Add specific handler for image loading
    await page.evaluate(async () => {
      // Helper function to wait for all images
      const waitForAllImages = async () => {
        const images = Array.from(document.querySelectorAll('img'));
        if (images.length === 0) return;
        
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          
          return new Promise((resolve) => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', () => {
              // If image fails to load, add placeholder styling
              img.style.background = '#f0f0f0';
              img.style.display = 'block';
              img.style.minHeight = '150px';
              img.style.minWidth = '150px';
              img.style.position = 'relative';
              
              // Add placeholder text
              const parent = img.parentNode;
              const placeholder = document.createElement('div');
              placeholder.textContent = 'Image unavailable';
              placeholder.style.position = 'absolute';
              placeholder.style.top = '50%';
              placeholder.style.left = '50%';
              placeholder.style.transform = 'translate(-50%, -50%)';
              placeholder.style.color = '#666';
              placeholder.style.fontSize = '14px';
              parent.style.position = 'relative';
              parent.appendChild(placeholder);
              
              resolve();
            });
          });
        }));
      };
      
      await waitForAllImages();
      
      // Apply smart page break logic after images are loaded
      const PAGE_HEIGHT_PX = 1123; // A4 height in pixels at 96 DPI
      const TOP_MARGIN_PX = 40;
      const BOTTOM_MARGIN_PX = 50;
      const USABLE_PAGE_HEIGHT = PAGE_HEIGHT_PX - TOP_MARGIN_PX - BOTTOM_MARGIN_PX;
      const BREAK_THRESHOLD = 0.80; // Trigger break only when heading is within the bottom 20% of the usable page height
      
      const headings = document.querySelectorAll('.smart-break');
      let lastBreakPosition = 0;
      
      headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        const adjustedPosition = absoluteTop - lastBreakPosition;
        const positionInPage = (adjustedPosition % USABLE_PAGE_HEIGHT) / USABLE_PAGE_HEIGHT;
          
        // Only add a page break if the heading is actually going to be too close to the bottom of the page
        if (positionInPage > BREAK_THRESHOLD && positionInPage < 0.95) {
          // Check if there's already content above this heading
          let previousElement = heading.previousElementSibling;
          let hasContentBefore = false;
          
          // Look for actual content (not just breaks or empty elements)
          while (previousElement && !hasContentBefore) {
            // Skip other page break elements or empty divs
            if (!previousElement.classList.contains('page-break-before') && 
                !previousElement.classList.contains('position-tracker') &&
                previousElement.textContent.trim().length > 0) {
              hasContentBefore = true;
            }
            previousElement = previousElement.previousElementSibling;
          }
          
          // Only add a page break if there's actual content before this heading
          if (hasContentBefore) {
            const pageBreak = document.createElement('div');
            pageBreak.className = 'page-break-before';
            heading.parentNode.insertBefore(pageBreak, heading);
            lastBreakPosition = absoluteTop;
          }
        }
      });
      
      // Cleanup any consecutive page breaks (which can cause empty pages)
      const allBreaks = document.querySelectorAll('.page-break-before, .force-page-break');
      allBreaks.forEach(breakEl => {
        let nextEl = breakEl.nextElementSibling;
        // If the next element is also a break, remove the current one
        if (nextEl && (nextEl.classList.contains('page-break-before') || nextEl.classList.contains('force-page-break'))) {
          breakEl.parentNode.removeChild(breakEl);
        }
        
        // If there's no content after this break before the end of document, remove it
        let hasContentAfter = false;
        while (nextEl) {
          if (nextEl.textContent.trim().length > 0) {
            hasContentAfter = true;
            break;
          }
          nextEl = nextEl.nextElementSibling;
        }
        
        if (!hasContentAfter) {
          breakEl.parentNode.removeChild(breakEl);
        }
      });
    });

    // Wait for page break logic to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF with specific settings
    const pdf = await page.pdf({
      format: paperSize,
      margin: {
        top: '40px',
        right: '40px',
        bottom: '50px',
        left: '40px'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; text-align: center; color: #999; padding: 0 20px; font-family: 'Inter', sans-serif;">
          <span class="pageNumber"></span>
        </div>
      `,
      printBackground: true,
      preferCSSPageSize: true,
      omitBackground: false
    });

    await page.close();
    await browser.close();

    return pdf;

  } catch (browserError) {
    console.error('Browser initialization error:', browserError);
    throw new Error(`PDF Generation Failed: ${browserError.message}`);
  }
} 