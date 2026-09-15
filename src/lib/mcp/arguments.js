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
  settings: 'Document design settings. Every key is optional and merged over the defaults. When a user asks for a nice PDF, present these options (names below) so they can choose, then pass the chosen values here.',
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
    .join(', ')}. Default "${DEFAULT_SETTINGS.pageBreaks}".`,
  toc: `Insert a generated table of contents from ## / ### (after the title, or on its own page when a cover is on). Default ${DEFAULT_SETTINGS.toc}. Do not write a TOC by hand.`,
  headingNumbers: `Auto-number H1–H3 as 1 / 1.1 / 1.1.1. Default ${DEFAULT_SETTINGS.headingNumbers}. Do not number headings by hand.`,
  justify: `Justify body paragraphs. Default ${DEFAULT_SETTINGS.justify}.`,
  headerText: 'Running header (max 200 chars). "{title}" is replaced with the document title. Keep short; no emoji.',
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
};

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

  return `## Relaying options to the user

When someone asks you to make a nice PDF, tell them the knobs they can turn — do not hide them. In plain language, offer:

- **Look** — theme (${THEME_IDS.join(', ')}), optional accent colour, body/heading fonts, size (compact / comfortable / large), page background
- **Page** — paper (${keys(PAPER_SIZES).join(', ')}), portrait or landscape, margins (narrow / normal / wide)
- **Structure** — table of contents, numbered headings, cover page (title, subtitle, author, date), automatic page breaks
- **Chrome** — running header/footer text, date in the header, page numbers ("3 / 12" or "3"), logo placement
- **File name** — optional; otherwise taken from the H1

Recommend a starting set from the recipes (report → corporate + TOC + cover, README → clean + TOC, invoice → mono, and so on). If they say "just make it look good", apply the matching recipe and mention what you chose.

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

Returns the Markdown skeleton and the \`settings\` it was designed with. Pass those settings through to \`render_pdf\` unless the user overrides them.

### \`analyze_markdown\`

| Argument | Required | Meaning |
| --- | --- | --- |
| \`markdown\` | yes | ${FIELD_HELP.markdown} |
| \`settings\` | no | Same object as render. Currently only \`settings.toc\` changes linting (hand-written TOC vs generated). |
| \`assets\` | no | ${FIELD_HELP.assets} |

Fix every \`"warning"\` before rendering. \`"info"\` items are suggestions.

### \`render_pdf\` / \`render_html\`

Same arguments. \`render_pdf\` uses headless Chromium (3–15 s) and returns a base64 \`application/pdf\` resource. \`render_html\` is fast and returns standalone HTML with the same CSS.

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

Placeholders: \`{title}\` in \`header.text\` / \`footer.text\` becomes the document title (the first H1). Forced page break in Markdown: \`\\\\pagebreak\` or \`<!-- pagebreak -->\` on its own line. Image size hint: \`![alt](url =WIDTHxHEIGHT)\` (either dimension may be omitted, e.g. \`=300x\`).

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

Limits: Markdown ≤ ${MAX_MARKDOWN_BYTES / (1024 * 1024)} MB; ${MAX_ASSETS} images; ${MAX_ASSET_BYTES / (1024 * 1024)} MB per image; ${MAX_TOTAL_ASSET_BYTES / (1024 * 1024)} MB images combined.
`;
}

export const ARGUMENT_CATALOG = buildArgumentCatalog();
