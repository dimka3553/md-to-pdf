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
} from '../document/settings.js';
import { buildDocumentHtml } from '../document/html.js';
import { inferTitle } from '../document/utils.js';
import { safeFileName } from '../document/limits.js';
import { TEMPLATES, getTemplate } from '../templates.js';
import { renderPdf } from '../pdf/generate.js';
import { describeScrapeError, sanitizeUrl, scrapePage, validateUrl } from '../scraper/scraper.js';
import { analyzeMarkdown } from './analyze.js';
import { ARGUMENT_CATALOG, ASK_STYLES_MODE, FIELD_HELP, TEMPLATE_IDS } from './arguments.js';
import { GUIDE_VERSION, MARKDOWN_GUIDE } from './guide.js';
import { persistDownload } from '../downloads.js';
import { persistDocument } from '../documents.js';
import { documentIdNote, resolveDocumentSource } from './input.js';
import { SITE_URL } from '../site.js';

export const SERVER_INFO = { name: 'markdown-studio', version: GUIDE_VERSION };

const STYLE_LEAD = ASK_STYLES_MODE === 'never'
  ? 'Apply a recipe from the guide and render. Default chrome is minimal: no running header — never repeat the document title at the top of every page; the H1 already prints once.'
  : ASK_STYLES_MODE === 'always'
    ? 'When a user asks you to make a nice PDF, list the design options (theme, paper, fonts, TOC, cover, header/footer, logo, file name) in plain language, recommend a starting set, and wait for their answer before calling render_pdf. Default chrome is minimal: no running header — never repeat the document title at the top of every page; the H1 already prints once.'
    : 'When a person is choosing a look, list the design options (theme, paper, fonts, TOC, cover, header/footer, logo, file name) in plain language, recommend a starting set, and wait. Skip the wait on agentic or unattended runs — they already asked you to render, said you may decide, or supplied settings. Default chrome is minimal: no running header — never repeat the document title at the top of every page; the H1 already prints once.';

export const SERVER_INSTRUCTIONS = `Markdown Studio turns Markdown into polished, print-ready PDFs (themes, cover page, table of contents, running header/footer, callouts, Mermaid diagrams, syntax-highlighted code).

${STYLE_LEAD} Call list_design_options if you need the live enum JSON.

Recommended flow (three tools on the happy path):
1. Call get_markdown_guide once per session — syntax, anti-patterns, recipes and the full settings table.
2. Optionally call list_templates (pass id to fetch Markdown) for a proven structure.
3. Write the Markdown, then call analyze_markdown and fix every warning. Keep the returned documentId. Default to automatic pagination; for deliberate section boundaries put \\pagebreak on its own paragraph BEFORE the heading (or \`{: .newpage }\` on the heading). Do not put \`---\` above headings — H2s already have a rule.
4. Call render_pdf with documentId + settings (or markdown the first time). Returns a 24-hour download URL and a LAYOUT REPORT. Re-render with the same documentId and a settings patch — do not resend the Markdown. render_html returns a URL the same way (pass inline: true only if you need the HTML in context).
5. Immediately give the user that download URL (markdown link). In Cursor, also open it in a canvas whose iframe src is the URL.

When the source is a web page, call import_web_page first; polish the Markdown, then pass its documentId to render_pdf — do not re-type page content from memory.

${ARGUMENT_CATALOG}`;

const keys = (o) => Object.keys(o);

// ---- Schemas -----------------------------------------------------------------------------------

const HexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Use #rgb or #rrggbb');

const HeaderLogoSchema = z
  .object({
    dataUrl: z.string().startsWith('data:image/').describe(FIELD_HELP.logoDataUrl),
    name: z.string().max(200).optional().describe(FIELD_HELP.logoName),
    aspect: z.number().positive().optional().describe(FIELD_HELP.logoAspect),
  })
  .partial({ name: true, aspect: true })
  .nullable()
  .describe(FIELD_HELP.headerLogo);

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
        logo: HeaderLogoSchema,
      })
      .partial()
      .describe('Running header. Partial object is fine; omitted fields keep defaults. header.logo is independent of logo.position.'),
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

const DocumentIdSchema = z.string().regex(/^[a-f0-9]{32}$/).describe(FIELD_HELP.documentId);

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

function templateSummary(t) {
  return { id: t.id, name: t.name, description: t.description, settings: t.settings || {} };
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
    runningHeader: { headerLogo: true, logoHeightPx: 14, logoMaxWidthPx: 160, logoTextGapPx: 8, alignment: 'vertically centered', condition: 'Set header.logo (dataUrl + aspect) for a header logo independently of logo.position, so a cover/title logo can coexist. logo.position="page-header" remains a legacy shortcut. Add header.text for accompanying text. Either may be used alone; the gap is added only when both are present.' },
    logoSizes: map(LOGO_SIZES, (l) => ({ name: l.name, heightPx: l.px })),
    placeholders: { '{title}': 'Replaced with the document title in header.text / footer.text' },
    pageBreakDirective: '\\pagebreak on its own line, or {: .newpage } on a heading',
    imageSizeHint: '![alt](url =WIDTHxHEIGHT) — either dimension may be omitted, e.g. =300x',
    templates: TEMPLATES.map(templateSummary),
    askStyles: ASK_STYLES_MODE,
  };
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
        'JSON catalog of every valid `settings` value: defaults, themes, fonts, paper, margins, backgrounds, page-break modes, logo positions/sizes, template summaries, `{title}` placeholder, page-break directive and image size hint.',
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
      description: 'Starter documents (business report, proposal, README, meeting notes, invoice, résumé, feature tour). Omit id to list them; pass id to fetch that template\'s Markdown and recommended settings (same as get_template).',
      inputSchema: z.object({
        id: z.enum(TEMPLATE_IDS).optional().describe(FIELD_HELP.templateId),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id } = {}) => {
      if (id) {
        const t = getTemplate(id);
        if (!t) return toolError(`Unknown template "${id}".`);
        const result = { ...templateSummary(t), markdown: t.markdown };
        return {
          content: [text(`Template "${t.name}" — recommended settings:\n${json(result.settings)}\n\n---\n\n${t.markdown}`)],
          structuredContent: result,
        };
      }
      const templates = TEMPLATES.map(templateSummary);
      return { content: [text(json(templates))], structuredContent: { templates } };
    },
  );

  server.registerTool(
    'get_template',
    {
      title: 'Get template',
      description: 'Alias of list_templates with id. Prefer list_templates — same result, one fewer tool to approve.',
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
        'Lint a Markdown document for this renderer before rendering. Pass markdown (first time) or documentId (reuse). Returns a documentId, the inferred title, an outline, content statistics and a list of warnings with line numbers. Fix all "warning"-severity items; "info" items are suggestions. Reuse documentId on render_pdf / render_html with a settings patch so you do not resend the document.',
      inputSchema: z.object({
        markdown: MarkdownSchema.optional(),
        documentId: DocumentIdSchema.optional(),
        settings: SettingsSchema.optional(),
        assets: AssetsSchema.optional().describe('Pass the same assets you will render with so asset: references can be checked. Omitted when documentId is set.'),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ markdown, documentId, settings, assets }) => {
      try {
        const doc = await resolveDocumentSource({ markdown, documentId, settings, assets });
        const report = analyzeMarkdown(doc.markdown, { assets: doc.assets, toc: !!doc.settings.toc });
        const summary = report.warnings.length
          ? `${report.warnings.filter((w) => w.severity === 'warning').length} warning(s), ${report.warnings.filter((w) => w.severity === 'info').length} suggestion(s).`
          : 'No issues found.';
        const idLine = documentIdNote(doc);
        return {
          content: [text([summary, idLine, '', json({ ...report, documentId: doc.documentId })].filter(Boolean).join('\n'))],
          structuredContent: { ...report, documentId: doc.documentId, expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null },
        };
      } catch (err) {
        return toolError(err.message);
      }
    },
  );

  const renderInput = z.object({
    markdown: MarkdownSchema.optional(),
    documentId: DocumentIdSchema.optional(),
    settings: SettingsSchema.optional(),
    assets: AssetsSchema.optional(),
    fileName: FileNameSchema,
  });

  server.registerTool(
    'render_html',
    {
      title: 'Render HTML',
      description:
        'Render Markdown + settings to a complete standalone HTML document (same CSS, fonts and layout as the PDF, without page breaks). Arguments: markdown or documentId, settings, assets, fileName, inline. Fast — no headless browser. Returns a 24-hour https download URL by default (like render_pdf). Pass inline: true only if you need the HTML embedded in the tool result (often 30 KB+ of CSS/JS).',
      inputSchema: renderInput.extend({
        inline: z.boolean().optional().describe(FIELD_HELP.inlineHtml),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ markdown, documentId, settings, assets, fileName, inline = false }, ctx) => {
      let doc;
      try {
        doc = await resolveDocumentSource({ markdown, documentId, settings, assets, fileName });
      } catch (err) {
        return toolError(err.message);
      }
      try {
        const title = doc.fileName || inferTitle(doc.markdown, 'document');
        const html = buildDocumentHtml({ markdown: doc.markdown, settings: doc.settings, assets: doc.assets, mode: 'pdf', title: doc.fileName });
        const name = safeFileName(title, 'html');
        let download;
        try {
          download = await persistDownload({
            body: Buffer.from(html, 'utf8'),
            fileName: name,
            origin: publicOrigin(ctx),
            mimeType: 'text/html',
          });
        } catch (err) {
          console.error('[mcp] persist html failed:', err);
          return toolError(`HTML rendered but could not be stored for download: ${err.message}`);
        }
        const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
        const summary = [
          `Rendered "${name}" — ${kb} KB (theme "${doc.settings.theme}").`,
          `Download (expires in 24h): ${download.url}`,
          documentIdNote(doc),
          inline ? 'The full HTML follows as an embedded resource because inline=true.' : 'Pass inline: true only if you need the HTML in context; the URL is enough to inspect styling.',
        ].filter(Boolean).join('\n');
        const content = [
          text(summary),
          {
            type: 'resource_link',
            uri: download.url,
            name,
            title: name,
            mimeType: 'text/html',
            description: `Rendered HTML, ${kb} KB. Expires ${new Date(download.expiresAt).toISOString()}.`,
            size: Buffer.byteLength(html, 'utf8'),
          },
        ];
        if (inline) {
          content.push({ type: 'resource', resource: { uri: `markdown-studio://render/${encodeURIComponent(name)}`, mimeType: 'text/html', text: html } });
        }
        return {
          content,
          structuredContent: {
            fileName: name,
            bytes: Buffer.byteLength(html, 'utf8'),
            title,
            settings: doc.settings,
            downloadUrl: download.url,
            expiresAt: new Date(download.expiresAt).toISOString(),
            documentId: doc.documentId,
            inline,
          },
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
        'Render Markdown + settings to a PDF with headless Chromium (takes 3–15 s). Arguments: markdown or documentId, settings (optional design object — merged over stored settings when documentId is set), assets, fileName. Default: no running header; do not put the document title or {title} on every page. Returns a 24-hour https download URL in the text block (and an MCP resource_link) — not a base64 application/pdf attachment — plus a LAYOUT REPORT. Read that report to judge pagination; do not screenshot the PDF. Give the user the URL as a markdown link. Reuse documentId with a settings patch instead of resending the Markdown.',
      inputSchema: renderInput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ markdown, documentId, settings, assets, fileName }, ctx) => {
      let doc;
      try {
        doc = await resolveDocumentSource({ markdown, documentId, settings, assets, fileName });
      } catch (err) {
        return toolError(err.message);
      }
      const requested = doc.fileName || '';
      const started = Date.now();
      try {
        const { pdf, title, layout } = await renderPdf({ markdown: doc.markdown, settings: doc.settings, assets: doc.assets, title: requested, includeLayout: true });
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
        const extras = [doc.settings.toc ? 'TOC' : '', doc.settings.cover.enabled ? 'cover page' : ''].filter(Boolean);
        const extra = extras.length ? `, ${extras.join(', ')}` : '';
        const pages = layout?.pageCount ? `${layout.pageCount} page${layout.pageCount === 1 ? '' : 's'}` : '';
        const summary = [
          `Rendered "${name}" — ${kb} KB in ${seconds}s (${pages ? `${pages}, ` : ''}theme "${doc.settings.theme}", ${doc.settings.paperSize} ${doc.settings.orientation}${extra}).`,
          `Download (expires in 24h): ${download.url}`,
          documentIdNote(doc),
          '',
          `Give the user that URL as a markdown link named "${name}". Do not wait for an attached application/pdf blob — many clients drop those, and this tool does not send one. There is nothing to decode with base64. If this client can show PDFs inline, open the URL there (Cursor: a canvas with <iframe src="${download.url}">). If it cannot, the link is the deliverable.`,
          '',
          'Read the LAYOUT REPORT below to judge page breaks, placement and styling. Do not screenshot the PDF or render it in a browser unless a logo, diagram or colour is still unclear. If a heading is stranded or a page is too empty, insert \\pagebreak / {: .newpage } before the section heading (or change settings) and call render_pdf again with the same documentId.',
          '',
          layout?.text || 'Layout report unavailable.',
        ].filter((line) => line !== undefined).join('\n');
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
            settings: doc.settings,
            downloadUrl: download.url,
            expiresAt: new Date(download.expiresAt).toISOString(),
            documentId: doc.documentId,
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
        const saved = await persistDocument({
          markdown: content,
          fileName: baseName.replace(/\.md$/, ''),
        }).catch(() => null);
        const summary = [
          `Imported "${meta.title || target}" from ${host} in ${seconds}s — ${report.stats.words.toLocaleString()} words, ${report.outline.length} headings, ${report.stats.images} images, ${report.stats.tables} tables, ${report.stats.codeBlocks} code blocks.`,
          meta.description ? `Description: ${meta.description}` : '',
          meta.author || meta.published ? `Byline: ${[meta.author, meta.published].filter(Boolean).join(' · ')}` : '',
          report.warnings.length ? `analyze_markdown found ${warnings} warning(s) and ${infos} suggestion(s) — fix the warnings before rendering:` : 'analyze_markdown found no issues.',
          ...report.warnings.slice(0, 12).map((w) => `- [${w.severity}] ${w.line ? `line ${w.line}: ` : ''}${w.message}`),
          report.warnings.length > 12 ? `- … ${report.warnings.length - 12} more (call analyze_markdown for the full list)` : '',
          saved?.id ? `documentId: ${saved.id} — pass this to render_pdf with a settings patch (or to analyze_markdown after you edit the Markdown).` : '',
          '',
          `Suggested fileName: "${baseName.replace(/\.md$/, '')}". The Markdown follows as an embedded resource; keep the source URL as a footnote or a closing "Source" line when you render it.`,
        ]
          .filter(Boolean)
          .join('\n');

        return {
          content: [text(summary), resource],
          structuredContent: { url: target, format: 'markdown', ...meta, fileName: baseName.replace(/\.md$/, ''), stats: report.stats, outline: report.outline, warnings: report.warnings, durationMs: Date.now() - started, documentId: saved?.id || null },
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
              kind && kind !== 'other' ? `- Start from the "${kind}" template (list_templates with id) for structure. Do not copy a running header that repeats the title.` : '- Pick the closest template from list_templates for structure.',
              '- One `#` title, `##` sections, tables for structured data, callouts for key points, titled code blocks for code.',
              '- Do not put `---` above headings; H2s already have a rule and a divider looks like a double line.',
              '- Do not write a manual table of contents or number headings by hand; use settings.toc / settings.headingNumbers.',
              ASK_STYLES_MODE === 'always'
                ? '- Before render_pdf: list style options, recommend a starting set with an empty running header, and wait. Never put the H1/{title} in header.text.'
                : '- Recommend a recipe (empty running header). Wait only if a person is choosing a look; otherwise render. Never put the H1/{title} in header.text.',
              '- Run analyze_markdown and fix every warning. Keep the documentId.',
              '- Finish by calling render_pdf with documentId + settings. Read the LAYOUT REPORT (do not screenshot the PDF). Then give the user the download URL from the result (markdown link; Cursor: canvas iframe src = that URL) and report the file name.',
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
              '4. Suggest a settings object using the argument catalog — empty running header unless they asked for a brand line — then return the polished Markdown (and render if they asked for a PDF).',
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
              '5. Recommend design settings (theme, paper, TOC, header/footer, page numbers) — pick "clean" + toc for docs, "editorial" for long-form articles. Default: no running header (do not put the article title or site name on every page). Wait only if a person is choosing; otherwise apply the recipe.',
              '6. Call render_pdf with documentId (from import or analyze) + settings + fileName. Read the LAYOUT REPORT instead of screenshotting. Then give the user the download URL from the result (markdown link; Cursor: canvas iframe src = that URL) and report the result.',
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
              'You must know the available arguments (from get_markdown_guide / list_design_options / server instructions). When a person is choosing a look, list them and wait; on an unattended run apply a recipe:',
              '- Look: theme, accentColor, font, headingFont, fontSize, background',
              '- Page: paperSize, orientation, margins',
              '- Structure: toc, headingNumbers, cover (enabled, title, subtitle, author, date, showLogo), pageBreaks',
              '- Chrome: header.text (default empty — do not repeat the title), header.showDate, footer.text, footer.pageNumbers, footer.pageNumberStyle, logo',
              '- Output: fileName; optional assets for local images',
              'Recommend a recipe for this document type with an empty running header (do not repeat the H1 on every page). Wait only if they are choosing; if they said you may decide, apply that.',
              'Follow the authoring guide (no `---` above headings). Run analyze_markdown and fix warnings (keep documentId). Call render_pdf with documentId + settings + fileName. Read the LAYOUT REPORT (do not screenshot the PDF). Then give the user the download URL from the result (markdown link; Cursor: canvas iframe src = that URL). Tell them the file name and which settings you used.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
      ],
    }),
  );
}
