import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { marked } from 'marked';
import hljs from 'highlight.js';
import twemoji from 'twemoji';
import { NextResponse } from 'next/server';

// Remote Chromium executable path for Vercel (matches chromium-min v133)
const remoteExecutablePath = "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

// Track footnotes globally
let footnotes = {};
let footnoteCounter = 0;

// Helper function to safely escape HTML
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  
  const safeStr = String(text);
  return safeStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

// Theme configurations (exactly matching the frontend)
const lightTheme = {
  backgroundColor: '#FFFFFF',
  textColor: '#334155',
  headingColor: '#1E40AF',
  linkColor: '#2563EB',
  codeBackgroundColor: '#F8FAFC',
  blockquoteColor: '#64748B',
  borderColor: '#E2E8F0',
  accentColor: '#3B82F6',
  tableHeaderBg: '#F1F5F9',
  tableStripeBg: '#F8FAFC',
  gradientStart: '#1E40AF',
  gradientEnd: '#3B82F6',
  brandColor: '#1E40AF',
};

const darkTheme = {
  backgroundColor: '#0F172A',
  textColor: '#E2E8F0',
  headingColor: '#60A5FA',
  linkColor: '#3B82F6',
  codeBackgroundColor: '#1E293B',
  blockquoteColor: '#94A3B8',
  borderColor: '#334155',
  accentColor: '#60A5FA',
  tableHeaderBg: '#1E293B',
  tableStripeBg: '#0F172A',
  gradientStart: '#2563EB',
  gradientEnd: '#60A5FA',
  brandColor: '#60A5FA',
};

// Simple slugify function for heading IDs (same as frontend)
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Process HTML with additional formatting
function processHtml(html) {
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

// Create HTML with styling
function generateStyledHtml(htmlContent, theme, paperSize) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Document</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/${theme === darkTheme ? 'atom-one-dark' : 'atom-one-light'}.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <style>
    /* Base styles */
    html, body {
      background-color: ${theme.backgroundColor} !important;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      color: ${theme.textColor};
      line-height: 1.5;
      font-size: 8.5pt;
      letter-spacing: 0.01em;
      white-space: normal;
    }

    /* Print-specific styles */
    @media print {
      html, body {
        background-color: ${theme.backgroundColor} !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      @page {
        margin: 2cm 2cm 2.2cm 2cm;
        background-color: ${theme.backgroundColor};
      }
      
      /* Prevent orphaned headings */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      
      /* Keep at least 2 lines together */
      p, ul, ol, dl, figure, blockquote, table {
        page-break-inside: avoid;
      }
      
      /* Ensure code blocks, tables don't split */
      pre, table, figure {
        break-inside: avoid;
      }
      
      /* Balance content on pages */
      .content-wrapper {
        widows: 2;
        orphans: 2;
        background-color: ${theme.backgroundColor};
      }
    }
    
    /* Content wrapper - allow whole words to wrap */
    .content-wrapper {
      white-space: normal;
      word-break: keep-all; /* Prevent any word breaking */
      overflow-wrap: normal; /* Only break at spaces */
      background-color: ${theme.backgroundColor} !important;
      min-height: 100vh;
      padding: 1em;
    }

    /* Allow whole words to wrap while preventing any word breaking */
    p, li, td, th, blockquote, pre, code, figcaption, .table-of-contents, .keep-together {
      white-space: normal;
      word-break: normal;
      overflow-wrap: normal;
      hyphens: none;
    }

    /* Tables - allow whole words to wrap */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 8pt;
      table-layout: fixed; /* Use fixed layout for better column control */
    }
    
    /* Remove forced page break controls for tables */
    table, tbody, tr {
      page-break-inside: auto;
      break-inside: auto;
    }
    
    /* Only avoid breaking inside table header */
    thead {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    td, th {
      padding: 0.5em 0.6em;
      border: 1px solid ${theme.borderColor};
      font-size: 8pt;
      vertical-align: top;
      white-space: normal;
      word-break: keep-all; /* Prevent any word breaking */
      overflow-wrap: normal; /* Only break at spaces */
    }

    /* Lists - allow whole words to wrap */
    li {
      margin-bottom: 0.35em;
      page-break-inside: avoid;
      white-space: normal;
      word-wrap: normal;
      overflow-wrap: normal;
      word-break: keep-all; /* Avoid breaking inside words */
      position: relative;
    }

    /* Emoji SVG styling */
    .emoji-svg {
      height: 1em;
      width: 1em;
      margin: 0 .05em 0 .1em;
      vertical-align: -0.1em;
      display: inline-block;
      background: none !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
    }
    
    /* Larger emojis for headings */
    h1 .emoji-svg {
      height: 1.2em;
      width: 1.2em;
      vertical-align: -0.15em;
    }
    
    h2 .emoji-svg {
      height: 1.1em;
      width: 1.1em;
      vertical-align: -0.12em;
    }
    
    /* Remove any background from emoji containers */
    img.emoji-svg {
      background: transparent !important;
      box-shadow: none !important;
    }
    
    /* Typography and Links */
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${theme.headingColor};
      margin-top: 1.2em;
      margin-bottom: 0.6em;
      font-weight: 600;
      line-height: 1.25;
      text-align: left;
      scroll-margin-top: 2em;
    }
    
    /* Ensure headings are clickable targets */
    h1[id], h2[id], h3[id], h4[id], h5[id], h6[id] {
      cursor: pointer;
      position: relative;
    }
    
    /* Style links */
    a {
      color: ${theme.linkColor};
      text-decoration: none;
      transition: color 0.2s ease;
    }
    
    a:hover {
      text-decoration: underline;
      color: ${theme.accentColor};
    }
    
    /* Table of Contents specific styling */
    .table-of-contents {
      margin: 2em 0;
      padding: 1em;
      background: ${theme.backgroundColor === '#FFFFFF' ? 'rgba(241, 245, 249, 0.5)' : 'rgba(30, 41, 59, 0.5)'};
      border-radius: 8px;
    }
    
    .table-of-contents a {
      display: block;
      padding: 0.25em 0;
      color: ${theme.linkColor};
      text-decoration: none;
    }
    
    .table-of-contents a:hover {
      text-decoration: underline;
    }
    
    /* Typography */
    h1 {
      font-size: 18pt;
      text-align: left;
      margin-bottom: 1em;
      padding-bottom: 0.4em;
      border-bottom: 2px solid ${theme.accentColor};
      color: ${theme.headingColor};
      page-break-after: avoid;
      margin-top: 0;
    }
    
    h2 {
      font-size: 13pt;
      padding-bottom: 0.3em;
      border-bottom: 1px solid ${theme.borderColor};
      margin-top: 1.5em;
      margin-bottom: 0.8em;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    
    h3 {
      font-size: 11pt;
      margin-top: 1.2em;
      margin-bottom: 0.6em;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    
    h4 {
      font-size: 10pt;
      margin-top: 1em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    
    h5, h6 {
      font-size: 9pt;
      margin-top: 0.9em;
      margin-bottom: 0.4em;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    
    p, ul, ol {
      margin-top: 0.5em;
      margin-bottom: 0.9em;
      font-size: 8.5pt;
      text-align: left;
    }
    
    /* Keep related content together */
    .keep-together {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Section break to ensure proper spacing between headers */
    .section-break {
      display: block;
      height: 0.5em;
      margin: 0;
      padding: 0;
    }
    
    /* Balanced lists */
    .balanced-list {
      margin-top: 0.5em;
      margin-bottom: 0.8em;
    }
    
    .balanced-list li {
      margin-bottom: 0.35em;
    }
    
    /* Images */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      border-radius: 0;
      box-shadow: none;
      background: none;
      object-fit: contain;
    }
    
    /* Figures */
    figure {
      margin: 1em 0;
      padding: 0;
      page-break-inside: avoid;
      display: block;
      position: relative;
      max-width: 100%;
      text-align: center;
    }

    figcaption {
      font-size: 8pt;
      color: ${theme.textColor};
      margin-top: 0.5em;
      font-style: italic;
      display: block;
      text-align: center;
      width: 100%;
    }
    
    /* Different image sizing based on figure position */
    figure img {
      margin: 0 auto;
      max-width: 100%;
      max-height: 500px;
      object-fit: contain;
    }
    
    /* Figures with captions at the top */
    figure figcaption:first-child {
      margin-top: 0;
      margin-bottom: 0.5em;
    }
    
    /* Figures with captions at the bottom */
    figure figcaption:last-child {
      margin-top: 0.5em;
      margin-bottom: 0;
    }
    
    /* Code blocks - enhanced styling */
    .code-block {
      margin: 1.2em 0;
      border-radius: 8px;
      overflow: hidden;
      background-color: ${theme.codeBackgroundColor};
      border: 1px solid ${theme.borderColor};
      page-break-inside: avoid;
      break-inside: avoid;
      position: relative;
    }
    
    .code-title {
      background-color: ${theme === darkTheme ? '#1a2233' : '#e2e8f0'};
      color: ${theme.textColor};
      font-family: 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 8pt;
      font-weight: 500;
      padding: 0.4em 0.8em;
      border-bottom: 1px solid ${theme.borderColor};
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
    }
    
    .code-container {
      display: flex;
      overflow-x: auto;
    }
    
    .line-numbers {
      display: flex;
      flex-direction: column;
      padding: 0.8em 0;
      background-color: ${theme === darkTheme ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'};
      color: ${theme === darkTheme ? '#6b7280' : '#94a3b8'};
      text-align: right;
      font-family: 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 8pt;
      user-select: none;
      min-width: 2em;
      padding-right: 0.5em;
      padding-left: 0.5em;
    }
    
    .line-content {
      white-space: pre;
    }
    
    .code-line {
      display: block;
      white-space: pre;
      line-height: 1.4;
    }
    
    pre {
      background-color: ${theme.codeBackgroundColor};
      border-radius: 6px;
      padding: 0.8em;
      margin: 0;
      overflow-x: auto;
      font-size: 8.25pt;
      flex-grow: 1;
    }
    
    code {
      font-family: 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 8.25pt;
      background-color: ${theme.codeBackgroundColor};
      padding: 0.15em 0.3em;
      border-radius: 3px;
      border: 1px solid ${theme.borderColor};
    }
    
    pre code {
      padding: 0;
      border: none;
      background-color: transparent;
      font-size: 8pt;
      line-height: 1.4;
      display: block;
      white-space: pre-wrap;
      text-align: left;
      overflow: visible;
    }
    
    /* Language specific styling */
    .typescript-code .code-title:before,
    .javascript-code .code-title:before,
    .python-code .code-title:before,
    .java-code .code-title:before,
    .cpp-code .code-title:before,
    .csharp-code .code-title:before,
    .go-code .code-title:before,
    .ruby-code .code-title:before,
    .php-code .code-title:before,
    .rust-code .code-title:before,
    .html-code .code-title:before,
    .css-code .code-title:before {
      content: '';
      display: inline-block;
      width: 0.8em;
      height: 0.8em;
      border-radius: 50%;
      margin-right: 0.5em;
      vertical-align: -0.05em;
    }
    
    .typescript-code .code-title:before { background-color: #3178c6; }
    .javascript-code .code-title:before { background-color: #f7df1e; }
    .python-code .code-title:before { background-color: #3776ab; }
    .java-code .code-title:before { background-color: #b07219; }
    .cpp-code .code-title:before { background-color: #f34b7d; }
    .csharp-code .code-title:before { background-color: #178600; }
    .go-code .code-title:before { background-color: #00ADD8; }
    .ruby-code .code-title:before { background-color: #CC342D; }
    .php-code .code-title:before { background-color: #4F5D95; }
    .rust-code .code-title:before { background-color: #DEA584; }
    .html-code .code-title:before { background-color: #e34c26; }
    .css-code .code-title:before { background-color: #563d7c; }
    
    /* Rest of the styles */
    /* Blockquotes */
    blockquote {
      border-left: 3px solid ${theme.accentColor};
      padding: 0.5em 0.8em;
      margin: 1em 0;
      color: ${theme.blockquoteColor};
      font-style: italic;
      font-size: 8pt;
      background-color: ${theme.backgroundColor === '#FFFFFF' ? 'rgba(241, 245, 249, 0.5)' : 'rgba(30, 41, 59, 0.5)'};
      border-radius: 0 4px 4px 0;
      page-break-inside: avoid;
    }
    
    /* Lists - Enhanced styling */
    ul, ol {
      padding-left: 2em;
      margin: 0.6em 0 0.9em;
    }
    
    li {
      margin-bottom: 0.42em;
      page-break-inside: avoid;
      word-wrap: normal;
      overflow-wrap: normal;
      word-break: keep-all; /* Avoid breaking inside words */
      position: relative;
      line-height: 1.4;
    }
    
    /* Unordered lists with custom bullets */
    ul {
      list-style: none;
    }
    
    ul > li {
      position: relative;
      padding-left: 0.3em;
    }
    
    ul > li::before {
      content: "";
      position: absolute;
      left: -1.2em;
      top: 0.5em;
      width: 0.5em;
      height: 0.5em;
      background-color: ${theme.accentColor};
      border-radius: 50%;
    }
    
    /* Nested unordered lists with different bullet styles */
    ul ul > li::before {
      background-color: transparent;
      border: 1px solid ${theme.accentColor};
      width: 0.4em;
      height: 0.4em;
    }
    
    ul ul ul > li::before {
      border-radius: 0;
      background-color: transparent;
      border: 1px solid ${theme.accentColor};
      transform: rotate(45deg);
      width: 0.35em;
      height: 0.35em;
    }
    
    /* Enhanced ordered lists with proper nesting */
    ol {
      list-style: none;
      margin: 0.6em 0 0.9em;
      padding-left: 2.2em;
      counter-reset: section;
    }
    
    ol > li {
      counter-increment: section;
      padding-left: 0.5em;
      position: relative;
    }
    
    ol > li::before {
      content: counter(section) ".";
      position: absolute;
      left: -2em;
      width: 1.8em;
      text-align: right;
      color: ${theme.headingColor};
      font-weight: 500;
    }
    
    /* Second level - use letters */
    ol ol {
      counter-reset: subsection;
    }
    
    ol ol > li {
      counter-increment: subsection;
    }
    
    ol ol > li::before {
      content: counter(section) "." counter(subsection);
    }
    
    /* Third level - use roman numerals */
    ol ol ol {
      counter-reset: subsubsection;
    }
    
    ol ol ol > li {
      counter-increment: subsubsection;
    }
    
    ol ol ol > li::before {
      content: counter(section) "." counter(subsection) "." counter(subsubsection);
    }
    
    /* List spacing refinements */
    ul, ol {
      padding-bottom: 0.2em; /* Add space after lists */
    }
    
    li > ul, li > ol {
      margin-top: 0.3em;
      margin-bottom: 0.2em;
      margin-left: 0.5em; /* Add indentation for nested lists */
    }
    
    /* Add visual indicator for list items with subitems */
    li:has(> ul), li:has(> ol) {
      margin-bottom: 0.4em;
    }
    
    /* Add subtle connecting lines for nested lists */
    li > ul, li > ol {
      position: relative;
      border-left: 1px dashed ${theme === darkTheme ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.15)'};
      margin-left: -0.5em;
      padding-left: 1.8em;
    }
    
    /* Balanced spacing between list items */
    .balanced-list > li:not(:last-child) {
      margin-bottom: 0.5em;
    }
    
    /* Make list markers stand out slightly on hover for interactive PDFs */
    @media not print {
      ul > li:hover::before {
        transform: scale(1.2);
      }
      
      ol > li:hover::before {
        font-weight: 600;
      }
    }
    
    /* Reference list specific styling */
    .reference-list li {
      margin-bottom: 0.8em;
      padding-left: 0.5em;
    }
    
    .reference-list li::before {
      color: ${theme.accentColor};
      font-weight: 600;
    }
    
    /* Task lists and checkbox styling */
    ul li.task-list-item {
      padding-left: 1.8em;
      position: relative;
    }
    
    ul li.task-list-item::before {
      display: none; /* Hide the default bullet */
    }
    
    ul li.task-list-item input[type="checkbox"] {
      position: absolute;
      left: -1.5em;
      top: 0.25em;
      width: 1.1em;
      height: 1.1em;
      margin: 0;
      vertical-align: middle;
      appearance: none;
      -webkit-appearance: none;
      border: 1px solid ${theme.borderColor};
      border-radius: 3px;
      background-color: ${theme === darkTheme ? '#1E293B' : '#FFFFFF'};
    }
    
    ul li.task-list-item input[type="checkbox"]:checked {
      background-color: ${theme.accentColor};
      border-color: ${theme.accentColor};
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E");
      background-size: 0.8em;
      background-position: center;
      background-repeat: no-repeat;
    }
    
    /* Task completion indicators */
    .task-complete {
      color: ${theme.accentColor};
      font-weight: bold;
      margin-right: 0.3em;
    }
    
    .task-incomplete {
      color: ${theme.blockquoteColor};
      margin-right: 0.3em;
    }
    
    /* Parent list styling enhancements */
    .parent-list {
      margin-top: 0.8em;
      margin-bottom: 1em;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 8pt;
      table-layout: fixed; /* Use fixed layout for better column control */
    }

    th {
      background-color: ${theme.tableHeaderBg};
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid ${theme.borderColor};
      padding: 0.5em 0.6em;
      font-size: 8pt;
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
    }

    td {
      padding: 0.5em 0.6em;
      border: 1px solid ${theme.borderColor};
      font-size: 8pt;
      vertical-align: top;
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
    }

    /* Smart column width handling */
    td:first-child, th:first-child {
      width: 20%; /* Give reasonable space for identifiers/keys */
    }

    td:nth-child(2), th:nth-child(2) {
      width: 25%; /* Slightly wider for secondary information */
    }

    td:last-child, th:last-child {
      width: auto; /* Let the last column take remaining space */
    }

    /* Handle links and long content */
    td a, th a {
      word-break: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
    }

    /* Special handling for specific table types */
    table.reference-table td:last-child {
      width: 60%; /* More space for reference descriptions */
    }

    table.metrics-table td {
      width: auto; /* Equal width for metric tables */
    }

    /* Ensure minimum width for columns with short content */
    td.narrow-column {
      min-width: 100px;
    }

    /* Handle very long unbreakable content */
    td.allow-wrap {
      white-space: normal;
      min-width: 200px; /* Ensure reasonable minimum width */
    }

    /* Style alternating rows */
    tr:nth-child(even) {
      background-color: ${theme.tableStripeBg};
    }

    /* Handle nested elements in cells */
    td > p:first-child {
      margin-top: 0;
    }

    td > p:last-child {
      margin-bottom: 0;
    }

    /* Handle code blocks in tables */
    td code {
      word-break: break-word;
      white-space: pre-wrap;
    }

    /* Page break control elements */
    .page-break-before, .force-page-break {
      page-break-before: always;
      break-before: page;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
      display: block;
      visibility: hidden;
    }

    .page-break-after {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
      display: block;
      visibility: hidden;
    }

    /* Position tracker for page breaks */
    .position-tracker {
      height: 0;
      visibility: hidden;
      margin: 0;
      padding: 0;
      border: none;
    }

    /* Footnotes styling */
    .footnotes {
      margin-top: 2em;
      border-top: 1px solid ${theme.borderColor};
      padding-top: 1em;
      font-size: 8pt;
      page-break-before: always;
      break-before: page;
    }

    .footnotes hr {
      display: none;
    }

    .footnote-ref {
      font-size: 0.75em;
      vertical-align: super;
      line-height: 0;
      margin: 0 0.15em;
    }

    .footnote-ref a {
      color: ${theme.linkColor};
      text-decoration: none;
      padding: 0 0.2em;
    }

    .footnote-item {
      font-size: 8pt;
      margin-bottom: 0.5em;
      position: relative;
      color: ${theme.textColor};
    }

    .footnote-list {
      padding-left: 1.5em;
      list-style-type: none; /* Remove automatic numbering */
    }

    .footnote-list li {
      position: relative;
      padding-left: 1em;
      text-indent: -1em;
      margin-bottom: 0.6em;
    }

    .footnote-list li::before {
      content: attr(data-number) ".";
      color: ${theme.accentColor};
      font-weight: 600;
      margin-right: 0.5em;
    }

    .footnote-backref {
      color: ${theme.linkColor};
      text-decoration: none;
      font-size: 0.85em;
      margin-left: 0.3em;
    }

    .footnote-backref:hover {
      text-decoration: underline;
    }

    /* Add KaTeX styles */
    .katex-display {
      margin: 1em 0;
      text-align: center;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.5em 0;
    }
    
    .katex {
      font-size: 1.1em;
      line-height: 1.2;
      text-indent: 0;
      text-rendering: auto;
    }
    
    .katex-display > .katex {
      display: inline-block;
      text-align: center;
      max-width: 100%;
    }
    
    /* Ensure equations don't break across pages */
    .katex-display, .katex-block {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Inline math */
    .katex-inline {
      display: inline-block;
      vertical-align: middle;
      font-size: 1em;
    }
    
    /* Dark theme support for KaTeX */
    .dark-theme .katex {
      color: ${theme === darkTheme ? theme.textColor : 'inherit'};
    }
    
    .dark-theme .katex .mord,
    .dark-theme .katex .mbin,
    .dark-theme .katex .mrel,
    .dark-theme .katex .mopen,
    .dark-theme .katex .mclose,
    .dark-theme .katex .mpunct {
      color: ${theme === darkTheme ? theme.textColor : 'inherit'};
    }
  </style>
</head>
<body>
  <div class="content-wrapper">
    ${htmlContent}
  </div>
  
  <script>
    // Initialize KaTeX for any math that was rendered
    document.addEventListener('DOMContentLoaded', function() {
      // Render display math ($$...$$)
      document.querySelectorAll('.math-display').forEach(function(element) {
        try {
          katex.render(element.textContent, element, {
            displayMode: true,
            throwOnError: false,
            output: 'html'
          });
        } catch (e) {
          console.error('KaTeX display math rendering error:', e);
        }
      });
      
      // Render inline math ($...$)
      document.querySelectorAll('.math-inline').forEach(function(element) {
        try {
          katex.render(element.textContent, element, {
            displayMode: false,
            throwOnError: false,
            output: 'html'
          });
        } catch (e) {
          console.error('KaTeX inline math rendering error:', e);
        }
      });
    });
  </script>
</body>
</html>`;
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

// Add custom renderer for math expressions
renderer.text = function(text) {
  let processed = text;
  
  // Handle display math ($$...$$)
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, function(match, math) {
    try {
      return `<div class="math-display">${math}</div>`;
    } catch (e) {
      console.error('Error rendering display math:', e);
      return match;
    }
  });
  
  // Handle inline math ($...$)
  processed = processed.replace(/\$([^\$]+?)\$/g, function(match, math) {
    try {
      return `<span class="math-inline">${math}</span>`;
    } catch (e) {
      console.error('Error rendering inline math:', e);
      return match;
    }
  });
  
  return processed;
};

export async function POST(request) {
  try {
    const data = await request.json();
    const { markdown: markdownContent, theme: selectedTheme = 'light', paperSize = 'A4' } = data;

    if (!markdownContent) {
      return NextResponse.json(
        { error: "Markdown content is required" },
        { status: 400 }
      );
    }

    // Reset footnotes for this conversion
    footnotes = {};
    footnoteCounter = 0;
    
    // Process footnotes in markdown text
    // First, collect all footnote definitions
    const footnoteDefinitions = {};
    const footnoteDefRegex = /\[\^(\d+)\]:\s+([\s\S]+?)(?=\n\s*\n|\n\[\^|\n#|\n\*\*|\n\-|\n\d+\.|\n\+|\n\>|\n\<|\n\`\`\`|\n\||\n\n|$)/g;
    
    // First, find all footnote definitions and store them
    let footnoteDefMatch;
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

    // Select theme based on user choice
    const theme = selectedTheme === 'dark' ? darkTheme : lightTheme;

    // Process markdown to HTML
    console.log('[POST] Original Markdown (first 200 chars):', markdownContent.substring(0,200) + (markdownContent.length > 200 ? "..." : ""));
    let html = marked.parse(processedWithReferences || markdownContent);
    console.log('[POST] HTML after marked.parse (first 500 chars):', html.substring(0,500) + (html.length > 500 ? "..." : ""));
    html = processHtml(html);
    console.log('[POST] HTML after processHtml (first 500 chars):', html.substring(0,500) + (html.length > 500 ? "..." : ""));

    // Create the complete HTML document with custom styling
    const styledHtml = generateStyledHtml(html, theme, paperSize);

    try {
      const executablePath = await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'
      );

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

        // Initialize KaTeX for math expressions
        const renderMath = async () => {
          // Wait for KaTeX to be available
          while (typeof katex === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Render display math
          document.querySelectorAll('.math-display').forEach(element => {
            try {
              katex.render(element.textContent, element, {
                displayMode: true,
                throwOnError: false,
                output: 'html'
              });
            } catch (e) {
              console.error('KaTeX display math rendering error:', e);
            }
          });

          // Render inline math
          document.querySelectorAll('.math-inline').forEach(element => {
            try {
              katex.render(element.textContent, element, {
                displayMode: false,
                throwOnError: false,
                output: 'html'
              });
            } catch (e) {
              console.error('KaTeX inline math rendering error:', e);
            }
          });
        };

        await renderMath();
        
        // Apply smart page break logic after images and math are loaded
        // Give time for page to render before applying breaks
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

      // Wait for page break logic and math rendering to execute
      await new Promise(resolve => setTimeout(resolve, 2000));

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

      // Create response with proper headers
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': pdf.length.toString(),
          'Content-Disposition': 'attachment; filename="document.pdf"',
          'Cache-Control': 'no-cache',
        },
      });

    } catch (browserError) {
      console.error('Browser initialization error:', browserError);
      return NextResponse.json({
        error: 'PDF Generation Failed',
        details: browserError.message,
        type: 'BROWSER_INIT_ERROR',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

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
    }, { status: 500 });
  }
}
