import { CODE_FONT } from './settings.js';
import { hexToRgb } from './utils.js';

/**
 * Generate the stylesheet for a document.
 * @param {ReturnType<import('./settings.js').resolveDesign>} design
 * @param {import('./settings.js').DEFAULT_SETTINGS} settings
 * @param {'preview'|'pdf'} mode
 */
export function buildStyles(design, settings, mode) {
  const t = design.theme;
  const accentRgb = hexToRgb(t.accent);
  const body = design.fontSize.body;
  const tableHeaderText = t.tableHeaderText || t.heading;
  const isPreview = mode === 'preview';
  const { x: mx, y: my } = design.margins;

  const codeAvoidLines = 28; // code blocks shorter than this never split across pages

  const backgroundCss = backgroundLayer(settings.background, t, accentRgb);

  return `
    *, *::before, *::after { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }

    body {
      font-family: ${design.font.family};
      font-size: ${body}pt;
      line-height: 1.6;
      color: ${t.text};
      background: ${t.background};
      font-feature-settings: "kern" 1, "liga" 1;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      ${settings.justify ? 'text-align: justify; hyphens: auto;' : ''}
    }

    ${
      isPreview
        ? `
    body { background: transparent; }
    .sheet {
      position: relative;
      width: ${design.pageWidth}px;
      min-height: ${design.pageHeight}px;
      margin: 0 auto;
      background: ${t.background};
      box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 24px 48px -24px rgba(15,23,42,.35);
      overflow: hidden;
    }
    .sheet-inner {
      position: relative; min-height: ${design.pageHeight}px;
      padding: ${my + (design.hasRunningHeader ? 30 : 0)}px ${mx}px ${my + (design.hasRunningFooter ? 30 : 0)}px;
    }
    .running {
      position: absolute; left: ${mx}px; right: ${mx}px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      font-size: 8pt; color: ${t.muted}; pointer-events: none;
    }
    .running.top { top: ${Math.round(my * 0.55)}px; }
    .running.bottom { bottom: ${Math.round(my * 0.55)}px; }
    .running-brand { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; }
    .running img { height: 16px; width: auto; display: block; flex-shrink: 0; }
    .running .hint { font-size: 7pt; opacity: .55; font-style: italic; }
    /* A block that flows across pages (long table/list): dashed line where the PDF will split it. */
    .page-guide {
      position: absolute; left: -${mx}px; right: -${mx}px; height: 0;
      border-top: 1px dashed rgba(${accentRgb}, .45);
      pointer-events: none; z-index: 2;
    }
    .page-guide::after {
      content: attr(data-label);
      position: absolute; right: 10px; top: -9px;
      font: 500 9px/1 system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase;
      color: rgba(${accentRgb}, .8); background: ${t.background}; padding: 2px 6px; border-radius: 4px;
    }
    /* Gap between two simulated pages: end of page, gutter, start of next page. */
    .page-gap {
      position: relative; margin: 0 -${mx}px; pointer-events: none; z-index: 2;
    }
    .page-gap::before {
      content: ''; position: absolute; left: 0; right: 0; top: calc(var(--fill, 0px) + ${design.hasRunningFooter ? my + 30 : my}px); height: 28px;
      background: rgba(100, 116, 139, .16);
      box-shadow: inset 0 6px 6px -6px rgba(0, 0, 0, .28), inset 0 -6px 6px -6px rgba(0, 0, 0, .28);
    }
    .page-gap.manual::after {
      content: 'manual page break'; position: absolute; left: 50%; transform: translateX(-50%);
      top: calc(var(--fill, 0px) + ${design.hasRunningFooter ? my + 30 : my}px + 9px);
      font: 500 9px/1 system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: rgba(100, 116, 139, .9);
    }
    .page-break { height: 0; margin: 0; border: 0; }
    .cover { height: ${design.pageHeight - (my + (design.hasRunningHeader ? 30 : 0)) - (my + (design.hasRunningFooter ? 30 : 0))}px; margin-bottom: 0; }
    .doc { position: relative; }
    `
        : `
    html { background: ${t.background}; }
    .sheet, .sheet-inner { position: relative; }
    .page-break { break-before: page; page-break-before: always; height: 0; margin: 0; }
    .cover { height: ${design.pageHeight - (my + (design.hasRunningHeader ? 30 : 0)) - (my + (design.hasRunningFooter ? 30 : 0)) - 4}px; break-after: page; page-break-after: always; }
    `
    }

    .page-bg {
      position: ${isPreview ? 'absolute' : 'fixed'};
      inset: 0; z-index: 0; pointer-events: none;
      ${backgroundCss}
    }
    .doc { position: relative; z-index: 1; }

    /* ---------- Watermark ---------- */
    .watermark {
      position: ${isPreview ? 'absolute' : 'fixed'};
      inset: 0; z-index: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;
    }
    .watermark img { width: 55%; max-width: 420px; opacity: .06; filter: grayscale(1); }

    /* ---------- Cover ---------- */
    .cover {
      display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
      gap: .6em; text-align: left; position: relative; min-width: 0; max-width: 100%;
    }
    .cover .cover-logo { height: 64px; width: auto; max-width: 100%; margin-bottom: 2.5em; }
    .cover .cover-kicker { font-size: .8em; letter-spacing: .14em; text-transform: uppercase; color: ${t.accent}; font-weight: 600; max-width: 90%; }
    .cover h1.cover-title {
      font-size: 3.2em; line-height: 1.08; margin: 0; padding: 0; border: 0; letter-spacing: -.02em;
      width: 90%; max-width: 100%; min-width: 0; white-space: normal; overflow-wrap: break-word; hyphens: manual;
    }
    .cover .cover-subtitle { font-size: 1.35em; color: ${t.muted}; margin: .3em 0 0; width: 80%; max-width: 100%; min-width: 0; line-height: 1.4; }
    .cover .cover-rule { width: 64px; height: 4px; background: ${t.accent}; border-radius: 2px; margin: 1.6em 0; }
    .cover .cover-meta { font-size: .95em; color: ${t.muted}; display: flex; flex-direction: column; gap: .25em; }
    .cover .cover-meta strong { color: ${t.text}; font-weight: 600; }

    /* ---------- Title block (first heading + optional logo) ---------- */
    .title-block { display: flex; align-items: center; justify-content: space-between; gap: 1.5em; margin-bottom: 1.2em; padding-bottom: .6em; border-bottom: 2px solid ${t.accent}; break-after: avoid; }
    .title-block h1 { flex: 1; min-width: 0; margin: 0; padding: 0; border: 0; }
    .title-block .title-logo { flex-shrink: 0; display: block; width: auto; }
    .logo-above { display: block; width: auto; max-width: 100%; margin: 0 0 1.4em; }

    /* ---------- Table of contents ---------- */
    .toc { margin: .4em 0 2.2em; padding: 0; border: 0; background: transparent; }
    .toc-title {
      font-family: ${design.headingFont.family}; font-weight: 700; font-size: 1.5em; line-height: 1.25;
      letter-spacing: -.01em; text-transform: none; color: ${t.heading};
      margin: 0 0 .85em; padding: 0 0 .3em; border-bottom: 1px solid ${t.border};
    }
    .toc ol { list-style: none; margin: 0; padding: 0; }
    .toc li { margin: 0; padding: .38em 0; line-height: 1.4; break-inside: avoid; border-bottom: 1px solid rgba(${hexToRgb(t.border)}, .7); }
    .toc li.d1 { margin-top: .35em; }
    .toc li.d1:first-child { margin-top: 0; }
    .toc li.d2 { padding-left: 1.35em; }
    .toc li.d3 { padding-left: 2.7em; font-size: .93em; }
    .toc a { color: ${t.text}; text-decoration: none; border-bottom: 0; display: block; }
    .toc li.d1 a { font-weight: 600; color: ${t.heading}; }
    .toc li.d3 a { color: ${t.muted}; font-weight: 400; }
    .title-block + .toc, h1 + .toc { margin-top: 1.6em; }
    .doc > .toc:first-child { margin-top: 0; }
    .toc.toc-page { margin-bottom: 0; }
    ${!isPreview ? `.toc.toc-page { break-after: page; page-break-after: always; }` : ''}

    /* ---------- Headings ---------- */
    h1, h2, h3, h4, h5, h6 {
      font-family: ${design.headingFont.family};
      color: ${t.heading};
      font-weight: 700;
      line-height: 1.25;
      margin: 1.6em 0 .5em;
      letter-spacing: -.01em;
      break-after: avoid; page-break-after: avoid;
      break-inside: avoid;
      text-align: left;
    }
    h1 { font-size: 2.1em; margin-top: 0; padding-bottom: .35em; border-bottom: 2px solid ${t.accent}; letter-spacing: -.02em; }
    h2 { font-size: 1.5em; padding-bottom: .25em; border-bottom: 1px solid ${t.border}; }
    h3 { font-size: 1.22em; }
    h4 { font-size: 1.05em; }
    h5 { font-size: .95em; text-transform: uppercase; letter-spacing: .06em; }
    h6 { font-size: .9em; color: ${t.muted}; }
    .doc > h1:first-child, .doc > .title-block:first-child { margin-top: 0; }
    .heading-number { color: ${t.accent}; font-weight: 600; margin-right: .35em; font-variant-numeric: tabular-nums; }
    ${settings.pageBreaks !== 'auto' && !isPreview ? `.doc h1:not(:first-child):not(.cover-title) { break-before: page; page-break-before: always; }` : ''}
    ${settings.pageBreaks === 'h2' && !isPreview ? `.doc h2 { break-before: page; page-break-before: always; }` : ''}
    .title-block + h2, h1 + h2, .toc + h2 { margin-top: 1em; }

    /* ---------- Text ---------- */
    p { margin: 0 0 .9em; orphans: 3; widows: 3; }
    a { color: ${t.link}; text-decoration: none; border-bottom: 1px solid rgba(${hexToRgb(t.link)}, .35); }
    strong, b { font-weight: 700; color: ${t.heading}; }
    em, i { font-style: italic; }
    del, s { color: ${t.muted}; }
    mark { background: rgba(${accentRgb}, .18); color: inherit; padding: 0 .15em; border-radius: 2px; }
    small { font-size: .85em; color: ${t.muted}; }
    kbd { font-family: ${CODE_FONT.family}; font-size: .8em; padding: .1em .4em; border: 1px solid ${t.border}; border-bottom-width: 2px; border-radius: 4px; background: ${t.codeBackground}; }
    hr { border: 0; border-top: 1px solid ${t.border}; margin: 2em 0; }
    sup, sub { line-height: 0; font-size: .75em; }
    .emoji { height: 1em; width: 1em; vertical-align: -.12em; margin: 0 .05em; display: inline-block; }

    /* ---------- Lists ---------- */
    ul, ol { margin: 0 0 1em; padding-left: 1.6em; }
    li { margin: .25em 0; }
    li > ul, li > ol { margin: .25em 0 .25em; }
    li > p { margin-bottom: .4em; }
    ul li::marker { color: ${t.accent}; }
    ol li::marker { color: ${t.accent}; font-weight: 600; font-variant-numeric: tabular-nums; }
    li.task-item { list-style: none; display: flex; align-items: flex-start; gap: .6em; margin-left: -1.6em; }
    li.task-item .task-box {
      flex: none; width: 1.05em; height: 1.05em; margin-top: .3em; box-sizing: border-box;
      border: 1.5px solid ${t.muted}; border-radius: 3px; background: ${t.background};
    }
    li.task-item.done .task-box {
      background: ${t.accent} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7'/%3E%3C/svg%3E") center / 78% no-repeat;
      border-color: ${t.accent};
    }
    li.task-item .task-body { flex: 1; min-width: 0; }
    li.task-item .task-body > p:last-child { margin-bottom: 0; }
    li.task-item.done .task-body { color: ${t.muted}; text-decoration: line-through; text-decoration-color: rgba(${hexToRgb(t.muted)}, .45); }
    li.task-item.done .task-body ul, li.task-item.done .task-body ol { text-decoration: none; color: ${t.text}; }

    /* ---------- Blockquotes ---------- */
    blockquote {
      margin: 1.2em 0; padding: .8em 1.2em;
      border-left: 4px solid ${t.accent}; background: ${t.quoteBackground}; border-radius: 0 6px 6px 0;
      color: ${t.text}; break-inside: avoid;
    }
    blockquote p { margin: 0; }
    blockquote p + p { margin-top: .6em; }
    blockquote cite, blockquote em:last-child { color: ${t.muted}; }

    /* ---------- Alerts (GitHub-style > [!NOTE]) ---------- */
    .markdown-alert { margin: 1.2em 0; padding: .8em 1.1em; border-radius: 6px; border: 1px solid; border-left-width: 4px; break-inside: avoid; }
    .markdown-alert p { margin: 0; }
    .markdown-alert p + p { margin-top: .5em; }
    .markdown-alert-title { display: flex; align-items: center; gap: .45em; font-weight: 700; font-size: .95em; margin-bottom: .35em !important; }
    .markdown-alert-title svg { width: 1em; height: 1em; fill: currentColor; }
    .markdown-alert-note { border-color: rgba(59,130,246,.35); background: rgba(59,130,246,.07); }
    .markdown-alert-note .markdown-alert-title { color: #2563EB; }
    .markdown-alert-tip { border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.07); }
    .markdown-alert-tip .markdown-alert-title { color: #15803D; }
    .markdown-alert-important { border-color: rgba(168,85,247,.35); background: rgba(168,85,247,.07); }
    .markdown-alert-important .markdown-alert-title { color: #7E22CE; }
    .markdown-alert-warning { border-color: rgba(245,158,11,.4); background: rgba(245,158,11,.08); }
    .markdown-alert-warning .markdown-alert-title { color: #B45309; }
    .markdown-alert-caution { border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.07); }
    .markdown-alert-caution .markdown-alert-title { color: #B91C1C; }

    /* ---------- Code ---------- */
    code, pre, kbd, samp { font-family: ${CODE_FONT.family}; }
    :not(pre) > code {
      font-size: .86em; padding: .12em .38em; border-radius: 4px;
      background: ${t.codeBackground}; color: ${t.codeText}; border: 1px solid ${t.border};
      word-break: break-word;
    }
    .code-block { margin: 1.2em 0; border-radius: 8px; border: 1px solid ${t.border}; background: ${t.codeBackground}; overflow: hidden; }
    .code-block .code-title {
      display: flex; align-items: center; gap: .5em; padding: .45em 1em; font-family: ${CODE_FONT.family};
      font-size: .74em; color: ${t.muted}; border-bottom: 1px solid ${t.border}; background: rgba(${hexToRgb(t.text)}, .03);
      letter-spacing: .02em;
    }
    .code-block .code-title::before { content: ''; width: .55em; height: .55em; border-radius: 50%; background: ${t.accent}; opacity: .7; }
    .code-block pre { margin: 0; padding: .9em 1.1em; overflow-x: auto; }
    .code-block pre code { display: block; font-size: .84em; line-height: 1.55; color: ${t.codeText}; background: none; border: 0; padding: 0; white-space: pre-wrap; word-break: break-word; tab-size: 2; }
    ${Array.from({ length: codeAvoidLines }, (_, i) => `.code-block[data-lines="${i + 1}"]`).join(',')} { break-inside: avoid; page-break-inside: avoid; }
    ${t.dark ? hljsDark() : hljsLight()}

    /* ---------- Tables ---------- */
    .table-wrap { margin: 1.2em 0; }
    table { width: 100%; border-collapse: collapse; font-size: .9em; line-height: 1.45; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { padding: .5em .75em; border: 1px solid ${t.border}; text-align: left; vertical-align: top; }
    th { background: ${t.tableHeader}; color: ${tableHeaderText}; font-weight: 600; font-size: .92em; letter-spacing: .01em; }
    ${t.tableHeaderText ? `th { border-color: ${t.tableHeader}; }` : ''}
    tbody tr:nth-child(even) td { background: ${t.tableStripe}; }
    td code { font-size: .82em; }
    table[data-cols="2"] td:first-child { width: 32%; }

    /* ---------- Figures & images ---------- */
    img { max-width: 100%; height: auto; }
    figure { margin: 1.4em 0; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    figure img { display: inline-block; max-width: 100%; max-height: ${Math.round(design.pageHeight * 0.55)}px; border-radius: 6px; }
    figcaption { margin-top: .55em; font-size: .85em; color: ${t.muted}; font-style: italic; }
    figure.diagram { break-inside: avoid; }
    figure.diagram .mermaid { background: transparent; text-align: center; font-family: inherit; }
    figure.diagram .mermaid svg { max-width: 100%; height: auto; }
    .missing-asset { display: inline-block; padding: .3em .6em; border: 1px dashed ${t.muted}; border-radius: 4px; color: ${t.muted}; font-size: .85em; }

    /* ---------- Footnotes ---------- */
    .footnotes { margin-top: 2.5em; font-size: .86em; color: ${t.muted}; }
    .footnotes hr { margin: 1.2em 0; }
    .footnotes .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .footnotes ol { padding-left: 1.4em; }
    .footnotes li { margin: .4em 0; }
    .footnotes p { margin: 0; display: inline; }
    [data-footnote-ref] { border: 0; font-weight: 600; padding: 0 .1em; }
    [data-footnote-backref] { border: 0; margin-left: .35em; }

    /* ---------- Definition lists & misc ---------- */
    dl { margin: 1em 0; } dt { font-weight: 600; color: ${t.heading}; } dd { margin: 0 0 .6em 1.2em; color: ${t.muted}; }
    details { margin: 1em 0; padding: .6em 1em; border: 1px solid ${t.border}; border-radius: 6px; }
    summary { font-weight: 600; cursor: pointer; }
    .doc > :first-child { margin-top: 0; }
    .doc > :last-child { margin-bottom: 0; }

    @media print {
      body { background: ${t.background} !important; }
      a { color: ${t.link} !important; }
    }
  `;
}

function backgroundLayer(kind, t, accentRgb) {
  const dark = t.dark;
  switch (kind) {
    case 'soft':
      return `background: linear-gradient(180deg, rgba(${accentRgb}, ${dark ? 0.12 : 0.06}) 0%, rgba(${accentRgb}, 0) 38%);`;
    case 'gradient':
      return `background:
        radial-gradient(ellipse at 100% 0%, rgba(${accentRgb}, ${dark ? 0.28 : 0.14}) 0%, rgba(${accentRgb}, 0) 55%),
        radial-gradient(ellipse at 0% 100%, rgba(${accentRgb}, ${dark ? 0.18 : 0.08}) 0%, rgba(${accentRgb}, 0) 55%);`;
    case 'dots':
      return `background-image: radial-gradient(rgba(${hexToRgb(t.muted)}, ${dark ? 0.35 : 0.22}) 1px, transparent 1px); background-size: 18px 18px;`;
    case 'grid':
      return `background-image:
        linear-gradient(rgba(${hexToRgb(t.muted)}, ${dark ? 0.2 : 0.12}) 1px, transparent 1px),
        linear-gradient(90deg, rgba(${hexToRgb(t.muted)}, ${dark ? 0.2 : 0.12}) 1px, transparent 1px);
        background-size: 28px 28px;`;
    case 'lines':
      return `background-image: linear-gradient(rgba(${hexToRgb(t.muted)}, ${dark ? 0.22 : 0.14}) 1px, transparent 1px); background-size: 100% 28px;`;
    default:
      return 'display: none;';
  }
}

function hljsLight() {
  return `
    .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-doctag, .hljs-meta .hljs-keyword, .hljs-template-tag { color: #d73a49; }
    .hljs-title, .hljs-title.function_, .hljs-title.class_, .hljs-section { color: #6f42c1; }
    .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number, .hljs-literal { color: #005cc5; }
    .hljs-string, .hljs-regexp, .hljs-addition, .hljs-meta .hljs-string { color: #032f62; }
    .hljs-built_in, .hljs-symbol { color: #e36209; }
    .hljs-name, .hljs-selector-id, .hljs-tag { color: #22863a; }
    .hljs-bullet, .hljs-code { color: #735c0f; }
    .hljs-deletion { color: #b31d28; background: #ffeef0; }
    .hljs-emphasis { font-style: italic; } .hljs-strong { font-weight: 700; }
  `;
}

function hljsDark() {
  return `
    .hljs-comment, .hljs-quote { color: #8b949e; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-doctag, .hljs-meta .hljs-keyword, .hljs-template-tag { color: #ff7b72; }
    .hljs-title, .hljs-title.function_, .hljs-title.class_, .hljs-section { color: #d2a8ff; }
    .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number, .hljs-literal { color: #79c0ff; }
    .hljs-string, .hljs-regexp, .hljs-addition, .hljs-meta .hljs-string { color: #a5d6ff; }
    .hljs-built_in, .hljs-symbol { color: #ffa657; }
    .hljs-name, .hljs-selector-id, .hljs-tag { color: #7ee787; }
    .hljs-bullet, .hljs-code { color: #f2cc60; }
    .hljs-deletion { color: #ffdcd7; background: #67060c; }
    .hljs-emphasis { font-style: italic; } .hljs-strong { font-weight: 700; }
  `;
}
