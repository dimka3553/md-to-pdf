/**
 * Complete argument catalog for Markdown Studio MCP tools.
 *
 * Built from the same constants the renderer uses, so new themes/fonts/etc.
 * show up in server instructions, the authoring guide, and tool schemas
 * without a second hand-written list.
 */

import {
  BACKGROUNDS,
  DEFAULT_SETTINGS,
  FONTS,
  FONT_SIZES,
  LOGO_POSITIONS,
  LOGO_SIZES,
  MARGINS,
  PAGE_BREAK_MODES,
  PAPER_SIZES,
  THEMES,
} from '../document/settings.js';
import { MAX_ASSETS, MAX_ASSET_BYTES, MAX_MARKDOWN_BYTES, MAX_TOTAL_ASSET_BYTES } from '../document/limits.js';
import { TEMPLATES } from '../templates.js';

const keys = (o) => Object.keys(o);
const quoted = (arr) => arr.map((k) => `"${k}"`).join(', ');

function mdTable(headers, rows) {
  const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const head = `| ${headers.map(cell).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  return [head, sep, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
}

function themeRow([id, t]) {
  const heading = t.defaultHeadingFont === 'same' ? t.defaultFont : t.defaultHeadingFont;
  return [
    `\`${id}\``,
    t.name,
    t.description,
    t.accent,
    t.dark ? 'dark' : 'light',
    `\`${t.defaultFont}\` / \`${heading}\``,
  ];
}

export const FONT_IDS = keys(FONTS);
export const THEME_IDS = keys(THEMES);
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

export const FIELD_HELP = {
  markdown: `The full GitHub-flavoured Markdown source (max ${MAX_MARKDOWN_BYTES / (1024 * 1024)} MB). Always pass the entire document — tools are stateless.`,
  fileName: 'Preferred output file name without extension (max 120 chars). Defaults to the first H1 / inferred title. Do not include .pdf or .html.',
  assets: `Embedded images as a map of name → data URL (\`data:image/png;base64,…\`, JPEG, SVG, WebP, GIF). Reference in Markdown as \`![alt](asset:name)\`. Max ${MAX_ASSETS} images, ${MAX_ASSET_BYTES / (1024 * 1024)} MB each, ${MAX_TOTAL_ASSET_BYTES / (1024 * 1024)} MB total. Remote HTTPS images can be used in Markdown without this map.`,
  settings: 'Document design settings. Every key is optional and merged over the defaults. You MUST list these options to the user and wait for their answer before calling render_pdf. Default chrome: no running header (do not put the title on every page).',
  theme: `Colour and typography theme. One of ${quoted(THEME_IDS)}. Default "${DEFAULT_SETTINGS.theme}".`,
  font: `Body font. "inherit" uses the theme default. Otherwise one of ${quoted(FONT_IDS)}. Default "${DEFAULT_SETTINGS.font}".`,
  headingFont: `Heading font. "inherit" uses the theme default. Otherwise one of ${quoted(FONT_IDS)}. Default "${DEFAULT_SETTINGS.headingFont}".`,
  fontSize: `Body size: ${Object.entries(FONT_SIZES)
    .map(([k, v]) => `"${k}" = ${v.label} (${v.name})`)
    .join(', ')}. Default "${DEFAULT_SETTINGS.fontSize}".`,
  accentColor: 'Override the theme accent as "#rgb" or "#rrggbb" (e.g. "#0F4C81"). Omit to keep the theme colour. Do not pass an empty string.',
  paperSize: `Page size: ${Object.entries(PAPER_SIZES)
    .map(([k, v]) => `"${k}" (${v.name})`)
    .join(', ')}. Default "${DEFAULT_SETTINGS.paperSize}".`,
  orientation: `"portrait" or "landscape". Default "${DEFAULT_SETTINGS.orientation}". Use landscape for wide tables.`,
  margins: `Page margins: ${Object.entries(MARGINS)
    .map(([k, v]) => `"${k}" (${v.name})`)
    .join(', ')}. Default "${DEFAULT_SETTINGS.margins}".`,
  background: `Subtle full-page texture: ${Object.entries(BACKGROUNDS)
    .map(([k, v]) => `"${k}" (${v.name})`)
    .join(', ')}. Default "${DEFAULT_SETTINGS.background}".`,
  pageBreaks: `Pagination: ${Object.entries(PAGE_BREAK_MODES)
    .map(([k, v]) => `"${k}" (${v.name})`)
    .join(', ')}. Default "${DEFAULT_SETTINGS.pageBreaks}". Auto keeps headings and short introductions with compact tables/blocks, and the opening rows of longer tables. For an editorial break, put \\pagebreak on a separate paragraph BEFORE the section heading, or \`{: .newpage }\` at the end of the heading line. Inspect the rendered PDF after layout changes.`,
  toc: `Insert a generated table of contents from ## / ### (after the title, or on its own page when a cover is on). Default ${DEFAULT_SETTINGS.toc}. Do not write a TOC by hand.`,
  headingNumbers: `Auto-number H1–H3 as 1 / 1.1 / 1.1.1. Default ${DEFAULT_SETTINGS.headingNumbers}. Do not number headings by hand.`,
  justify: `Justify body paragraphs. Default ${DEFAULT_SETTINGS.justify}.`,
  headerText: 'Running header (max 200 chars). Leave empty by default — the `#` heading already prints the title once. Do not set this to the document title or "{title}"; repeating it on every page looks like a duplicate masthead. Only set a short brand line when the user explicitly asks for a header that is not the title. No emoji. To pair text with a logo on every page, also set logo.position="page-header" and logo.aspect to the image width / height.',
  headerShowDate: `Show today's date on the right of the header. Default ${DEFAULT_SETTINGS.header.showDate}.`,
  footerText: 'Running footer (max 200 chars). Supports "{title}". Keep short; no emoji.',
  footerPageNumbers: `Show page numbers. Default ${DEFAULT_SETTINGS.footer.pageNumbers}.`,
  footerPageNumberStyle: `"n-of-total" → "3 / 12", "n" → "3". Default "${DEFAULT_SETTINGS.footer.pageNumberStyle}".`,
  coverEnabled: `Full cover page before the document. Default ${DEFAULT_SETTINGS.cover.enabled}.`,
  coverTitle: 'Cover title (max 300). Defaults to the document H1 when omitted or empty.',
  coverSubtitle: 'Cover subtitle (max 500).',
  coverAuthor: 'Cover author / prepared-by line (max 200).',
  coverDate: 'Cover date line (max 100). Any string — not parsed.',
  coverShowLogo: `Draw the logo on the cover when a logo is set. Default ${DEFAULT_SETTINGS.cover.showLogo}.`,
  logoDataUrl: 'PNG/JPEG/SVG/WebP/GIF as a data URL starting with "data:image/". Required if logo is set.',
  logoName: 'Optional logo file name (max 200).',
  logoPosition: `Placement: ${Object.entries(LOGO_POSITIONS)
    .map(([k, v]) => `"${k}" (${v.name})`)
    .join(', ')}. Default "title-right".`,
  logoSize: `Height: ${Object.entries(LOGO_SIZES)
    .map(([k, v]) => `"${k}" (${v.name}, ${v.px}px)`)
    .join(', ')}. Default "md".`,
  logoAspect: 'width / height of the image, used when the logo is drawn in the page header. Optional; default 1.',
  templateId: `Template id: ${quoted(TEMPLATE_IDS)}.`,
  url: 'Public http(s) URL of the page to import (max 2048 chars). "https://" is assumed when the scheme is missing. localhost and private-network hosts are rejected.',
  importFormat: '"markdown" (default) converts the main content to GitHub-flavoured Markdown and runs analyze_markdown on it; "html" returns the cleaned HTML fragment instead.',
  stripImages: 'Remove every image from the result. Default false. Use when the page is image-heavy or the images are decorative.',
  stripLinks: 'Replace hyperlinks with their text (images are kept). Default false. Handy for print where links are not clickable anyway.',
};

/**
 * Gate before every render: list style options and wait. Shared by server
 * instructions, the authoring guide, the render_pdf description and the skill.
 */
export const ASK_STYLES_INSTRUCTIONS = `## Before rendering: ask for styles every time

Do **not** call \`render_pdf\` until you have listed the design options below in plain language and the user has replied. This is required on every request — first render, re-render, "just make a PDF", "looks good, export it", prompts, and follow-ups. Showing options in the server instructions or this guide does not count; the person in the chat has to see them and answer.

1. **List the knobs** (names, not raw JSON): theme, accent, fonts, size, background, paper, orientation, margins, TOC, numbered headings, cover, page breaks, running header/footer, page numbers, logo, file name.
2. **Recommend a starting set** for this document type (see recipes). Default chrome is **minimal**: empty running header, no date in the header, footer page numbers only.
3. **Wait.** If they pick, use their picks. If they say "you decide" *after seeing the options*, apply the recommendation. Do not skip the ask.

### Keep the top of the page empty

The \`#\` title already appears once as the document heading. Do **not** also put it in \`header.text\` (including \`{title}\`, the file name, or a paraphrase of the H1). That prints a second title on every page.

Default unless the user explicitly asks otherwise:

- \`header.text\`: \`""\` (no running header)
- \`header.showDate\`: \`false\`
- \`footer.pageNumbers\`: \`true\`
- \`footer.text\`: \`""\` (add a short line only if they want "Confidential" or a company name)

A running header is for a **brand line or logo that is not the document title**, and only when they asked for one.`;

/**
 * What the agent must do the moment `render_pdf` returns. Shared by the server
 * instructions, the authoring guide, the tool description/result and the skill.
 */
export const OPEN_PDF_INSTRUCTIONS = `## After rendering: give the user the download URL

\`render_pdf\` does **not** send the PDF as base64. Many clients drop \`application/pdf\` resources, and a real PDF is hundreds of kilobytes of tokens. The file is stored for 24 hours and the tool result's **text** block contains a URL: \`https://<host>/d/<id>.pdf\`. Text always survives. There is also an MCP \`resource_link\` to the same URL.

The moment the tool returns, show that URL to the user — automatically, without asking. Never stop at "the PDF is ready". Never try to \`base64 -d\` an attachment that is not there. If the client prints "Resources of type 'application/pdf' are not currently supported", ignore it; the download URL is the file.

1. **Put the URL in your reply** as a markdown link named with the file name, e.g. \`[Offer.pdf](https://…/d/….pdf)\`. That is the deliverable in every client.
2. **Open it inline only when this client actually can:**
   - **Cursor:** create a canvas (\`~/.cursor/projects/<workspace>/canvases/<file-name>.canvas.tsx\`) whose viewer is \`<iframe src={DOWNLOAD_URL} title="…" style={{ width: "100%", height: "100vh", border: 0 }} />\`. Use the https URL from the tool result, not a data URI. One-line header with file name, paper and theme. Link the canvas beside the chat. Do not launch Preview, Chrome, or \`open\`.
   - **Claude Desktop / claude.ai / ChatGPT:** present the markdown link. If you have a files/outputs tool, you may download the URL into that folder and attach the saved file — do not retype the PDF, do not paste the styled HTML as a substitute, and do not POST to \`/api/convert\` unless the user is on a host that can reach it.
   - **CLI with a writable disk and egress to the host:** \`curl -L -o <fileName> '<downloadUrl>'\` and print the path.
3. Confirm the file name, theme, paper and that the link expires in 24 hours. When the user asks for changes, re-render and replace the previous link (and the same canvas, in Cursor).

If you need a quick look at styling without a PDF, call \`render_html\` (\`text/html\` usually passes through). Do not rebuild the PDF in a local browser to work around a missing blob.`;

/** Human-readable catalog for server instructions, get_markdown_guide, and the skill. */
export function buildArgumentCatalog() {
  const themeTable = mdTable(
    ['Id', 'Name', 'Feel', 'Accent', 'Page', 'Default body / heading font'],
    Object.entries(THEMES).map(themeRow),
  );

  const fontTable = mdTable(
    ['Id', 'Name', 'Kind'],
    Object.entries(FONTS).map(([id, f]) => [`\`${id}\``, f.name, f.kind]),
  );

  const sizeTable = mdTable(
    ['Id', 'Name', 'Body'],
    Object.entries(FONT_SIZES).map(([id, f]) => [`\`${id}\``, f.name, f.label]),
  );

  const paperTable = mdTable(
    ['Id', 'Name'],
    Object.entries(PAPER_SIZES).map(([id, p]) => [`\`${id}\``, p.name]),
  );

  const marginTable = mdTable(
    ['Id', 'Name'],
    Object.entries(MARGINS).map(([id, m]) => [`\`${id}\``, m.name]),
  );

  const bgTable = mdTable(
    ['Id', 'Name'],
    Object.entries(BACKGROUNDS).map(([id, b]) => [`\`${id}\``, b.name]),
  );

  const breakTable = mdTable(
    ['Id', 'Name'],
    Object.entries(PAGE_BREAK_MODES).map(([id, p]) => [`\`${id}\``, p.name]),
  );

  const logoPosTable = mdTable(
    ['Id', 'Name'],
    Object.entries(LOGO_POSITIONS).map(([id, l]) => [`\`${id}\``, l.name]),
  );

  const logoSizeTable = mdTable(
    ['Id', 'Name', 'Height'],
    Object.entries(LOGO_SIZES).map(([id, l]) => [`\`${id}\``, l.name, `${l.px}px`]),
  );

  const templateTable = mdTable(
    ['Id', 'Name', 'Description'],
    TEMPLATES.map((t) => [`\`${t.id}\``, t.name, t.description.replace(/\|/g, '\\|')]),
  );

  return `${ASK_STYLES_INSTRUCTIONS}

When listing options, in plain language offer:

- **Look** — theme (${THEME_IDS.join(', ')}), optional accent colour, body/heading fonts, size (compact / comfortable / large), page background
- **Page** — paper (${keys(PAPER_SIZES).join(', ')}), portrait or landscape, margins (narrow / normal / wide)
- **Structure** — table of contents, numbered headings, cover page (title, subtitle, author, date), automatic page breaks
- **Chrome** — default is none at the top (no running header, no repeated title). Optional: a short brand line that is **not** the H1, date in the header, footer text, page numbers ("3 / 12" or "3"), logo
- **File name** — optional; otherwise taken from the H1

Recommend a starting set from the recipes (report → corporate + TOC + cover + **no running header**, README → clean + TOC, invoice → mono, and so on). Then wait.

${OPEN_PDF_INSTRUCTIONS}

## Tool arguments

All tools are stateless. Pass the full Markdown every time.

### \`get_markdown_guide\`

No arguments. Returns this guide (syntax + every setting).

### \`list_design_options\`

No arguments. Returns JSON: defaults, themes (colours and default fonts), fonts, sizes, paper, margins, backgrounds, page-break modes, logo placement, and the \`{title}\` placeholder.

### \`list_templates\`

No arguments. Returns id, name, description and recommended \`settings\` for each starter.

### \`get_template\`

| Argument | Required | Meaning |
| --- | --- | --- |
| \`id\` | yes | ${FIELD_HELP.templateId} |

${templateTable}

Returns the Markdown skeleton and the \`settings\` it was designed with. Use the structure; still ask the user about styles before \`render_pdf\`, and do not copy a running header that repeats the title.

### \`analyze_markdown\`

| Argument | Required | Meaning |
| --- | --- | --- |
| \`markdown\` | yes | ${FIELD_HELP.markdown} |
| \`settings\` | no | Same object as render. Currently only \`settings.toc\` changes linting (hand-written TOC vs generated). |
| \`assets\` | no | ${FIELD_HELP.assets} |

Fix every \`"warning"\` before rendering. \`"info"\` items are suggestions.

### \`import_web_page\`

Renders a public web page in headless Chromium (5–25 s) — waiting for JavaScript and scrolling so lazy-loaded content appears — removes navigation, ads, banners and sidebars based on the rendered layout, keeps the visible content in reading order and converts it to GitHub-flavoured Markdown (headings, lists, tables, fenced code with language, \`> [!NOTE]\` callouts, figures, math, absolute links and images). Returns a summary (metadata, stats, warnings), a \`structuredContent\` object (\`url\`, \`title\`, \`description\`, \`siteName\`, \`author\`, \`published\`, \`canonical\`, \`fileName\`, \`stats\`, \`outline\`, \`warnings\`) and the content as an embedded \`text/markdown\` (or \`text/html\`) resource.

| Argument | Required | Meaning |
| --- | --- | --- |
| \`url\` | yes | ${FIELD_HELP.url} |
| \`format\` | no | ${FIELD_HELP.importFormat} |
| \`stripImages\` | no | ${FIELD_HELP.stripImages} |
| \`stripLinks\` | no | ${FIELD_HELP.stripLinks} |

Use it whenever the user hands you a URL. Then polish the Markdown (fix the reported warnings, delete leftover "share"/"related" fragments, add a source footnote), ask for styles, and pass it to \`render_pdf\`. Without MCP the same import is \`GET /api/scrape?url=…&images=true&links=true\` (or \`/api/scrapehtml\`).

### \`render_pdf\` / \`render_html\`

Same arguments. \`render_pdf\` uses headless Chromium (3–15 s) and returns a 24-hour download URL in the text (\`https://<host>/d/<id>.pdf\`) plus an MCP \`resource_link\` — not a base64 PDF. Do not call it until you have listed style options and the user has answered. \`render_html\` is fast and returns standalone HTML with the same CSS. As soon as \`render_pdf\` returns, give the user that URL (see **After rendering** above).

| Argument | Required | Meaning |
| --- | --- | --- |
| \`markdown\` | yes | ${FIELD_HELP.markdown} |
| \`settings\` | no | ${FIELD_HELP.settings} |
| \`assets\` | no | ${FIELD_HELP.assets} |
| \`fileName\` | no | ${FIELD_HELP.fileName} |

### \`settings\` object

Every key is optional. Unknown keys are ignored. Nested objects are merged field-by-field over the defaults.

${mdTable(
    ['Key', 'Type', 'Default', 'Allowed / notes'],
    [
      ['`theme`', 'enum', `\`${DEFAULT_SETTINGS.theme}\``, FIELD_HELP.theme],
      ['`font`', 'enum', `\`${DEFAULT_SETTINGS.font}\``, FIELD_HELP.font],
      ['`headingFont`', 'enum', `\`${DEFAULT_SETTINGS.headingFont}\``, FIELD_HELP.headingFont],
      ['`fontSize`', 'enum', `\`${DEFAULT_SETTINGS.fontSize}\``, FIELD_HELP.fontSize],
      ['`accentColor`', 'hex string', 'theme accent', FIELD_HELP.accentColor],
      ['`paperSize`', 'enum', `\`${DEFAULT_SETTINGS.paperSize}\``, FIELD_HELP.paperSize],
      ['`orientation`', 'enum', `\`${DEFAULT_SETTINGS.orientation}\``, FIELD_HELP.orientation],
      ['`margins`', 'enum', `\`${DEFAULT_SETTINGS.margins}\``, FIELD_HELP.margins],
      ['`background`', 'enum', `\`${DEFAULT_SETTINGS.background}\``, FIELD_HELP.background],
      ['`pageBreaks`', 'enum', `\`${DEFAULT_SETTINGS.pageBreaks}\``, FIELD_HELP.pageBreaks],
      ['`toc`', 'boolean', String(DEFAULT_SETTINGS.toc), FIELD_HELP.toc],
      ['`headingNumbers`', 'boolean', String(DEFAULT_SETTINGS.headingNumbers), FIELD_HELP.headingNumbers],
      ['`justify`', 'boolean', String(DEFAULT_SETTINGS.justify), FIELD_HELP.justify],
      ['`header`', 'object', 'see below', 'Running header. Partial object is fine.'],
      ['`header.text`', 'string ≤200', 'empty', FIELD_HELP.headerText],
      ['`header.showDate`', 'boolean', String(DEFAULT_SETTINGS.header.showDate), FIELD_HELP.headerShowDate],
      ['`footer`', 'object', 'see below', 'Running footer. Partial object is fine.'],
      ['`footer.text`', 'string ≤200', 'empty', FIELD_HELP.footerText],
      ['`footer.pageNumbers`', 'boolean', String(DEFAULT_SETTINGS.footer.pageNumbers), FIELD_HELP.footerPageNumbers],
      ['`footer.pageNumberStyle`', 'enum', `\`${DEFAULT_SETTINGS.footer.pageNumberStyle}\``, FIELD_HELP.footerPageNumberStyle],
      ['`cover`', 'object', 'see below', 'Cover page. Partial object is fine.'],
      ['`cover.enabled`', 'boolean', String(DEFAULT_SETTINGS.cover.enabled), FIELD_HELP.coverEnabled],
      ['`cover.title`', 'string ≤300', 'document H1', FIELD_HELP.coverTitle],
      ['`cover.subtitle`', 'string ≤500', 'empty', FIELD_HELP.coverSubtitle],
      ['`cover.author`', 'string ≤200', 'empty', FIELD_HELP.coverAuthor],
      ['`cover.date`', 'string ≤100', 'empty', FIELD_HELP.coverDate],
      ['`cover.showLogo`', 'boolean', String(DEFAULT_SETTINGS.cover.showLogo), FIELD_HELP.coverShowLogo],
      ['`logo`', 'object or `null`', '`null`', 'Set to `null` to remove a logo. Requires `dataUrl` when present.'],
      ['`logo.dataUrl`', 'data URL', '—', FIELD_HELP.logoDataUrl],
      ['`logo.name`', 'string ≤200', '`logo`', FIELD_HELP.logoName],
      ['`logo.position`', 'enum', '`title-right`', FIELD_HELP.logoPosition],
      ['`logo.size`', 'enum', '`md`', FIELD_HELP.logoSize],
      ['`logo.aspect`', 'number > 0', '`1`', FIELD_HELP.logoAspect],
    ],
  )}

#### Themes

${themeTable}

#### Fonts

Plus \`"inherit"\` on \`font\` / \`headingFont\` to keep the theme default.

${fontTable}

#### Font sizes

${sizeTable}

#### Paper

${paperTable}

#### Margins

${marginTable}

#### Backgrounds

${bgTable}

#### Page breaks

${breakTable}

#### Logo position and size

${logoPosTable}

${logoSizeTable}

Placeholders: \`{title}\` in \`header.text\` / \`footer.text\` becomes the document title (the first H1). Do not put \`{title}\` in the running header by default — the H1 already prints once. Forced page break in Markdown: \`\\\\pagebreak\` or \`<!-- pagebreak -->\` on its own line, or \`{: .newpage }\` on a heading. Image size hint: \`![alt](url =WIDTHxHEIGHT)\` (either dimension may be omitted, e.g. \`=300x\`).

### Prompt arguments

**\`write_document\`**

| Argument | Required | Meaning |
| --- | --- | --- |
| \`brief\` | yes | What the document is about, who it is for, and any facts to include. |
| \`kind\` | no | One of \`"report"\`, \`"proposal"\`, \`"readme"\`, \`"meeting"\`, \`"invoice"\`, \`"resume"\`, \`"other"\`. |

**\`polish_markdown\`**

| Argument | Required | Meaning |
| --- | --- | --- |
| \`markdown\` | yes | Existing Markdown to reformat without changing meaning. |

**\`make_pdf\`**

| Argument | Required | Meaning |
| --- | --- | --- |
| \`brief\` | no | What to write if there is no Markdown yet. |
| \`markdown\` | no | Existing Markdown to render. |
| \`audience\` | no | Who will read it (affects theme and density recommendations). |

**\`pdf_from_url\`**

| Argument | Required | Meaning |
| --- | --- | --- |
| \`url\` | yes | The public web page to import. |
| \`audience\` | no | Who will read the PDF (affects theme and density recommendations). |
| \`notes\` | no | What to keep, drop or change during clean-up. |

Limits: Markdown ≤ ${MAX_MARKDOWN_BYTES / (1024 * 1024)} MB; ${MAX_ASSETS} images; ${MAX_ASSET_BYTES / (1024 * 1024)} MB per image; ${MAX_TOTAL_ASSET_BYTES / (1024 * 1024)} MB images combined.
`;
}

export const ARGUMENT_CATALOG = buildArgumentCatalog();
