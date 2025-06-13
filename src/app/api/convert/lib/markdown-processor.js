import { marked } from 'marked';
import hljs from 'highlight.js';
import twemoji from 'twemoji';
import { escapeHtml, slugify } from './utils.js';

// Safely highlight code with proper error handling
function safeHighlight(code, language) {
  // Basic safety checks
  if (code === null || code === undefined) {
    console.log('[safeHighlight] Input code is null or undefined. Returning empty string.');
    return '';
  }
  
  const codeStr = String(code); // Ensure code is a string
  console.log(`[safeHighlight] Input code (len: ${codeStr.length}, lang: ${language}): "${codeStr.substring(0, 70).replace(/\n/g, '\\n')}..."`);
  
  // Skip highlighting if no language is specified - safer than auto-detection
  if (!language || language.trim() === '') {
    const escaped = escapeHtml(codeStr);
    console.log(`[safeHighlight] No language, returning escaped (len: ${escaped.length}): "${escaped.substring(0, 70).replace(/\n/g, '\\n')}..."`);
    return escaped;
  }
  
  try {
    // Only attempt specific language highlighting if language is provided
    const result = hljs.highlight(codeStr, { language, ignoreIllegals: true });
    if (result && typeof result.value === 'string') {
      console.log(`[safeHighlight] Highlight success (lang: ${language}, val len: ${result.value.length}): "${result.value.substring(0, 70).replace(/\n/g, '\\n')}..."`);
      return result.value;
    }
    console.warn(`[safeHighlight] Highlight.js returned no value for lang: ${language}, code snippet: "${codeStr.substring(0, 70).replace(/\n/g, '\\n')}..."`);
  } catch (err) {
    console.warn(`[safeHighlight] Highlight.js error for lang ${language}:`, err.message, `code snippet: "${codeStr.substring(0, 70).replace(/\n/g, '\\n')}..."`);
  }
  
  // Always fall back to escaped code
  const fallbackEscaped = escapeHtml(codeStr);
  console.log(`[safeHighlight] Fallback, returning escaped (len: ${fallbackEscaped.length}): "${fallbackEscaped.substring(0, 70).replace(/\n/g, '\\n')}..."`);
  return fallbackEscaped;
}

// Custom renderer to handle equations and special formatting
const renderer = new marked.Renderer();

// Track used IDs to avoid duplicates
const usedIds = {};

// Override heading renderer to add smart page breaks
renderer.heading = function(text, level, raw, slugger) {
  // Handle both old and new versions of marked
  let headingText = '';
  let headingLevel = 1;
  
  // Check if using marked v9+ (where first arg is a token object)
  if (arguments.length === 1 && typeof text === 'object' && text !== null) {
    const token = text;
    headingLevel = token.depth || 1;
    // Get the text content safely
    headingText = token.text || '';
    
    // If we have tokens, use those (safer)
    if (token.tokens && Array.isArray(token.tokens)) {
      // Extract plain text for slug generation without HTML
      headingText = token.tokens.map(t => t.text || '').join('');
    }
  } else {
    // Using older marked version
    headingText = String(text || '');
    headingLevel = level || 1;
  }

  // Safety check - ensure text is a string
  if (typeof headingText !== 'string') {
    headingText = String(headingText || '');
  }
  
  // Clean text for slug/id generation
  const cleanText = headingText
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, '')
    .trim();

  // Build a unique, URL-friendly ID
  let id = slugify(cleanText);
  let uniqueId = id;
  let count = 0;
  while (usedIds[uniqueId]) {
    count++;
    uniqueId = `${id}-${count}`;
  }
  usedIds[uniqueId] = true;
  id = uniqueId;

  // Determine classes for styling
  let headingClass = '';
  let pageBreak = '';
  
  if (headingLevel <= 2) {
    headingClass = ` class="${headingLevel === 1 ? 'chapter-heading' : 'section-heading'} smart-break"`;
    pageBreak = `<div class="position-tracker"></div>`;
  } else if (headingLevel === 3) {
    headingClass = ' class="subsection-heading"';
  }

  // For new marked versions, we need to send the inner HTML 
  // For old versions, we send the text as-is
  const innerContent = arguments.length === 1 && typeof text === 'object' && text !== null && this && this.parser ? 
    this.parser.parseInline(text.tokens || [{ type: 'text', text: String(text.text || '') }]) : 
    String(text || '');

  return `${pageBreak}<h${headingLevel} id="${id}"${headingClass}>${innerContent}</h${headingLevel}>`;
};

// Code block renderer with proper escaping and highlighting
renderer.code = function(tokenOrCode, infoStringOrLang, escaped) {
  let codeText = '';
  let language = '';
  let title = '';
  let isToken = false;

  if (typeof tokenOrCode === 'object' && tokenOrCode !== null && tokenOrCode.text !== undefined) {
    isToken = true;
    const token = tokenOrCode;
    codeText = token.text || '';
    language = (token.lang || '').trim().toLowerCase();
    const actualInfoString = typeof infoStringOrLang === 'string' ? infoStringOrLang : (token.params || ''); // token.params for fenced code attributes
    
    console.log(`[renderer.code] Received TOKEN. text (len: ${codeText.length}): "${codeText.substring(0,70).replace(/\n/g, '\\n')}...", token.lang: "${language}", full infoString/params: "${actualInfoString}"`);

    if (actualInfoString) {
      const parts = actualInfoString.split(':');
      const langFromInfo = parts[0].trim().toLowerCase();
      if (!language && langFromInfo) { // If token.lang was empty, use from info string
        language = langFromInfo;
      } else if (language && langFromInfo && language !== langFromInfo) {
        // This case might indicate language in ```lang and lang:title mismatch. Prioritize token.lang.
        console.warn(`[renderer.code] Mismatch: token.lang ("${language}") vs infoString lang ("${langFromInfo}"). Using token.lang.`);
      }
      if (parts.length > 1) {
        title = parts.slice(1).join(':').trim();
      } else if (!language && !title && langFromInfo) { 
        // If no colon, and language still not set, the whole string might be the language
        language = langFromInfo;
      }
    }
  } else if (typeof tokenOrCode === 'string') {
    codeText = tokenOrCode;
    const langFromInfo = typeof infoStringOrLang === 'string' ? infoStringOrLang : '';
    // For indented code, the entire infoStringOrLang is the language, no title parsing.
    language = langFromInfo.trim().toLowerCase();
    console.log(`[renderer.code] Received STRING code. text (len: ${codeText.length}): "${codeText.substring(0,70).replace(/\n/g, '\\n')}...", lang from infostring: "${language}"`);
  } else {
    console.error('[renderer.code] Received UNEXPECTED type for code arg:', tokenOrCode);
    // Fallback to prevent error, but this should be investigated if it occurs
    codeText = String(tokenOrCode || ''); 
    language = '';
  }
  
  language = language || ''; // Ensure language is always a string

  console.log(`[renderer.code] FINAlIZED for highlight: lang="${language}", title="${title}", code (len: ${codeText.length}): "${codeText.substring(0,70).replace(/\n/g, '\\n')}..."`);

  // Use the highlight function provided in marked's options.
  // this.options.highlight will call our safeHighlight via the setup in marked.setOptions.
  const highlightedCode = this.options.highlight ? this.options.highlight(codeText, language) : escapeHtml(codeText);
  // `highlightedCode` is now HTML (if highlighting worked) or an HTML-escaped string.
  
  console.log(`[renderer.code] Output from highlight fn (len: ${highlightedCode.length}): "${highlightedCode.substring(0, 70).replace(/\n/g, '\\n')}..."`);

  let titleDisplayString = '';
  const escapedLang = language && language.toLowerCase() !== 'none' && language.trim() !== '' ? escapeHtml(language) : '';
  const escapedTitle = title ? escapeHtml(title) : '';

  if (escapedTitle && escapedLang) {
    titleDisplayString = `${escapedTitle} (${escapedLang})`;
  } else if (escapedTitle) {
    titleDisplayString = escapedTitle;
  } else if (escapedLang) {
    titleDisplayString = escapedLang;
  }

  const titleHtml = titleDisplayString ? `<div class="code-title">${titleDisplayString}</div>` : '';
  // Use language-xxx class convention for highlight.js themes
  const langClassForTheme = language ? `language-${escapeHtml(language)}` : 'language-none'; 
  const specificBlockClass = language ? `${escapeHtml(language)}-code` : ''; // For existing specific lang styles e.g. .typescript-code

  return `<div class="code-block ${specificBlockClass}">
    ${titleHtml}
    <pre><code class="${langClassForTheme}">${highlightedCode}</code></pre>
  </div>`;
};

// Handle task lists in renderer
renderer.listitem = function(text, task, checked) {
  // Handle both versions of marked API
  let isTask = false;
  let isChecked = false;
  
  if (typeof task === 'boolean') {
    // Older versions of marked
    isTask = task;
    isChecked = checked;
  } else if (text && typeof text === 'object') {
    // Newer versions of marked where first arg is a token
    isTask = text.task || false;
    isChecked = text.checked || false;
    text = this.parser ? this.parser.parseInline(text.tokens || []) : text.text || '';
  }
  
  if (isTask) {
    // Create a custom task list item with styled checkbox
    return `<li class="task-list-item">
      <input type="checkbox" ${isChecked ? 'checked' : ''} disabled /> ${text}
    </li>`;
  }
  
  // Regular list item
  return `<li>${text}</li>`;
};

// Add after renderer.listitem definition
renderer.list = function(body, ordered, start) {
  let listBody = '';
  let isOrdered = false;
  let startVal = 1;

  if (arguments.length === 1 && typeof body === 'object' && body !== null) {
    const token = body;
    isOrdered = !!token.ordered;
    startVal = typeof token.start === 'number' ? token.start : 1;

    if (Array.isArray(token.items)) {
      listBody = token.items.map(it => {
        let itemHtml = '';
        if (this.parser && it && it.tokens) {
          // Safely parse the tokens for this list item into HTML
          try {
            itemHtml = this.parser.parse(it.tokens);
          } catch (e) {
            // Fallback to raw text if parsing fails
            itemHtml = it.text || '';
          }
        } else {
          itemHtml = it.text || '';
        }
        return `<li>${itemHtml}</li>`;
      }).join('\n');
    }
  } else {
    listBody = typeof body === 'string' ? body : '';
    isOrdered = !!ordered;
    startVal = typeof start === 'number' ? start : 1;
  }

  const tag = isOrdered ? 'ol' : 'ul';
  const startAttr = isOrdered && startVal > 1 ? ` start="${startVal}"` : '';
  return `<${tag} class="balanced-list"${startAttr}>\n${listBody}\n</${tag}>`;
};

// Configure marked with our custom renderer
marked.setOptions({
  renderer: renderer,
  highlight: function(code, lang) {
    // This function is called by renderer.code (via this.options.highlight)
    // and by marked itself for non-fenced code blocks if a lang is provided.
    const language = (lang || '').trim().toLowerCase();
    // Ensure code is a string before logging/processing
    const codeStr = String(code || '');
    console.log(`[marked.options.highlight] Called with lang: "${language}", code (len: ${codeStr.length}): "${codeStr.substring(0,70).replace(/\n/g, '\\n')}..."`);
    return safeHighlight(codeStr, language); // Pass to our main highlighter
  },
  gfm: true,
  breaks: false,
  pedantic: false,
  smartLists: true,
  smartypants: true,
  xhtml: true
});

// Process HTML with additional formatting
export function processHtml(html) {
  // Clean up any potential [object Object] instances
  html = html.replace(/\[object Object\]/g, '');
  
  // (Code blocks are rendered directly by renderer.code; no additional processing required.)
  console.log('[processHtml] HTML before critical code block processing:', html.substring(0, 500) + (html.length > 500 ? '...' : ''));
  
  // CRITICAL: Add a backup processing step to ensure code blocks ALWAYS have content
  html = html.replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gs, (match, codeContent) => {
    console.log('[processHtml] Matched <pre><code> block. Initial content:', codeContent ? codeContent.substring(0,100) + '...' : 'EMPTY_OR_NULL');
    // If the code block is empty, we need to make sure it's obvious
    if (!codeContent || codeContent.trim() === '') {
      const emptyMessage = '[This code block is empty or failed to render]';
      console.log('[processHtml] Code block content is empty or whitespace. Replacing with:', emptyMessage);
      return `<pre style="padding:10px;background:#f8f8f8;border:1px solid #ddd;border-radius:3px;color:#666;font-style:italic;"><code>${emptyMessage}</code></pre>`;
    }
    console.log('[processHtml] Code block has content. Original match preserved.');
    return match;
  });
  console.log('[processHtml] HTML after critical code block processing:', html.substring(0, 500) + (html.length > 500 ? '...' : ''));
  
  // Convert emojis to SVG images
  html = twemoji.parse(html, {
    folder: 'svg',
    ext: '.svg',
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
    className: 'emoji-svg',
    attributes: () => {
      return {
        width: '1em',
        height: '1em',
        style: 'display:inline-block;vertical-align:-0.1em;background:none;'
      };
    }
  });

  // Check for any inline objects that might have been stringified
  html = html.replace(/\{([^{}]*)\}/g, (match) => {
    if (match.includes(':') && !match.includes('<') && !match.includes('>')) {
      return '';
    }
    return match;
  });

  // Handle Figure captions - both patterns:
  // 1. ![alt](src) followed by <em>caption</em>
  // 2. **Caption:** text followed by ![alt](src)
  
  // Pattern 1: Image followed by em text
  const imgCaptionRegex1 = /<img([^>]*)>(\s*)<em>([^<]+)<\/em>/g;
  html = html.replace(imgCaptionRegex1, '<figure><img$1><figcaption>$3</figcaption></figure>');
  
  // Pattern 2: Strong text with ":" followed by an image
  const imgCaptionRegex2 = /<p><strong>([^<:]+):<\/strong>([^<]*)(?:<br>)?\s*<img([^>]*)><\/p>/g;
  html = html.replace(imgCaptionRegex2, '<figure><figcaption><strong>$1:</strong>$2</figcaption><img$3></figure>');
  
  // Fix standalone images for better display
  html = html.replace(/<p><img([^>]*)><\/p>/g, '<figure><img$1></figure>');

  // Ensure image URLs load in Puppeteer
  html = html.replace(/<img([^>]*)src="([^"]+)"([^>]*)>/g, (match, before, src, after) => {
    // Make sure URLs are properly loaded by adding crossorigin attribute
    return `<img${before}src="${src}"${after} crossorigin="anonymous" loading="eager">`;
  });
  
  // Ensure images have proper dimensions to avoid layout shifts
  html = html.replace(/<img([^>]*)src="([^"]+)"([^>]*)>/g, (match, before, src, after) => {
    // Add default width/height if not present
    if (!match.includes('width="') && !match.includes('height="')) {
      return `<img${before}src="${src}"${after} style="max-width:100%; height:auto;">`;
    }
    return match;
  });

  // Ensure section headers are properly spaced
  html = html.replace(/(<h[1-6][^>]*>.*?<\/h[1-6]>)(<h[1-6][^>]*>)/g, '$1<div class="section-break"></div>$2');

  // Add special class to reference lists
  html = html.replace(/<h3[^>]*>Reference List.*?<\/h3>\s*(<ol[^>]*>)/g, '<h3>Reference List</h3><ol class="reference-list">');

  // Fix lists with bold headings
  html = html.replace(/<li><p>([^:]+):(.*?)<\/p><\/li>/gs,
    '<li class="no-break-item"><strong>$1:</strong>$2</li>');

  // Group related elements
  html = html.replace(/<h3[^>]*>([^<]+)<\/h3>\s*<p>([^<]+)<\/p>/g,
    '<div class="keep-together"><h3>$1</h3><p>$2</p></div>');

  // Add special styling to lists
  html = html.replace(/<ul>/g, '<ul class="balanced-list">');
  html = html.replace(/<ol>/g, '<ol class="balanced-list">');
  
  // Process lists with special formatting
  // Add classes to identify parent lists vs nested lists
  html = html.replace(/<ul class="balanced-list">\s*<li>/g, '<ul class="balanced-list parent-list"><li>');
  html = html.replace(/<ol class="balanced-list">\s*<li>/g, '<ol class="balanced-list parent-list"><li>');
  
  // Enhance task list items with emoji indicators
  html = html.replace(/<input type="checkbox" checked disabled \/>/g, 
    `<input type="checkbox" checked disabled /> <span class="task-complete">✓</span>`);
  html = html.replace(/<input type="checkbox" disabled \/>/g,
    `<input type="checkbox" disabled /> <span class="task-incomplete">○</span>`);

  // Add classes to tables based on content
  html = html.replace(/<table>/g, (match) => {
    if (html.includes('Reference List')) {
      return '<table class="reference-table">';
    }
    if (html.includes('Metrics') || html.includes('Statistics')) {
      return '<table class="metrics-table">';
    }
    return match;
  });

  // Add classes to cells with specific content types
  html = html.replace(/<td([^>]*)>((?:(?!<\/td>).)*?)<\/td>/gs, (match, attrs, content) => {
    if (content.includes('http') || content.length > 100) {
      return `<td class="allow-wrap"${attrs}>${content}</td>`;
    }
    if (content.length < 20) {
      return `<td class="narrow-column"${attrs}>${content}</td>`;
    }
    return match;
  });

  return html;
}

// Process footnotes and markdown
export function processFootnotes(markdownContent, footnotes) {
  // First, collect all footnote definitions
  const footnoteDefinitions = {};
  const footnoteDefRegex = /\[\^(\d+)\]:\s+([\s\S]+?)(?=\n\s*\n|\n\[\^|\n#|\n\*\*|\n\-|\n\d+\.|\n\+|\n\>|\n\<|\n\`\`\`|\n\||\n\n|$)/g;
  
  // First, find all footnote definitions and store them
  const processedMarkdown = markdownContent.replace(footnoteDefRegex, (match, ref, text) => {
    footnoteDefinitions[ref] = text.trim();
    return ''; // Remove from the text
  });
  
  // Then, process the inline footnote references
  const processedWithReferences = processedMarkdown.replace(/\[\^(\d+)\]/g, (match, ref) => {
    if (footnoteDefinitions[ref]) {
      // Use the original reference number instead of our counter
      footnotes[ref] = footnoteDefinitions[ref];
      return `<sup id="footnote-ref-${ref}" class="footnote-ref"><a href="#footnote-${ref}">[${ref}]</a></sup>`;
    }
    return match; // If no definition found, keep the original text
  });

  return processedWithReferences;
}

// Process markdown to HTML
export function processMarkdown(markdownContent) {
  console.log('[processMarkdown] Original Markdown (first 200 chars):', markdownContent.substring(0,200) + (markdownContent.length > 200 ? "..." : ""));
  let html = marked.parse(markdownContent);
  console.log('[processMarkdown] HTML after marked.parse (first 500 chars):', html.substring(0,500) + (html.length > 500 ? "..." : ""));
  return html;
} 