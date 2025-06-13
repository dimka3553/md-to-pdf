import { darkTheme } from './themes.js';

// Create HTML with styling
export function generateStyledHtml(htmlContent, theme, paperSize) {
  const isDark = theme === darkTheme;
  
  return `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Document</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: '${theme.accentColor}',
            'bg-main': '${theme.backgroundColor}',
            'text-main': '${theme.textColor}',
            'heading-main': '${theme.headingColor}',
            'link-main': '${theme.linkColor}',
            'border-main': '${theme.borderColor}',
            'code-bg': '${theme.codeBackgroundColor}',
            'blockquote-text': '${theme.blockquoteColor}',
            'table-header': '${theme.tableHeaderBg}',
            'table-stripe': '${theme.tableStripeBg}'
          },
          fontFamily: {
            'inter': ['Inter', 'system-ui', 'sans-serif'],
            'mono': ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace']
          },
          fontSize: {
            'pdf-xs': '8pt',
            'pdf-sm': '8.5pt',
            'pdf-base': '9pt',
            'pdf-lg': '10pt',
            'pdf-xl': '11pt',
            'pdf-2xl': '13pt',
            'pdf-3xl': '18pt'
          }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/${isDark ? 'atom-one-dark' : 'atom-one-light'}.min.css">
  <style>
    /* Essential custom CSS that can't be easily replicated with Tailwind */
    
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
      
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      
      p, ul, ol, dl, figure, blockquote, table {
        page-break-inside: avoid;
      }
      
      pre, table, figure {
        break-inside: avoid;
      }
      
      .content-wrapper {
        widows: 2;
        orphans: 2;
        background-color: ${theme.backgroundColor};
      }
    }

    /* Custom list markers */
    .custom-ul {
      list-style: none;
    }
    
    .custom-ul > li::before {
      content: "";
      position: absolute;
      left: -1.2em;
      top: 0.5em;
      width: 0.5em;
      height: 0.5em;
      background-color: ${theme.accentColor};
      border-radius: 50%;
    }
    
    .custom-ul .custom-ul > li::before {
      background-color: transparent;
      border: 1px solid ${theme.accentColor};
      width: 0.4em;
      height: 0.4em;
    }

    /* Custom ordered list numbering */
    .custom-ol {
      list-style: none;
      counter-reset: section;
    }
    
    .custom-ol > li {
      counter-increment: section;
    }
    
    .custom-ol > li::before {
      content: counter(section) ".";
      position: absolute;
      left: -2em;
      width: 1.8em;
      text-align: right;
      color: ${theme.headingColor};
      font-weight: 500;
    }

    /* Task list checkboxes */
    .task-list-item input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      width: 1.1em;
      height: 1.1em;
      border: 1px solid ${theme.borderColor};
      border-radius: 3px;
      background-color: ${isDark ? '#1E293B' : '#FFFFFF'};
      position: absolute;
      left: -1.5em;
      top: 0.25em;
    }
    
    .task-list-item input[type="checkbox"]:checked {
      background-color: ${theme.accentColor};
      border-color: ${theme.accentColor};
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E");
      background-size: 0.8em;
      background-position: center;
      background-repeat: no-repeat;
    }

    /* Language indicators for code blocks */
    .typescript-code .code-title:before { content: ''; display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; margin-right: 0.5em; background-color: #3178c6; }
    .javascript-code .code-title:before { content: ''; display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; margin-right: 0.5em; background-color: #f7df1e; }
    .python-code .code-title:before { content: ''; display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; margin-right: 0.5em; background-color: #3776ab; }

    /* Page break utilities */
    .page-break-before { page-break-before: always; break-before: page; }
    .page-break-after { page-break-after: always; break-after: page; }
    
    /* Footnotes */
    .footnote-ref { font-size: 0.75em; vertical-align: super; line-height: 0; }
    .footnote-list li::before { content: attr(data-number) "."; color: ${theme.accentColor}; font-weight: 600; margin-right: 0.5em; }
  </style>
</head>
<body class="bg-bg-main text-text-main font-inter text-pdf-sm leading-relaxed min-h-screen">
  <div class="content-wrapper p-4 bg-bg-main min-h-screen">
    <div class="prose prose-slate max-w-none
      prose-headings:text-heading-main prose-headings:font-semibold prose-headings:leading-tight
      prose-h1:text-pdf-3xl prose-h1:mt-0 prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b-2 prose-h1:border-primary
      prose-h2:text-pdf-2xl prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border-main
      prose-h3:text-pdf-xl prose-h3:mt-5 prose-h3:mb-2 
      prose-h4:text-pdf-lg prose-h4:mt-4 prose-h4:mb-2
      prose-h5:text-pdf-base prose-h5:mt-3 prose-h5:mb-1
      prose-h6:text-pdf-base prose-h6:mt-3 prose-h6:mb-1
      prose-p:text-pdf-sm prose-p:my-2 prose-p:leading-normal
      prose-a:text-link-main prose-a:no-underline hover:prose-a:underline hover:prose-a:text-primary
      prose-strong:text-heading-main prose-strong:font-semibold
      prose-em:italic prose-em:text-text-main
      prose-code:bg-code-bg prose-code:text-pdf-xs prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-border-main prose-code:font-mono
      prose-pre:bg-code-bg prose-pre:p-3 prose-pre:rounded-lg prose-pre:border prose-pre:border-border-main prose-pre:text-pdf-xs prose-pre:font-mono prose-pre:overflow-x-auto
      prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:text-blockquote-text prose-blockquote:bg-opacity-50 prose-blockquote:rounded-r
      prose-ul:custom-ul prose-ul:list-none prose-ul:pl-8 prose-ul:my-2
      prose-ol:custom-ol prose-ol:list-none prose-ol:pl-9 prose-ol:my-2
      prose-li:relative prose-li:mb-1 prose-li:leading-normal prose-li:break-words
      prose-table:w-full prose-table:border-collapse prose-table:my-5 prose-table:text-pdf-xs prose-table:table-fixed
      prose-th:bg-table-header prose-th:text-left prose-th:font-semibold prose-th:p-2 prose-th:border prose-th:border-border-main prose-th:text-pdf-xs
      prose-td:p-2 prose-td:border prose-td:border-border-main prose-td:text-pdf-xs prose-td:align-top prose-td:break-words
      prose-tr:even:bg-table-stripe
      prose-img:max-w-full prose-img:h-auto prose-img:mx-auto prose-img:rounded-none prose-img:shadow-none
      prose-figure:my-4 prose-figure:text-center prose-figure:break-inside-avoid
      prose-figcaption:text-pdf-xs prose-figcaption:italic prose-figcaption:mt-2 prose-figcaption:text-text-main
      ${isDark ? 'dark' : ''}">
      ${htmlContent}
    </div>
  </div>
</body>
</html>`;
} 