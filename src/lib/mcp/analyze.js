import { markdownToHtml, extractHeadings, textStats } from '../document/markdown.js';
import { hasNewpageIal, PAGE_BREAK_LINE_RE, stripNewpageIal } from '../document/pageBreaks.js';
import { inferTitle } from '../document/utils.js';

/** Codes that are suggestions rather than things that will render wrongly. */
const INFO_CODES = new Set([
  'multiple-h1',
  'consider-toc',
  'hard-wrapped',
  'long-code-block',
  'image-http',
  'heading-punctuation',
  'heading-long',
  'table-wide',
  'no-sections',
]);

/**
 * Static checks that catch the mistakes agents most often make when writing
 * Markdown for this renderer. Everything here is heuristic and line-based —
 * the goal is actionable warnings, not a full CommonMark parser.
 *
 * @param {string} markdown
 * @param {{ assets?: Record<string,string> }} [opts]
 * @returns {{ title: string, stats: { words: number, chars: number, minutes: number, headings: number, tables: number, codeBlocks: number, images: number, diagrams: number, callouts: number, footnotes: number, pageBreaks: number }, outline: Array<{ depth: number, text: string, line: number }>, warnings: Array<{ code: string, severity: 'warning'|'info', message: string, line?: number }> }}
 */
export function analyzeMarkdown(markdown, opts = {}) {
  const src = String(markdown || '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const assets = opts.assets || {};
  const warnings = [];
  const warn = (code, message, line) => {
    const w = { code, severity: INFO_CODES.has(code) ? 'info' : 'warning', message };
    if (line) w.line = line;
    warnings.push(w);
  };

  const outline = [];
  const stats = { tables: 0, codeBlocks: 0, images: 0, diagrams: 0, callouts: 0, footnotes: 0, pageBreaks: 0 };

  // ---- Front-matter -----------------------------------------------------------------------
  if (/^---\s*$/.test(lines[0] || '')) {
    const end = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end > 0 && lines.slice(1, end).some((l) => /^[\w-]+\s*:/.test(l))) {
      warn('front-matter', 'YAML front-matter is not supported; it renders as a rule plus a stray heading. Remove it and put the title in a `# H1`.', 1);
    }
  }

  // ---- Line scan ---------------------------------------------------------------------------
  let inFence = null; // { marker, lang, start }
  let fenceLines = 0;
  let prevDepth = 0;
  let h1Count = 0;
  let firstContentLine = -1;
  let tableHeaderCols = 0;
  let tableStart = -1;
  let inTable = false;
  const footnoteRefs = new Set();
  const footnoteDefs = new Set();
  const assetRefs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;

    // Fenced code
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (inFence) {
      if (fence && fence[1][0] === inFence.marker[0] && fence[1].length >= inFence.marker.length && !fence[2].trim()) {
        if (inFence.lang !== 'mermaid' && fenceLines > 45) {
          warn('long-code-block', `Code block of ${fenceLines} lines will flow across pages. Consider splitting it or trimming the example.`, inFence.start);
        }
        inFence = null;
      } else {
        fenceLines++;
      }
      continue;
    }
    if (fence) {
      const info = fence[2].trim();
      const lang = info.split(/[\s:]/)[0].toLowerCase();
      inFence = { marker: fence[1], lang, start: n };
      fenceLines = 0;
      if (lang === 'mermaid') stats.diagrams++;
      else {
        stats.codeBlocks++;
        if (!lang) warn('code-no-language', 'Fenced code block has no language. Add one (`bash`, `json`, `text`, …) so it is highlighted consistently.', n);
      }
      continue;
    }

    if (inTable && !/^\s*\|/.test(line) && !/\|\s*$/.test(line)) inTable = false;

    if (firstContentLine < 0 && line.trim()) firstContentLine = n;

    // Headings (ATX)
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      const depth = h[1].length;
      let text = h[2].replace(/[*_`]/g, '').trim();
      if (hasNewpageIal(text)) {
        stats.pageBreaks++;
        text = stripNewpageIal(text).trim();
      }
      outline.push({ depth, text, line: n });
      if (depth === 1) h1Count++;
      if (prevDepth && depth > prevDepth + 1) {
        warn('heading-skip', `Heading level jumps from H${prevDepth} to H${depth} ("${text}"). Use H${prevDepth + 1} so the outline and table of contents stay consistent.`, n);
      }
      if (i > 0 && lines[i - 1].trim() && !/^\s{0,3}#{1,6}\s/.test(lines[i - 1])) {
        warn('heading-no-blank-before', `Heading "${text}" should be preceded by a blank line.`, n);
      }
      if (/[.:]$/.test(text) && depth > 1) warn('heading-punctuation', `Heading "${text}" ends with punctuation — headings read better without it.`, n);
      if (text.length > 90) warn('heading-long', `Heading "${text.slice(0, 40)}…" is very long; keep headings under ~80 characters.`, n);
      prevDepth = depth;
      continue;
    }

    // Setext headings (text followed by === or ---) — usually accidental
    if (/^\s{0,3}(=+|-+)\s*$/.test(line) && i > 0 && lines[i - 1].trim() && !/^\s*[-*+]\s|^\s*\d+\.\s|^\s*\|/.test(lines[i - 1]) && !/^\s{0,3}#{1,6}\s/.test(lines[i - 1])) {
      const kind = line.trim()[0] === '=' ? 'H1' : 'H2';
      warn('setext-heading', `"${lines[i - 1].trim().slice(0, 40)}" is followed by \`${line.trim()[0].repeat(3)}\`, which turns it into an ${kind} heading. Use \`#\` headings, or add a blank line before a horizontal rule.`, n);
      continue;
    }

    // Tables
    if (/^\s*\|.*\|\s*$/.test(line) || (/\|/.test(line) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1] || ''))) {
      const cells = splitRow(line);
      if (!inTable) {
        const delim = lines[i + 1] || '';
        if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(delim)) {
          inTable = true;
          tableStart = n;
          tableHeaderCols = cells.length;
          stats.tables++;
          const delimCols = splitRow(delim).length;
          if (delimCols !== tableHeaderCols) warn('table-delimiter-mismatch', `Table header has ${tableHeaderCols} columns but the delimiter row has ${delimCols}.`, n + 1);
          if (tableHeaderCols > 6) warn('table-wide', `Table has ${tableHeaderCols} columns; more than 6 gets cramped on portrait paper. Split it or set orientation to "landscape".`, n);
          if (i > 0 && lines[i - 1].trim()) warn('table-no-blank-before', 'Table should be preceded by a blank line, otherwise it is treated as text.', n);
          i++; // skip delimiter
          continue;
        }
      } else if (cells.length !== tableHeaderCols) {
        warn('table-ragged-row', `Table row has ${cells.length} cells but the header (line ${tableStart}) has ${tableHeaderCols}.`, n);
      }
      continue;
    }

    // Callouts
    if (/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(line)) {
      stats.callouts++;
      if (!/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/.test(line)) warn('callout-case', 'Callout markers must be upper-case: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`.', n);
      if (!(lines[i + 1] || '').trim().startsWith('>')) warn('callout-empty', 'Callout has no body — put the text on the following `> ` line(s).', n);
    } else if (/^\s*>\s*\[!\w+\]/.test(line)) {
      warn('callout-unknown', `Unknown callout type on line ${n}. Supported: NOTE, TIP, IMPORTANT, WARNING, CAUTION.`, n);
    }

    // Horizontal rules immediately before a heading
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && /^\s{0,3}#{1,6}\s+/.test(lines[j])) {
        warn('hr-before-heading', 'Do not put `---` before a heading — H2s already have a rule, so a divider above them looks like a double line. Delete the `---` and leave a blank line.', n);
      }
    }
    if (PAGE_BREAK_LINE_RE.test(line)) {
      stats.pageBreaks++;
      const prev = i > 0 ? lines[i - 1] : '';
      const attachedToHeading = /^\s{0,3}#{1,6}\s+/.test(prev);
      if (!attachedToHeading && ((i > 0 && prev.trim()) || (lines[i + 1] || '').trim())) {
        warn('pagebreak-not-isolated', 'Page-break directive must be on its own line with blank lines before and after.', n);
      }
    }

    // Images
    const imgRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g;
    let im;
    while ((im = imgRe.exec(line))) {
      stats.images++;
      const href = im[1];
      if (href.startsWith('asset:')) {
        const key = decodeURIComponent(href.slice(6));
        assetRefs.push({ key, line: n });
        if (!assets[key]) warn('asset-missing', `Image references asset "${key}" but no such asset was supplied. Pass it in the \`assets\` map as a data URL.`, n);
      } else if (!/^(https?:)?\/\//i.test(href) && !href.startsWith('data:')) {
        warn('image-relative-path', `Image "${href}" uses a local/relative path; the renderer cannot access your files. Use an HTTPS URL or supply it via \`assets\` and reference \`asset:name\`.`, n);
      } else if (/^http:\/\//i.test(href)) {
        warn('image-http', `Image "${href}" is loaded over plain HTTP; prefer HTTPS so it is not blocked.`, n);
      }
    }

    // Footnotes
    for (const m of line.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) footnoteRefs.add(m[1]);
    const def = line.match(/^\s*\[\^([^\]\s]+)\]:/);
    if (def) footnoteDefs.add(def[1]);

    // Math
    if (/(^|[^\\$])\$\$[^$]+\$\$|(^|[^\\$\w])\$[^$\s][^$]*[^$\s]\$(?!\w)/.test(line) && !/\$\d/.test(line)) {
      warn('latex-math', 'LaTeX math (`$…$`) is not rendered — it will appear literally. Write the formula in words or with <sup>/<sub>.', n);
    }

    // Raw HTML layout
    const tag = line.match(/<\s*(table|div|span|center|style|script|iframe|font|p)\b[^>]*>/i);
    if (tag) warn('raw-html', `Raw <${tag[1].toLowerCase()}> HTML is unstyled or stripped. Use Markdown equivalents (tables, lists, callouts).`, n);

    // Shortcode emoji
    if (/(^|\s):[a-z0-9_+-]{2,}:(\s|$|[.,])/.test(line) && !/^\s*\|/.test(line)) {
      warn('emoji-shortcode', 'Emoji shortcodes like `:tada:` are not converted; paste the actual emoji character.', n);
    }

    // Trailing double-space line breaks in normal prose (allowed in address blocks, so only flag when frequent)
    if (/\S {2,}$/.test(line)) stats._hardBreaks = (stats._hardBreaks || 0) + 1;
  }

  if (inFence) warn('unclosed-fence', `Code fence opened on line ${inFence.start} is never closed.`, inFence.start);

  // ---- Document-level checks ----------------------------------------------------------------
  const title = inferTitle(src, '');
  if (h1Count === 0) warn('no-title', 'No `# H1` title. The first H1 becomes the document title, file name, {title} placeholder and cover title.');
  else if (outline[0]?.depth !== 1) warn('title-not-first', 'The `# H1` title should be the first heading in the document.', outline[0]?.line);
  if (h1Count > 1) warn('multiple-h1', `${h1Count} H1 headings found. Use one H1 for the title and \`##\` for sections (or set pageBreaks: "h1" if these are intentional chapters).`);
  if (firstContentLine > 0 && outline[0] && outline[0].line !== firstContentLine && h1Count > 0) {
    warn('content-before-title', 'There is content before the title heading; move the `# H1` to the very top.', firstContentLine);
  }

  for (const ref of footnoteRefs) if (!footnoteDefs.has(ref)) warn('footnote-undefined', `Footnote [^${ref}] is referenced but never defined (\`[^${ref}]: …\`).`);
  for (const d of footnoteDefs) if (!footnoteRefs.has(d)) warn('footnote-unused', `Footnote [^${d}] is defined but never referenced.`);
  stats.footnotes = footnoteDefs.size;

  if (/^\s{0,3}#{1,3}\s+(table of )?contents\s*$/im.test(src)) {
    warn('manual-toc', 'A hand-written table of contents was found. Remove it and set `settings.toc: true` — the generated one has correct anchors.');
  }
  // Hand-numbered headings: only flag hierarchical numbering ("2.1 Scope") or when every H2 is numbered —
  // a few "1. / 2. / 3." sub-headings mirroring an agenda are a legitimate pattern.
  const numbered = outline.filter((h) => h.depth > 1 && /^\d+(\.\d+)*[.)]?\s/.test(h.text));
  const h2s = outline.filter((h) => h.depth === 2);
  if (numbered.some((h) => /^\d+\.\d+/.test(h.text)) || (h2s.length >= 3 && h2s.every((h) => /^\d+[.)]?\s/.test(h.text)))) {
    warn('manual-heading-numbers', 'Headings are numbered by hand. Remove the numbers and set `settings.headingNumbers: true` so numbering stays consistent.', numbered[0]?.line);
  }
  if ((stats._hardBreaks || 0) > 12) {
    warn('hard-wrapped', `${stats._hardBreaks} lines end with two spaces (forced line breaks). If the text is hard-wrapped prose, join the lines into paragraphs.`);
  }
  delete stats._hardBreaks;

  const words = textStats(src);
  if (words.words > 250 && outline.length < 2) warn('no-sections', 'Long document with almost no headings. Break it into `##` sections.');
  if (words.words > 1200 && !opts.toc) warn('consider-toc', 'Document is long enough to benefit from a table of contents (`settings.toc: true`).');

  // Sanity-check that the parser agrees with the outline (catches odd indentation, list-embedded headings…)
  let renderedHeadings = 0;
  try {
    renderedHeadings = extractHeadings(markdownToHtml(src, { assets, emoji: false }), 6).length;
  } catch {
    /* ignore */
  }

  return {
    title: title || null,
    stats: { ...words, headings: renderedHeadings || outline.length, ...stats },
    outline,
    warnings,
  };
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/);
}
