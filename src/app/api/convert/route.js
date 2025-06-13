import { NextResponse } from 'next/server';
import { lightTheme, darkTheme } from './lib/themes.js';
import { processHtml, processFootnotes, processMarkdown } from './lib/markdown-processor.js';
import { generateStyledHtml } from './lib/html-generator.js';
import { generatePdf } from './lib/pdf-generator.js';
import { corsHeaders } from './lib/utils.js';

// Track footnotes globally
let footnotes = {};
let footnoteCounter = 0;

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { markdown: markdownContent, theme: selectedTheme = 'light', paperSize = 'A4' } = data;

    if (!markdownContent) {
      return NextResponse.json(
        { error: "Markdown content is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Reset footnotes for this conversion
    footnotes = {};
    footnoteCounter = 0;
    
    // Process footnotes in markdown text
    const processedWithReferences = processFootnotes(markdownContent, footnotes);

    // Select theme based on user choice
    const theme = selectedTheme === 'dark' ? darkTheme : lightTheme;

    // Process markdown to HTML
    console.log('[POST] Original Markdown (first 200 chars):', markdownContent.substring(0,200) + (markdownContent.length > 200 ? "..." : ""));
    let html = processMarkdown(processedWithReferences || markdownContent);
    console.log('[POST] HTML after marked.parse (first 500 chars):', html.substring(0,500) + (html.length > 500 ? "..." : ""));
    
    // Process footnotes if there are any
    if (Object.keys(footnotes).length > 0) {
      // Add footnotes section at the end of the document
      let footnotesHtml = '<div class="footnotes"><hr><ol class="footnote-list">';
      
      // Sort footnote refs numerically
      const sortedRefs = Object.keys(footnotes).sort((a, b) => parseInt(a) - parseInt(b));
      
      // Create list items for each footnote in order
      sortedRefs.forEach(ref => {
        footnotesHtml += `<li id="footnote-${ref}" class="footnote-item" data-number="${ref}">
          ${footnotes[ref]} <a href="#footnote-ref-${ref}" class="footnote-backref" aria-label="Back to content">↩</a>
        </li>`;
      });
      
      footnotesHtml += '</ol></div>';
      
      // Append footnotes section to the document
      html += footnotesHtml;
      
      // Reset footnotes object for next conversion
      footnotes = [];
      footnoteCounter = 0;
    }
    
    html = processHtml(html);
    console.log('[POST] HTML after processHtml (first 500 chars):', html.substring(0,500) + (html.length > 500 ? "..." : ""));

    // Create the complete HTML document with custom styling
    const styledHtml = generateStyledHtml(html, theme, paperSize);

    // Generate PDF
    const pdf = await generatePdf(styledHtml, paperSize);

    // Create response with proper headers including CORS
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdf.length.toString(),
        'Content-Disposition': 'attachment; filename="document.pdf"',
        'Cache-Control': 'no-cache',
        ...corsHeaders
      },
    });

  } catch (error) {
    console.error('PDF generation error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      syscall: error.syscall,
      errno: error.errno
    });

    let errorMessage = 'An unexpected error occurred during PDF generation.';
    let errorType = 'UNKNOWN_ERROR';

    if (error.code === 'Unknown system error -8') {
      errorMessage = `Failed to spawn Chromium process. This might be due to:
        1. Insufficient system permissions
        2. Memory constraints
        3. Incompatible Chromium version (currently using v133)
        4. System resource limitations`;
      errorType = 'CHROMIUM_SPAWN_ERROR';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Required file or directory not found. Check if Chromium is properly installed.';
      errorType = 'FILE_NOT_FOUND';
    } else if (error instanceof SyntaxError) {
      errorMessage = 'Invalid JSON input received.';
      errorType = 'INVALID_INPUT';
    }

    return NextResponse.json({
      error: errorMessage,
      type: errorType,
      details: {
        originalError: error.message,
        code: error.code,
        syscall: error.syscall,
        timestamp: new Date().toISOString()
      }
    }, { status: 500, headers: corsHeaders });
  }
}
