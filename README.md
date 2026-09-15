# Markdown Studio (md-to-pdf)

A Markdown editor that exports polished, print-ready PDFs — with a live preview that shows exactly what you'll download.

## Features

**Editor**
- CodeMirror 6 with Markdown syntax highlighting, formatting toolbar and keyboard shortcuts
- Live preview (paper-accurate) and a real PDF preview
- Drag & drop / paste images; drop `.md` files to open them
- Templates (report, proposal, README, meeting notes, invoice, résumé)
- Import any web page as Markdown
- Autosave to the browser, light/dark interface

**Document design**
- 6 themes (Clean, Editorial, Corporate, Midnight, Forest, Mono) with an adjustable accent colour
- Body/heading fonts, text size, justified text
- A4 / Letter / Legal, portrait or landscape, four margin presets
- Page backgrounds (soft, gradient, dots, grid, lines)
- Logo: beside the title, above the title, in the page header, on the cover, or as a watermark
- Running header (text, date) and footer (text, page numbers)
- Cover page, table of contents, numbered headings
- Page-break control: automatic (smart), before every H1, or before every H1 and H2; manual `\pagebreak`

**Markdown**
- GitHub-flavoured Markdown, task lists, tables, footnotes
- GitHub-style callouts (`> [!NOTE]`, `[!TIP]`, `[!WARNING]`, …)
- Syntax-highlighted code blocks with optional titles (```` ```ts title="file.ts" ````)
- Mermaid diagrams, emoji, image captions and size hints (`![alt](img.png =300x)`)
- Embedded images via `![alt](asset:name.png)`

## Development

```bash
npm install
npm run dev
```

PDFs are rendered with headless Chromium. Locally, an installed Google Chrome is used automatically (or set `PUPPETEER_EXECUTABLE_PATH`). On Vercel/Lambda, `@sparticuz/chromium-min` downloads a matching Chromium build at runtime.

## API

### `POST /api/convert`

Renders Markdown to a PDF.

```json
{
  "markdown": "# Hello\n\nWorld",
  "fileName": "hello.md",
  "settings": {
    "theme": "corporate",
    "paperSize": "A4",
    "orientation": "portrait",
    "margins": "normal",
    "font": "inherit",
    "fontSize": "md",
    "background": "none",
    "toc": true,
    "headingNumbers": false,
    "pageBreaks": "auto",
    "header": { "text": "{title}", "showDate": true },
    "footer": { "text": "Confidential", "pageNumbers": true, "pageNumberStyle": "n-of-total" },
    "cover": { "enabled": false },
    "logo": { "dataUrl": "data:image/png;base64,...", "position": "title-right", "size": "md" }
  },
  "assets": { "diagram.png": "data:image/png;base64,..." }
}
```

All `settings` keys are optional; see `src/lib/document/settings.js` for every value. The legacy body shape (`{ "markdown", "theme": "light" | "dark", "paperSize" }`) is still accepted.

Options: `"inline": true` returns `Content-Disposition: inline`; `"format": "html"` returns the rendered HTML instead of a PDF.

### `GET /api/scrape?url=…` and `GET /api/scrapehtml?url=…`

Fetches a web page in headless Chromium, strips navigation/ads and returns the main content as Markdown or HTML:

```json
{ "status": "Ok", "page": { "url": "…", "title": "…", "content": "…" }, "metadata": { "duration": 1234, "timestamp": "…" } }
```

## Project layout

```
src/lib/document/   isomorphic renderer: settings → CSS, markdown → HTML (shared by preview and PDF)
src/lib/pdf/        Chromium launcher and PDF generation
src/lib/scraper/    web page → Markdown/HTML
src/components/     editor UI (CodeMirror, toolbar, design panel, preview)
src/app/api/        route handlers
```
