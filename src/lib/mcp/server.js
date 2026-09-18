import { z } from 'zod';
import { ResourceTemplate } from '@modelcontextprotocol/server';
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
  normalizeSettings,
} from '../document/settings.js';
import { buildDocumentHtml } from '../document/html.js';
import { inferTitle } from '../document/utils.js';
import { assertMarkdownSize, sanitizeAssets, safeFileName } from '../document/limits.js';
import { TEMPLATES, getTemplate } from '../templates.js';
import { renderPdf } from '../pdf/generate.js';
import { describeScrapeError, sanitizeUrl, scrapePage, validateUrl } from '../scraper/scraper.js';
import { analyzeMarkdown } from './analyze.js';
import { ARGUMENT_CATALOG, FIELD_HELP, TEMPLATE_IDS } from './arguments.js';
import { GUIDE_VERSION, MARKDOWN_GUIDE } from './guide.js';
import { persistDownload } from '../downloads.js';
import { SITE_URL } from '../site.js';

export const SERVER_INFO = { name: 'markdown-studio', version: GUIDE_VERSION };

export const SERVER_INSTRUCTIONS = `Markdown Studio turns Markdown into polished, print-ready PDFs (themes, cover page, table of contents, running header/footer, callouts, Mermaid diagrams, syntax-highlighted code).

When a user asks you to make a nice PDF, you MUST list the design options (theme, paper, fonts, TOC, cover, header/footer, logo, file name) in plain language, recommend a starting set, and wait for their answer before calling render_pdf. Do this every time, including re-renders. Default chrome is minimal: no running header — never repeat the document title at the top of every page; the H1 already prints once. Call list_design_options if you need the live enum JSON.

Recommended flow:
1. Call get_markdown_guide once per session and follow it — it lists which syntax renders (no LaTeX, no HTML layouts, no YAML front-matter) and every tool/settings argument.
2. Optionally call list_templates / get_template for a proven structure and matching design settings.
3. List style options, recommend a starting set (empty running header), and wait. Do not call render_pdf until they pick or say you may decide.
4. Write the Markdown, then call analyze_markdown and fix every warning. Default to automatic pagination; for deliberate section boundaries put \\pagebreak on its own paragraph BEFORE the heading (or \`{: .newpage }\` on the heading), never between its introduction and table. Do not put \`---\` above headings — H2s already have a rule. See the guide's Page breaks rules.
5. Call render_pdf (returns a 24-hour download URL in the text, not a base64 PDF) or render_html. Read the LAYOUT REPORT in the result — it lists every page, where each block sits (y% from the top), how it looks (type, colour, size), and where page breaks happened. Fix stranded headings or sparse pages with \\pagebreak / \`{: .newpage }\` and re-render. Do not screenshot the PDF (or open it in a browser) to find page breaks; analyze_markdown cannot assess physical page layout.
6. Immediately give the user that download URL (markdown link). In Cursor, also open it in a canvas whose iframe src is the URL. Details under "After rendering" below.
All tools are stateless; pass the full markdown each time.

When the source is a web page (an article, docs page, blog post, changelog…), call import_web_page with the URL first: it loads the page in a headless browser, strips navigation/ads and returns clean Markdown plus an analysis. Then polish that Markdown (fix the warnings), ask for styles, and render it — do not re-type page content from memory.

${ARGUMENT_CATALOG}`;

const keys = (o) => Object.keys(o);

// ---- Schemas -----------------------------------------------------------------------------------

const HexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Use #rgb or #rrggbb');

export const SettingsSchema = z
  .object({
    theme: z.enum(keys(THEMES)).describe(FIELD_HELP.theme),
    font: z.enum(['inherit', ...keys(FONTS)]).describe(FIELD_HELP.font),
    headingFont: z.enum(['inherit', ...keys(FONTS)]).describe(FIELD_HELP.headingFont),
    fontSize: z.enum(keys(FONT_SIZES)).describe(FIELD_HELP.fontSize),
    accentColor: HexColor.describe(FIELD_HELP.accentColor),
    paperSize: z.enum(keys(PAPER_SIZES)).describe(FIELD_HELP.paperSize),
    orientation: z.enum(['portrait', 'landscape']).describe(FIELD_HELP.orientation),
    margins: z.enum(keys(MARGINS)).describe(FIELD_HELP.margins),
    background: z.enum(keys(BACKGROUNDS)).describe(FIELD_HELP.background),
    pageBreaks: z.enum(keys(PAGE_BREAK_MODES)).describe(FIELD_HELP.pageBreaks),
    toc: z.boolean().describe(FIELD_HELP.toc),
    headingNumbers: z.boolean().describe(FIELD_HELP.headingNumbers),
    justify: z.boolean().describe(FIELD_HELP.justify),
    header: z
      .object({
        text: z.string().max(200).describe(FIELD_HELP.headerText),
        showDate: z.boolean().describe(FIELD_HELP.headerShowDate),
      })
      .partial()
      .describe('Running header. Partial object is fine; omitted fields keep defaults.'),
    footer: z
      .object({
        text: z.string().max(200).describe(FIELD_HELP.footerText),
        pageNumbers: z.boolean().describe(FIELD_HELP.footerPageNumbers),
        pageNumberStyle: z.enum(['n-of-total', 'n']).describe(FIELD_HELP.footerPageNumberStyle),
      })
      .partial()
      .describe('Running footer. Partial object is fine; omitted fields keep defaults.'),
    cover: z
      .object({
        enabled: z.boolean().describe(FIELD_HELP.coverEnabled),
        title: z.string().max(300).describe(FIELD_HELP.coverTitle),
        subtitle: z.string().max(500).describe(FIELD_HELP.coverSubtitle),
        author: z.string().max(200).describe(FIELD_HELP.coverAuthor),
        date: z.string().max(100).describe(FIELD_HELP.coverDate),
        showLogo: z.boolean().describe(FIELD_HELP.coverShowLogo),
      })
      .partial()
      .describe('Cover page. Set enabled true to insert it; other fields are optional.'),
    logo: z
      .object({
        dataUrl: z.string().startsWith('data:image/').describe(FIELD_HELP.logoDataUrl),
        name: z.string().max(200).optional().describe(FIELD_HELP.logoName),
        position: z.enum(keys(LOGO_POSITIONS)).describe(FIELD_HELP.logoPosition),
        size: z.enum(keys(LOGO_SIZES)).describe(FIELD_HELP.logoSize),
        aspect: z.number().positive().optional().describe(FIELD_HELP.logoAspect),
      })
      .partial({ name: true, position: true, size: true, aspect: true })
      .nullable()
      .describe('Logo image and placement, or null to omit. dataUrl is required when the object is present.'),
  })
  .partial()
  .describe(FIELD_HELP.settings);

const AssetsSchema = z
  .record(z.string().max(200), z.string().startsWith('data:image/'))
  .describe(FIELD_HELP.assets);

const MarkdownSchema = z.string().min(1).max(2 * 1024 * 1024).describe(FIELD_HELP.markdown);

const FileNameSchema = z.string().max(120).optional().describe(FIELD_HELP.fileName);

const UrlSchema = z.string().min(1).max(2048).describe(FIELD_HELP.url);

// ---- Helpers -----------------------------------------------------------------------------------

const json = (value) => JSON.stringify(value, null, 2);

const text = (t) => ({ type: 'text', text: t });

function toolError(message) {
  return { isError: true, content: [text(message)] };
}

function publicOrigin(ctx) {
  try {
    const req = ctx?.http?.req;
    if (req) {
      const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
      const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host');
      if (host) return `${proto || new URL(req.url).protocol.replace(':', '')}://${host}`;
      return new URL(req.url).origin;
    }
  } catch {
    /* fall through */
  }
  return SITE_URL;
}

function designOptions() {
  const map = (obj, pick) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, pick(v)]));
  return {
    defaults: DEFAULT_SETTINGS,
    themes: map(THEMES, (t) => ({ name: t.name, description: t.description, accent: t.accent, dark: t.dark, defaultFont: t.defaultFont, defaultHeadingFont: t.defaultHeadingFont === 'same' ? t.defaultFont : t.defaultHeadingFont })),
    fonts: map(FONTS, (f) => ({ name: f.name, kind: f.kind })),
    fontSizes: map(FONT_SIZES, (f) => ({ name: f.name, bodyPt: f.body })),
    paperSizes: map(PAPER_SIZES, (p) => ({ name: p.name, widthPx: p.width, heightPx: p.height })),
    margins: map(MARGINS, (m) => ({ name: m.name, horizontalPx: m.x, verticalPx: m.y })),
    backgrounds: map(BACKGROUNDS, (b) => b.name),
    pageBreaks: map(PAGE_BREAK_MODES, (p) => p.name),
    logoPositions: map(LOGO_POSITIONS, (l) => l.name),
    runningHeader: { logoPosition: 'page-header', logoHeightPx: 14, logoMaxWidthPx: 160, logoTextGapPx: 8, alignment: 'vertically centered', condition: 'Set logo.dataUrl and logo.position="page-header" for a header logo; add header.text for accompanying text. Either may be used alone; the gap is added only when both are present. Set logo.aspect to image width / height.' },
    logoSizes: map(LOGO_SIZES, (l) => ({ name: l.name, heightPx: l.px })),
    placeholders: { '{title}': 'Replaced with the document title in header.text / footer.text' },
    pageBreakDirective: '\\pagebreak on its own line, or {: .newpage } on a heading',
    imageSizeHint: '![alt](url =WIDTHxHEIGHT) — either dimension may be omitted, e.g. =300x',
  };
}

function templateSummary(t) {
  return { id: t.id, name: t.name, description: t.description, settings: t.settings || {} };
}

/**
 * Register every tool, resource and prompt on an McpServer instance.
 * @param {import('@modelcontextprotocol/server').McpServer} server
 */
export function registerMarkdownStudio(server) {
  // ---- Tools ---------------------------------------------------------------------------------

  server.registerTool(
    'get_markdown_guide',
    {
      title: 'Markdown authoring guide',
      description:
        'Returns the authoring guide: supported Markdown syntax, structure rules, recipes, anti-patterns, and the complete catalog of every MCP tool/prompt argument and settings field (with allowed values and defaults). Call once per session. Use that catalog when a user asks what they can choose for a nice PDF.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => ({ content: [text(MARKDOWN_GUIDE)] }),
  );

  server.registerTool(
    'list_design_options',
    {
      title: 'List design options',
      description:
        'JSON catalog of every valid `settings` value: defaults, themes (colours, dark/light, default fonts), fonts, font sizes, paper sizes, margins, backgrounds, page-break modes, logo positions/sizes, `{title}` placeholder, page-break directive and image size hint. Present these options to the user and wait before calling render_pdf.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const options = designOptions();
      return { content: [text(json(options))], structuredContent: options };
    },
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List templates',
      description: 'Starter documents (business report, proposal, README, meeting notes, invoice, résumé, feature tour). Each has a proven heading structure and recommended design settings. Use get_template to fetch the Markdown.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const templates = TEMPLATES.map(templateSummary);
      return { content: [text(json(templates))], structuredContent: { templates } };
    },
  );

  server.registerTool(
    'get_template',
    {
      title: 'Get template',
      description: 'Fetch a template by id: its Markdown source and the design settings it was designed for. Use the structure as a skeleton and pass the settings to render_pdf.',
      inputSchema: z.object({
        id: z.enum(TEMPLATE_IDS).describe(FIELD_HELP.templateId),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const t = getTemplate(id);
      if (!t) return toolError(`Unknown template "${id}".`);
      const result = { ...templateSummary(t), markdown: t.markdown };
      return {
        content: [text(`Template "${t.name}" — recommended settings:\n${json(result.settings)}\n\n---\n\n${t.markdown}`)],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'analyze_markdown',
    {
      title: 'Analyze Markdown',
      description:
        'Lint a Markdown document for this renderer before rendering. Returns the inferred title, an outline, content statistics and a list of warnings with line numbers (skipped heading levels, code fences without a language, YAML front-matter, LaTeX, raw HTML, ragged tables, missing assets, undefined footnotes, hand-written TOC/numbering…). Fix all "warning"-severity items; "info" items are suggestions.',
      inputSchema: z.object({
        markdown: MarkdownSchema,
        settings: SettingsSchema.optional(),
        assets: AssetsSchema.optional().describe('Pass the same assets you will render with so asset: references can be checked.'),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ markdown, settings, assets }) => {
      try {
        assertMarkdownSize(markdown);
        const report = analyzeMarkdown(markdown, { assets: sanitizeAssets(assets), toc: !!settings?.toc });
        const summary = report.warnings.length
          ? `${report.warnings.filter((w) => w.severity === 'warning').length} warning(s), ${report.warnings.filter((w) => w.severity === 'info').length} suggestion(s).`
          : 'No issues found.';
        return { content: [text(`${summary}\n\n${json(report)}`)], structuredContent: report };
      } catch (err) {
        return toolError(err.message);
      }
    },
  );

  const renderInput = z.object({
    markdown: MarkdownSchema,
    settings: SettingsSchema.optional(),
    assets: AssetsSchema.optional(),
    fileName: FileNameSchema,
  });

  server.registerTool(
    'render_html',
    {
      title: 'Render HTML',
      description:
        'Render Markdown + settings to a complete standalone HTML document (same CSS, fonts and layout as the PDF, without page breaks). Same arguments as render_pdf: markdown, settings, assets, fileName. Fast — no headless browser. Useful to inspect the output or to hand to a browser/printer yourself. Returns the HTML as an embedded text/html resource.',
      inputSchema: renderInput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ markdown, settings, assets, fileName }, ctx) => {
      try {
        assertMarkdownSize(markdown);
        const cleanAssets = sanitizeAssets(assets);
        const normalized = normalizeSettings(settings);
        const title = fileName || inferTitle(markdown, 'document');
        const html = buildDocumentHtml({ markdown, settings: normalized, assets: cleanAssets, mode: 'pdf', title: fileName });
        const name = safeFileName(title, 'html');
        return {
          content: [
            text(`Rendered ${name} (${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB) with theme "${normalized.theme}". The full HTML follows as an embedded resource. For a PDF call render_pdf, or POST the same body to ${publicOrigin(ctx)}/api/convert with "format": "html" or omit it for a PDF.`),
            { type: 'resource', resource: { uri: `markdown-studio://render/${encodeURIComponent(name)}`, mimeType: 'text/html', text: html } },
          ],
        };
      } catch (err) {
        return toolError(err.message);
      }
    },
  );

  server.registerTool(
    'render_pdf',
    {
      title: 'Render PDF',
      description:
        'Render Markdown + settings to a PDF with headless Chromium (takes 3–15 s). Do not call this until you have listed style options (theme, paper, fonts, TOC, cover, header/footer) and the user has answered — every time, including re-renders. Default: no running header; do not put the document title or {title} on every page. Arguments: markdown (required), settings (optional design object — every field is documented on the schema and in get_markdown_guide), assets (optional image data URLs), fileName (optional, no extension). Returns a 24-hour https download URL in the text block (and an MCP resource_link) — not a base64 application/pdf attachment — plus a LAYOUT REPORT: every page, y% position of each block, appearance (heading/table/callout/…, colours, sizes), page-break reasons and layout warnings. Read that report to judge pagination; do not screenshot the PDF. Give the user the URL as a markdown link. In Cursor, open it in a canvas iframe whose src is the URL. Run analyze_markdown first and fix its warnings.',
      inputSchema: renderInput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ markdown, settings, assets, fileName }, ctx) => {
      let cleanAssets;
      try {
        assertMarkdownSize(markdown);
        cleanAssets = sanitizeAssets(assets);
      } catch (err) {
        return toolError(err.message);
      }
      const normalized = normalizeSettings(settings);
      const requested = fileName ? String(fileName).slice(0, 120) : '';
      const started = Date.now();
      try {
        const { pdf, title, layout } = await renderPdf({ markdown, settings: normalized, assets: cleanAssets, title: requested, includeLayout: true });
        const name = safeFileName(requested || title, 'pdf');
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const kb = (pdf.length / 1024).toFixed(0);
        let download;
        try {
          download = await persistDownload({ body: pdf, fileName: name, origin: publicOrigin(ctx) });
        } catch (err) {
          console.error('[mcp] persist download failed:', err);
          return toolError(`PDF rendered but could not be stored for download: ${err.message}`);
        }
        const extras = [normalized.toc ? 'TOC' : '', normalized.cover.enabled ? 'cover page' : ''].filter(Boolean);
        const extra = extras.length ? `, ${extras.join(', ')}` : '';
        const pages = layout?.pageCount ? `${layout.pageCount} page${layout.pageCount === 1 ? '' : 's'}` : '';
        const summary = [
          `Rendered "${name}" — ${kb} KB in ${seconds}s (${pages ? `${pages}, ` : ''}theme "${normalized.theme}", ${normalized.paperSize} ${normalized.orientation}${extra}).`,
          `Download (expires in 24h): ${download.url}`,
          '',
          `Give the user that URL as a markdown link named "${name}". Do not wait for an attached application/pdf blob — many clients drop those, and this tool does not send one. There is nothing to decode with base64. If this client can show PDFs inline, open the URL there (Cursor: a canvas with <iframe src="${download.url}">). If it cannot, the link is the deliverable.`,
          '',
          'Read the LAYOUT REPORT below to judge page breaks, placement and styling. Do not screenshot the PDF or render it in a browser unless a logo, diagram or colour is still unclear. If a heading is stranded or a page is too empty, insert \\pagebreak / {: .newpage } before the section heading (or change settings) and call render_pdf again.',
          '',
          layout?.text || 'Layout report unavailable.',
        ].join('\n');
        return {
          content: [
            text(summary),
            {
              type: 'resource_link',
              uri: download.url,
              name,
              title: name,
              mimeType: 'application/pdf',
              description: `Rendered PDF, ${kb} KB. Expires ${new Date(download.expiresAt).toISOString()}.`,
              size: pdf.length,
            },
          ],
          structuredContent: {
            fileName: name,
            bytes: pdf.length,
            renderMs: Date.now() - started,
            title,
            settings: normalized,
            downloadUrl: download.url,
            expiresAt: new Date(download.expiresAt).toISOString(),
            pageCount: layout?.pageCount || 0,
            layoutIssues: layout?.issues || [],
            pages: layout?.pages || [],
          },
        };
      } catch (error) {
        console.error('[mcp] render_pdf failed:', error);
        const hint = /Could not find|executablePath|Failed to launch|spawn/i.test(error.message)
          ? 'The PDF engine (Chromium) could not be started on the server.'
          : /timeout/i.test(error.message)
            ? 'Rendering timed out — very large documents or slow remote images can cause this. Remove heavy images or split the document.'
            : `PDF rendering failed: ${error.message}`;
        return toolError(hint);
      }
    },
  );

  server.registerTool(
    'import_web_page',
    {
      title: 'Import web page as Markdown',
      description:
        'Render a public web page in headless Chromium (5–25 s) — waiting for its JavaScript, scrolling so lazy-loaded sections appear — then strip navigation, ads, banners and sidebars using the rendered layout, keep the visible content in reading order and convert it to GitHub-flavoured Markdown: headings, nested/task lists, tables (inline code preserved), fenced code with language, callouts as "> [!NOTE]" alerts, figures with captions, definition lists, math as $…$, absolute links and images (or return the cleaned HTML). Also returns page metadata (title, description, site, author, date, language) and, for Markdown, the same analysis as analyze_markdown (outline, stats, warnings). Use it whenever the user gives you a URL to turn into a document or PDF, then fix the warnings and call render_pdf. Only http(s) URLs to public hosts are allowed; pages behind a login or bot protection cannot be read.',
      inputSchema: z.object({
        url: UrlSchema,
        format: z.enum(['markdown', 'html']).optional().describe(FIELD_HELP.importFormat),
        stripImages: z.boolean().optional().describe(FIELD_HELP.stripImages),
        stripLinks: z.boolean().optional().describe(FIELD_HELP.stripLinks),
      }),
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ url, format = 'markdown', stripImages = false, stripLinks = false }) => {
      let target = String(url).trim();
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) target = `https://${target}`;
      try {
        target = sanitizeUrl(target);
      } catch (err) {
        return toolError(`Invalid URL: ${err.message}`);
      }
      if (!validateUrl(target)) return toolError('Only public http(s) URLs can be imported (no localhost or private network addresses).');

      const started = Date.now();
      try {
        const { content, ...meta } = await scrapePage(target, format === 'html' ? 'html' : 'md', { stripImages, stripLinks });
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const host = new URL(target).hostname.replace(/^www\./, '');
        const baseName = safeFileName(meta.title || host, format === 'html' ? 'html' : 'md');
        const resource = {
          type: 'resource',
          resource: { uri: `markdown-studio://import/${encodeURIComponent(baseName)}`, mimeType: format === 'html' ? 'text/html' : 'text/markdown', text: content },
        };

        if (format === 'html') {
          return {
            content: [text(`Imported "${meta.title || target}" from ${host} as HTML (${(Buffer.byteLength(content, 'utf8') / 1024).toFixed(1)} KB in ${seconds}s). The cleaned HTML follows as an embedded resource.`), resource],
            structuredContent: { url: target, format: 'html', ...meta, bytes: Buffer.byteLength(content, 'utf8'), durationMs: Date.now() - started },
          };
        }

        const report = analyzeMarkdown(content);
        const warnings = report.warnings.filter((w) => w.severity === 'warning').length;
        const infos = report.warnings.length - warnings;
        const summary = [
          `Imported "${meta.title || target}" from ${host} in ${seconds}s — ${report.stats.words.toLocaleString()} words, ${report.outline.length} headings, ${report.stats.images} images, ${report.stats.tables} tables, ${report.stats.codeBlocks} code blocks.`,
          meta.description ? `Description: ${meta.description}` : '',
          meta.author || meta.published ? `Byline: ${[meta.author, meta.published].filter(Boolean).join(' · ')}` : '',
          report.warnings.length ? `analyze_markdown found ${warnings} warning(s) and ${infos} suggestion(s) — fix the warnings before rendering:` : 'analyze_markdown found no issues.',
          ...report.warnings.slice(0, 12).map((w) => `- [${w.severity}] ${w.line ? `line ${w.line}: ` : ''}${w.message}`),
          report.warnings.length > 12 ? `- … ${report.warnings.length - 12} more (call analyze_markdown for the full list)` : '',
          '',
          `Suggested fileName: "${baseName.replace(/\.md$/, '')}". The Markdown follows as an embedded resource; keep the source URL as a footnote or a closing "Source" line when you render it.`,
        ]
          .filter(Boolean)
          .join('\n');

        return {
          content: [text(summary), resource],
          structuredContent: { url: target, format: 'markdown', ...meta, fileName: baseName.replace(/\.md$/, ''), stats: report.stats, outline: report.outline, warnings: report.warnings, durationMs: Date.now() - started },
        };
      } catch (err) {
        console.error('[mcp] import_web_page failed:', err.message);
        return toolError(describeScrapeError(err).message);
      }
    },
  );

  // ---- Resources -----------------------------------------------------------------------------

  server.registerResource(
    'guide',
    'markdown-studio://guide',
    { title: 'Markdown Studio authoring guide', description: 'How to write Markdown that renders well in Markdown Studio.', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: MARKDOWN_GUIDE }] }),
  );

  server.registerResource(
    'design-options',
    'markdown-studio://design-options',
    { title: 'Design options', description: 'Every valid settings field, enum, default, logo placement, placeholders and limits — same data as list_design_options.', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: json(designOptions()) }] }),
  );

  server.registerResource(
    'template',
    new ResourceTemplate('markdown-studio://templates/{id}', {
      list: async () => ({
        resources: TEMPLATES.map((t) => ({ uri: `markdown-studio://templates/${t.id}`, name: t.id, title: t.name, description: t.description, mimeType: 'text/markdown' })),
      }),
      complete: { id: async (value) => TEMPLATES.map((t) => t.id).filter((id) => id.startsWith(value || '')) },
    }),
    { title: 'Document template', description: 'Starter Markdown for a document type. Recommended settings are in the first HTML comment.', mimeType: 'text/markdown' },
    async (uri, { id }) => {
      const t = getTemplate(String(id));
      if (!t) throw new Error(`Unknown template "${id}"`);
      const body = `<!-- markdown-studio settings: ${JSON.stringify(t.settings || {})} -->\n\n${t.markdown}`;
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: body }] };
    },
  );

  // ---- Prompts -------------------------------------------------------------------------------

  server.registerPrompt(
    'write_document',
    {
      title: 'Write a document',
      description: 'Draft a well-structured document for Markdown Studio from a brief, choosing an appropriate template and design settings.',
      argsSchema: z.object({
        brief: z.string().describe('What the document is about, who it is for, and any facts to include.'),
        kind: z.enum(['report', 'proposal', 'readme', 'meeting', 'invoice', 'resume', 'other']).optional().describe('Document type; defaults to whatever fits the brief.'),
      }),
    },
    ({ brief, kind }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Write a ${kind && kind !== 'other' ? `${kind} ` : ''}document in Markdown for Markdown Studio.`,
              '',
              'Brief:',
              brief,
              '',
              'Rules:',
              '- Follow the Markdown Studio authoring guide exactly (call get_markdown_guide if you have not read it in this session).',
              kind && kind !== 'other' ? `- Start from the "${kind}" template (get_template) for structure. Do not copy a running header that repeats the title.` : '- Pick the closest template from list_templates for structure.',
              '- One `#` title, `##` sections, tables for structured data, callouts for key points, titled code blocks for code.',
              '- Do not put `---` above headings; H2s already have a rule and a divider looks like a double line.',
              '- Do not write a manual table of contents or number headings by hand; use settings.toc / settings.headingNumbers.',
              '- Before render_pdf: list style options (theme, paper, fonts, TOC, cover, header/footer), recommend a starting set with an empty running header, and wait for the user. Never put the H1/{title} in header.text.',
              '- Run analyze_markdown and fix every warning before rendering.',
              '- Finish by calling render_pdf with the chosen settings. Read the LAYOUT REPORT (do not screenshot the PDF). Then give the user the download URL from the result (markdown link; Cursor: canvas iframe src = that URL) and report the file name.',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'polish_markdown',
    {
      title: 'Polish existing Markdown',
      description: 'Rewrite an existing Markdown document so it renders cleanly in Markdown Studio, without changing its meaning.',
      argsSchema: z.object({ markdown: z.string().describe('The Markdown to improve.') }),
    },
    ({ markdown }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Improve the formatting of the Markdown below for Markdown Studio without changing its content or meaning.',
              '',
              'Steps:',
              '1. Call analyze_markdown on it and read the warnings.',
              '2. Apply the authoring guide (get_markdown_guide): a single H1, no skipped heading levels, no `---` above headings, languages on code fences, GitHub callouts instead of bold "Note:" lines, real tables instead of aligned text, footnotes for sources, no LaTeX/HTML/front-matter.',
              '3. Re-run analyze_markdown until there are no warnings.',
              '4. Suggest a full settings object (theme, paper, fonts, TOC, cover, header/footer) using the argument catalog — empty running header unless they asked for a brand line — list the options, wait, then return the polished Markdown.',
              '',
              '```md',
              markdown,
              '```',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'pdf_from_url',
    {
      title: 'PDF from a web page',
      description: 'Import a web page with import_web_page, clean up the Markdown, agree design settings, and render it as a PDF.',
      argsSchema: z.object({
        url: z.string().describe('The public web page to import (article, docs page, blog post…).'),
        audience: z.string().optional().describe('Who will read the PDF — used to recommend theme, density and paper.'),
        notes: z.string().optional().describe('Anything to keep, drop or change (e.g. "drop the comments section", "add a summary at the top").'),
      }),
    },
    ({ url, audience, notes }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Turn this web page into a polished PDF with Markdown Studio: ${url}`,
              audience ? `Audience: ${audience}` : '',
              notes ? `Notes: ${notes}` : '',
              '',
              'Steps:',
              '1. Call import_web_page with the URL (format "markdown"). Read the returned metadata, outline and warnings.',
              '2. Clean the Markdown without changing its meaning: keep a single H1 (the page title), remove leftover navigation/"share"/"related" fragments, delete `---` above headings, fix skipped heading levels, add languages to code fences, turn "Note:"-style paragraphs into callouts, and drop broken or tracking links. Keep images that carry information; drop decorative ones.',
              '3. Add a closing line or footnote with the source URL and the import date.',
              '4. Run analyze_markdown until there are no warnings.',
              '5. List design options (theme, paper, TOC, header/footer, page numbers) and wait — pick "clean" + toc for docs, "editorial" for long-form articles. Default: no running header (do not put the article title or site name on every page). Apply what they confirm.',
              '6. Call render_pdf with markdown + settings + fileName (use the suggested fileName). Read the LAYOUT REPORT instead of screenshotting. Then give the user the download URL from the result (markdown link; Cursor: canvas iframe src = that URL) and report the result.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'make_pdf',
    {
      title: 'Make a nice PDF',
      description:
        'Walk the user through every Markdown Studio render argument, agree a settings object, then write or take Markdown and render a PDF.',
      argsSchema: z.object({
        brief: z.string().optional().describe('What the PDF should contain if markdown is not provided.'),
        markdown: z.string().optional().describe('Existing Markdown to render. If omitted, draft from the brief.'),
        audience: z.string().optional().describe('Who will read the PDF — used to recommend theme, density and paper.'),
      }),
    },
    ({ brief, markdown, audience }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Make a polished PDF with Markdown Studio.',
              audience ? `Audience: ${audience}` : '',
              brief ? `Brief:\n${brief}` : '',
              markdown ? `Existing Markdown:\n\`\`\`md\n${markdown}\n\`\`\`` : '',
              '',
              'You must list the available arguments to the user (from get_markdown_guide / list_design_options / server instructions) and wait for their answer before render_pdf, every time:',
              '- Look: theme, accentColor, font, headingFont, fontSize, background',
              '- Page: paperSize, orientation, margins',
              '- Structure: toc, headingNumbers, cover (enabled, title, subtitle, author, date, showLogo), pageBreaks',
              '- Chrome: header.text (default empty — do not repeat the title), header.showDate, footer.text, footer.pageNumbers, footer.pageNumberStyle, logo',
              '- Output: fileName; optional assets for local images',
              'Recommend a recipe for this document type with an empty running header (do not repeat the H1 on every page). Wait for them to pick or say you may decide, then apply that.',
              'Follow the authoring guide (no `---` above headings). Run analyze_markdown and fix warnings. Call render_pdf with markdown + settings + assets + fileName. Read the LAYOUT REPORT (do not screenshot the PDF). Then give the user the download URL from the result (markdown link; Cursor: canvas iframe src = that URL). Tell them the file name and which settings you used.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
      ],
    }),
  );
}
