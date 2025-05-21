"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from 'next/dynamic';
import 'easymde/dist/easymde.min.css'; // Import EasyMDE styles
import 'highlight.js/styles/github.css'; // Light theme syntax highlighting
import 'highlight.js/styles/github-dark.css'; // Dark theme syntax highlighting
import { Inter } from 'next/font/google'; // Import Inter font
import { marked } from 'marked'; // Import for markdown parsing
import hljs from 'highlight.js'; // For syntax highlighting

// Dynamically import SimpleMDE to avoid SSR issues
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false });

const inter = Inter({ subsets: ['latin'] });

// Register languages for syntax highlighting
try {
  // For client-side only since require() doesn't work in ESM in the browser
  // When running in a Next.js environment these will be dynamically loaded
  if (typeof window !== 'undefined') {
    import('highlight.js/lib/languages/typescript').then(mod => hljs.registerLanguage('typescript', mod.default));
    import('highlight.js/lib/languages/javascript').then(mod => hljs.registerLanguage('javascript', mod.default));
    import('highlight.js/lib/languages/bash').then(mod => hljs.registerLanguage('bash', mod.default));
    import('highlight.js/lib/languages/json').then(mod => hljs.registerLanguage('json', mod.default));
  }
} catch (err) {
  console.warn('Could not register highlight.js languages:', err);
}

export default function Home() {
  const [markdown, setMarkdown] = useState(`# 🌌 PROTOCOL-X

### Transforming Inputs into Outputs

_"Structure. Style. Substance."_

**A demonstration of Markdown features and PDF-ready formatting**

---

> **🚀 TL;DR**  
> This example document showcases **all major Markdown elements**—headings, lists, tables, code, images, links, footnotes, blockquotes, and more—organized into a clean, PDF-friendly structure.

---

## 📑 Table of Contents
1. [Abstract](#abstract)
2. [Context & Motivation](#1-context--motivation)
3. [Design & Implementation](#2-design--implementation)
4. [Feature Showcase](#3-feature-showcase)
   1. [Text Formatting](#31-text-formatting)
   2. [Lists](#32-lists)
   3. [Tables](#33-tables)
   4. [Code Blocks](#34-code-blocks)
   5. [Blockquotes & Alerts](#35-blockquotes--alerts)
   6. [Images & Figures](#36-images--figures)
5. [Example Diagram](#4-example-diagram)
6. [Conclusion](#5-conclusion)
7. [References](#6-references)
8. [Footnotes](#7-footnotes)

---

## Abstract

This document illustrates **how to structure** a Markdown file for conversion to PDF, including:

- Hierarchical headings
- Inline and block-level elements
- Rich media embedding
- Cross-references and footnotes

By following this template, you can ensure your Markdown-to-PDF workflow produces professional, publication-quality output.

---

## 1. Context & Motivation

In many documentation workflows, authors struggle to remember all Markdown capabilities. This template:

1. Provides a **comprehensive reference** of Markdown features.
2. Ensures consistent styling across sections.
3. Serves as a **starting point** for technical reports, whitepapers, and academic papers.

---

## 2. Design & Implementation

The document is organized into numbered sections with clear subsections. Links in the Table of Contents facilitate easy navigation. Off-the-shelf Markdown converters (e.g., Pandoc, markdown-pdf) will recognize these elements and generate well-formatted PDFs.

---

## 3. Feature Showcase

### 3.1 Text Formatting

You can apply **bold**, *italic*, ~~strikethrough~~, and \`inline code\`:

> **Note:** Combine styles for emphasis, e.g., ***bold italic***.

### 3.2 Lists

#### 3.2.1 Unordered List

- Item A
  - Subitem A.1
    - ✔️ Task list item
    - ✖️ ~~Completed task~~

#### 3.2.2 Ordered List

1. First step
2. Second step
   1. Nested step
   2. Another nested step
3. Final step

### 3.3 Tables

| Feature         | Supported | Notes                           |
| --------------- | --------- | ------------------------------- |
| Headings        | ✅        | Levels 1–6                      |
| Lists           | ✅        | Ordered, unordered, task lists  |
| Tables          | ✅        | Pipe-separated                  |
| Code Blocks     | ✅        | Fenced with backticks           |
| Blockquotes     | ✅        | Single and multi-line           |
| Footnotes       | ✅        | GitHub and Pandoc style         |
| Images & Links  | ✅        | Inline and reference style      |

### 3.4 Code Blocks

\`\`\`python
def greet(name: str) -> None:
    """
    Prints a greeting.
    """
    print(f"Hello, {name}!")

if __name__ == "__main__":
    greet("World")
\`\`\`

\`\`\`bash
# Shell example
$ mkdir project-x
$ cd project-x
$ touch README.md
\`\`\`

### 3.5 Blockquotes & Alerts

> **Warning:** Ensure your converter supports all extensions you plan to use!
>
> > Nested blockquotes are also supported.

> **Tip:** Use horizontal rules for section breaks.

---

### 3.6 Images & Figures

![Figure 1: Sample Landscape](https://picsum.photos/600/200)

**Figure 2:** Urban skyline.  
![Figure 2: Urban Skyline](https://picsum.photos/400/300)

---

## 4. Example Diagram

\`\`\`mermaid
flowchart TD
  A[Start] --> B{Decision?}
  B -- Yes --> C[Do Thing 1]
  B -- No  --> D[Do Thing 2]
  C --> E[End]
  D --> E[End]
\`\`\`

---

## 5. Conclusion

By leveraging this template, you can create Markdown documents that:

- Are **PDF-ready** with minimal adjustments
- Include **rich content** for technical and design documentation
- Maintain a **consistent, professional layout**

---

## 6. References

1. Pandoc Official Guide: <https://pandoc.org/MANUAL.html>  
2. GitHub Flavored Markdown: <https://github.github.com/gfm/>

---

## 7. Footnotes

This sentence has a footnote.[^1]

This sentence has a footnote.[^2]

This sentence has a footnote.[^3] 

[^1]: This is the footnote text, demonstrating footnote styling in Markdown.

[^2]: This is the second footnote text, demonstrating footnote styling in Markdown.

[^3]: This is the third footnote text, demonstrating footnote styling in Markdown.

---
`);
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [paperSize, setPaperSize] = useState('A4'); // Only A4 now
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fileName, setFileName] = useState('document.md');
  const [isEditingFileName, setIsEditingFileName] = useState(false);

  const handleMarkdownChange = useCallback((value) => {
    setMarkdown(value);
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "text/markdown" || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setMarkdown(e.target.result);
          setFileName(file.name);
        };
        reader.readAsText(file);
        setError(null); // Clear previous errors
      } else {
        setError("Please upload a valid Markdown (.md) file.");
      }
    }
  };

  const startEditingFileName = () => {
    setIsEditingFileName(true);
  };

  const handleFileNameChange = (e) => {
    setFileName(e.target.value);
  };

  const handleFileNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditingFileName(false);
    }
  };

  const handleFileNameBlur = () => {
    setIsEditingFileName(false);
    // Ensure filename ends with .md
    if (!fileName.endsWith('.md')) {
      setFileName(prevName => prevName + '.md');
    }
  };

  const generatePdf = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown, theme, paperSize: 'A4' }), // Always use A4
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate PDF: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url); // Set URL for download link

    } catch (err) {
      console.error("Error generating PDF:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update useEffect for theme change
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    document.documentElement.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    
    // Removed resize event listener for scaling as preview is gone
  }, [theme]);

  // Editor options for SimpleMDE
  const editorOptions = useMemo(() => {
    return {
      autofocus: true,
      spellChecker: false,
      status: ["lines", "words"],
      previewRender: (plainText) => plainText,
    };
  }, []);

  // Get download filename from uploaded file name
  const downloadFileName = useMemo(() => {
    return fileName.replace(/\.md$/, '.pdf');
  }, [fileName]);

  return (
    <main className={`flex min-h-screen flex-col ${inter.className} ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Fixed Header/Toolbar */}
      <header className={`sticky top-0 z-50 w-full ${theme === 'dark' ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-slate-200'} shadow-md transition-colors duration-300`}>
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center">
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
              Markdown to PDF
            </h1>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className={`p-1.5 rounded-md border text-sm shadow-sm transition-colors focus:ring-1 focus:outline-none ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              >
                {theme === 'light' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={generatePdf}
                disabled={isLoading}
                className={`px-3 py-1.5 text-sm font-medium rounded-md shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 ${isLoading ? (theme === 'dark' ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-300 text-slate-500 cursor-not-allowed') : (theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400/50' : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400/50')}`}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : 'Generate PDF'}
              </button>
              
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download={downloadFileName}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-400/50' : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-400/50'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Left Editor Panel - Adjusted to take full width */}
        <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className={`p-3 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Edit Markdown
            </h2>
            <div className="flex items-center gap-3">
              <label className="file-input-button">
                <input
                  type="file"
                  accept=".md,text/markdown"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload MD
                </span>
              </label>
              {isEditingFileName ? (
                <input
                  type="text"
                  value={fileName}
                  onChange={handleFileNameChange}
                  onKeyDown={handleFileNameKeyDown}
                  onBlur={handleFileNameBlur}
                  autoFocus
                  className={`text-xs px-2 py-1 rounded-md outline-none ${theme === 'dark' ? 'bg-slate-700 text-slate-200 border border-slate-600' : 'bg-white text-slate-700 border border-slate-300'}`}
                />
              ) : (
                <span 
                  onClick={startEditingFileName}
                  className={`text-xs px-2 py-1 rounded-full cursor-pointer ${theme === 'dark' ? 'bg-slate-700 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  title="Click to edit filename"
                >
                  {fileName}
                </span>
              )}
            </div>
          </div>
          <div className={`flex-1 overflow-hidden ${theme === 'dark' ? 'markdown-editor-dark themed-editor' : 'markdown-editor-light themed-editor'}`}>
            <SimpleMDE
              id="markdown-input"
              value={markdown}
              onChange={handleMarkdownChange}
              options={editorOptions}
            />
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className={`fixed bottom-4 right-4 p-3 max-w-xs rounded-lg shadow-lg transition-opacity duration-300 ${theme === 'dark' ? 'bg-red-900/90 text-red-200 border border-red-800' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className={`h-5 w-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className={`inline-flex rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme === 'dark' ? 'text-red-300 hover:bg-red-800 focus:ring-red-600' : 'text-red-500 hover:bg-red-100 focus:ring-red-600'}`}
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        /* Global theme styles */
        html.light-theme {
          color-scheme: light;
        }
        html.dark-theme {
          color-scheme: dark;
          scrollbar-color: #4b5563 #1f2937;
        }
        html.dark-theme::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        html.dark-theme::-webkit-scrollbar-track {
          background: #0f172a;
        }
        html.dark-theme::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 4px;
          border: 2px solid #0f172a;
        }

        body {
          transition: background-color 0.3s ease, color 0.3s ease;
          margin: 0;
          padding: 0;
          overflow: visible;
        }
        body.light-theme {
          background-color: #f8fafc;
          color: #1e293b;
        }
        body.dark-theme {
          background-color: #0f172a;
          color: #e2e8f0;
        }

        /* Syntax highlighting theme switching */
        .hljs-light code.hljs {
          display: block;
          background: #F8FAFC;
          color: #334155;
        }
        
        .hljs-dark code.hljs {
          display: block;
          background: #1E293B;
          color: #E2E8F0;
        }
        
        .hljs-dark .hljs-comment,
        .hljs-dark .hljs-quote {
          color: #94A3B8;
        }
        
        .hljs-dark .hljs-keyword,
        .hljs-dark .hljs-selector-tag {
          color: #60A5FA;
        }
        
        .hljs-dark .hljs-string,
        .hljs-dark .hljs-attr {
          color: #86EFAC;
        }
        
        .hljs-dark .hljs-number,
        .hljs-dark .hljs-literal {
          color: #F472B6;
        }
        
        .hljs-dark .hljs-title,
        .hljs-dark .hljs-name {
          color: #60A5FA;
        }
        
        /* Hide GitHub's light/dark themes when opposites are active */
        .hljs-light .github-dark {
          display: none !important;
        }
        
        .hljs-dark .github {
          display: none !important;
        }

        /* Make editor take full height */
        .EasyMDEContainer {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .EasyMDEContainer .CodeMirror {
          flex: 1;
          height: auto !important;
          border: none !important;
          border-radius: 0 !important;
        }
        .EasyMDEContainer .editor-toolbar {
          border-left: 0 !important;
          border-right: 0 !important;
          border-top: 0 !important;
        }

        /* Make simpleMDE full height */
        .markdown-editor-dark .EasyMDEContainer, 
        .markdown-editor-light .EasyMDEContainer {
          height: 100%;
        }

        /* Dark theme */
        .markdown-editor-dark .EasyMDEContainer .CodeMirror {
          background-color: #1e293b;
          color: #cbd5e1;
        }
        .markdown-editor-dark .EasyMDEContainer .CodeMirror-cursor {
          border-left-color: #60a5fa;
        }
        .markdown-editor-dark .editor-toolbar {
          background-color: #1e293b;
          border-bottom: 1px solid #334155;
        }
        .markdown-editor-dark .editor-toolbar > * {
          color: #94a3b8;
        }
        .markdown-editor-dark .editor-toolbar > .active, 
        .markdown-editor-dark .editor-toolbar > button:hover {
          background-color: #3b82f6;
          border-color: #2563eb;
          color: #ffffff;
        }
        .markdown-editor-dark .editor-statusbar {
          color: #94a3b8;
          background-color: #1e293b;
          border-color: #334155;
        }

        /* Light theme */
        .markdown-editor-light .EasyMDEContainer .CodeMirror {
          background-color: #ffffff;
          color: #334155;
        }
        .markdown-editor-light .editor-toolbar {
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }
        .markdown-editor-light .editor-toolbar > * {
          color: #475569;
        }
        .markdown-editor-light .editor-toolbar > .active, 
        .markdown-editor-light .editor-toolbar > button:hover {
          background-color: #2563eb;
          border-color: #1d4ed8;
          color: #ffffff;
        }
        .markdown-editor-light .editor-statusbar {
          color: #475569;
          background-color: #ffffff;
          border-color: #e2e8f0;
        }
      `}</style>
    </main>
  );
} 