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

## For AI agents (MCP)

Markdown Studio ships a remote **MCP server** so coding agents (Cursor, Claude Code, Claude Desktop, VS Code Copilot, Codex, ChatGPT, …) can write better-formatted Markdown and export PDFs directly:

```
https://md.dima.ua/api/mcp
```

Streamable HTTP, stateless, no sign-up. It teaches the agent the exact syntax this renderer supports, lints the document, and renders it.

| Tool | What it does |
| --- | --- |
| `get_markdown_guide` | The authoring guide: supported syntax, structure rules, design settings, recipes per document type, anti-patterns |
| `list_design_options` | Every valid `settings` value (themes with colours/fonts, paper sizes, margins, backgrounds, …) |
| `list_templates` / `get_template` | Starter documents (report, proposal, README, meeting notes, invoice, résumé) with matching settings |
| `analyze_markdown` | Linter: outline, stats and line-numbered warnings (skipped heading levels, fences without a language, YAML front-matter, LaTeX, raw HTML, ragged tables, missing assets, undefined footnotes…) |
| `render_html` | Standalone HTML with the same CSS as the PDF (fast, no browser) |
| `render_pdf` | The PDF, returned as a base64 `application/pdf` embedded resource |

Also exposed: resources `markdown-studio://guide`, `markdown-studio://design-options`, `markdown-studio://templates/{id}` and prompts `write_document`, `polish_markdown`.

### Connect

The quickest way: click **Add to AI agent** in the app's top bar (or open [md.dima.ua/#add-to-agent](https://md.dima.ua/#add-to-agent)), pick your agent, and it opens the app with the server pre-configured (Cursor, VS Code, Goose) or gives you the exact command / snippet (Claude Code, Codex, Gemini CLI, Claude Desktop, ChatGPT, Windsurf).

Manual options:

**Cursor** — [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=markdown-studio&config=eyJ1cmwiOiJodHRwczovL21kLmRpbWEudWEvYXBpL21jcCJ9) or put this in `.cursor/mcp.json` (project) / `~/.cursor/mcp.json` (global):

```json
{ "mcpServers": { "markdown-studio": { "url": "https://md.dima.ua/api/mcp" } } }
```

**Claude Code**

```bash
claude mcp add --transport http markdown-studio https://md.dima.ua/api/mcp
```

**Claude Desktop / ChatGPT / other remote-MCP clients** — add a custom connector with the URL above.

**VS Code** (`.vscode/mcp.json`)

```json
{ "servers": { "markdown-studio": { "type": "http", "url": "https://md.dima.ua/api/mcp" } } }
```

**Codex CLI** (`~/.codex/config.toml`)

```toml
[mcp_servers.markdown-studio]
url = "https://md.dima.ua/api/mcp"
```

**stdio-only clients** — bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote): `npx -y mcp-remote https://md.dima.ua/api/mcp`.

### Install as a plugin

The repository is also a plugin (MCP server + skill + rule), so agents pick up the know-how even before the server is connected:

- **Cursor** — Settings → Plugins → add from GitHub `dimka3553/md-to-pdf`, or *Settings → Rules → Add Rule → Remote Rule (GitHub)* with the same repo.
- **Claude Code** — `/plugin marketplace add dimka3553/md-to-pdf`, then `/plugin install markdown-studio`.
- **Any agent with skills** — `npx skills add https://github.com/dimka3553/md-to-pdf`, or copy `skills/markdown-studio/` into your agent's skills directory (`~/.cursor/skills/`, `~/.claude/skills/`, `~/.codex/skills/`, …).

`skills/markdown-studio/SKILL.md` is generated from `src/lib/mcp/guide.js` — edit the guide and run `npm run build:skill`.

### Optional authentication

The server is open by default. To restrict it, set the `MCP_API_KEY` environment variable on your deployment; clients must then send the key as a bearer token (or `?key=` in the URL for clients without header support):

```json
{ "mcpServers": { "markdown-studio": { "url": "https://your-host/api/mcp", "headers": { "Authorization": "Bearer <key>" } } } }
```

### Self-hosting the MCP server

The MCP endpoint is part of this Next.js app — deploy the app and it's live at `/api/mcp`. Locally, `npm run dev` serves it at `http://localhost:3000/api/mcp`.

## Development

```bash
npm install
npm run dev
```

PDFs are rendered with headless Chromium. Locally, an installed Google Chrome is used automatically (or set `PUPPETEER_EXECUTABLE_PATH`). On Vercel/Lambda, `@sparticuz/chromium-min` downloads a matching Chromium build at runtime.

Environment variables (all optional): `NEXT_PUBLIC_SITE_URL` (public URL used in metadata and MCP responses), `MCP_API_KEY` (protects `/api/mcp`), `PUPPETEER_EXECUTABLE_PATH`.

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
src/lib/mcp/        MCP server: authoring guide, linter, tool/resource/prompt registration
src/lib/scraper/    web page → Markdown/HTML
src/components/     editor UI (CodeMirror, toolbar, design panel, preview)
src/app/api/        route handlers (convert, mcp, scrape)
skills/, rules/     Agent Skill + Cursor rule shipped with the plugin (.cursor-plugin, .claude-plugin, .mcp.json)
```
