// Create HTML with styling
export function generateStyledHtml(htmlContent, theme, paperSize) {
  const isDark = theme.backgroundColor === '#0F172A'; // Detect dark theme by checking background color
  
  return `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Document</title>
  <style>
    /* Import fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
    
    /* Reset and base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 9pt;
      line-height: 1.6;
      color: ${theme.textColor};
      background-color: ${theme.backgroundColor};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: ${theme.headingColor};
      font-weight: 600;
      line-height: 1.3;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    
    h1 {
      font-size: 18pt;
      margin-top: 0;
      margin-bottom: 1em;
      padding-bottom: 0.5em;
      border-bottom: 2px solid ${theme.accentColor};
    }
    
    h2 {
      font-size: 13pt;
      margin-top: 1.2em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid ${theme.borderColor};
    }
    
    h3 { font-size: 11pt; }
    h4 { font-size: 10pt; }
    h5, h6 { font-size: 9pt; }
    
    /* Paragraphs */
    p {
      margin: 0.8em 0;
      line-height: 1.6;
    }
    
    /* Links */
    a {
      color: ${theme.linkColor};
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
      color: ${theme.accentColor};
    }
    
    /* Text formatting */
    strong, b {
      font-weight: 600;
      color: ${theme.headingColor};
    }
    
    em, i {
      font-style: italic;
    }
    
    /* Code */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background-color: ${theme.codeBackgroundColor};
      padding: 0.2em 0.4em;
      border-radius: 3px;
      border: 1px solid ${theme.borderColor};
    }
    
    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background-color: ${theme.codeBackgroundColor};
      padding: 1em;
      border-radius: 6px;
      border: 1px solid ${theme.borderColor};
      overflow-x: auto;
      margin: 1em 0;
    }
    
    pre code {
      background: none;
      border: none;
      padding: 0;
    }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid ${theme.accentColor};
      padding-left: 1em;
      margin: 1em 0;
      font-style: italic;
      color: ${theme.blockquoteColor};
      background-color: ${isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.05)'};
      padding: 0.8em 1em;
      border-radius: 0 6px 6px 0;
    }
    
    /* Lists */
    ul, ol {
      margin: 0.8em 0;
      padding-left: 2em;
    }
    
    li {
      margin: 0.3em 0;
      line-height: 1.5;
    }
    
    ul li {
      list-style: none;
      position: relative;
    }
    
    ul li::before {
      content: "";
      position: absolute;
      left: -1.2em;
      top: 0.5em;
      width: 0.5em;
      height: 0.5em;
      background-color: ${theme.accentColor};
      border-radius: 50%;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      font-size: 8pt;
    }
    
    th, td {
      padding: 0.5em;
      border: 1px solid ${theme.borderColor};
      text-align: left;
      vertical-align: top;
    }
    
    th {
      background-color: ${theme.tableHeaderBg};
      font-weight: 600;
      color: ${theme.headingColor};
    }
    
    tr:nth-child(even) {
      background-color: ${theme.tableStripeBg};
    }
    
    /* Images */
    img {
      max-width: 100%;
      height: auto;
      margin: 1em 0;
      border-radius: 6px;
    }
    
    /* Horizontal rules */
    hr {
      border: none;
      border-top: 1px solid ${theme.borderColor};
      margin: 2em 0;
    }
    
    /* Task lists */
    .task-list-item {
      list-style: none;
      position: relative;
    }
    
    .task-list-item input[type="checkbox"] {
      position: absolute;
      left: -1.5em;
      top: 0.3em;
      width: 1em;
      height: 1em;
    }
    
    /* Footnotes */
    .footnote-ref {
      font-size: 0.75em;
      vertical-align: super;
      line-height: 0;
    }
    
    .footnotes {
      margin-top: 3em;
      padding-top: 1em;
      border-top: 1px solid ${theme.borderColor};
    }
    
    .footnote-list {
      padding-left: 2em;
    }
    
    .footnote-item {
      margin: 0.5em 0;
      font-size: 8pt;
    }
    
    .footnote-backref {
      margin-left: 0.5em;
      font-size: 0.8em;
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
        margin: 2cm;
        background-color: ${theme.backgroundColor};
      }
      
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      
      p, ul, ol, dl, figure, blockquote, table {
        page-break-inside: avoid;
      }
      
      pre, table, figure {
        break-inside: avoid;
      }
    }
    
    /* Page break utilities */
    .page-break-before {
      page-break-before: always;
      break-before: page;
    }
    
    .page-break-after {
      page-break-after: always;
      break-after: page;
    }
    
    /* Container */
    .content-wrapper {
      max-width: none;
      padding: 1em;
      background-color: ${theme.backgroundColor};
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div class="content-wrapper">
    ${htmlContent}
  </div>
</body>
</html>`;
} 