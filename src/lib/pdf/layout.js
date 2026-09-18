/**
 * Merge the printed PDF (line positions) with the DOM appearance snapshot
 * into a text layout report agents can read instead of screenshotting pages.
 */

const KIND_LABEL = {
  cover: 'COVER',
  toc: 'TOC',
  title: 'TITLE',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  h4: 'H4',
  h5: 'H5',
  h6: 'H6',
  p: 'P',
  table: 'TABLE',
  ul: 'UL',
  ol: 'OL',
  tasks: 'TASKS',
  code: 'CODE',
  callout: 'CALLOUT',
  quote: 'QUOTE',
  figure: 'FIGURE',
  diagram: 'DIAGRAM',
  hr: 'RULE',
  logo: 'LOGO',
};

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function needleOf(text, max = 42) {
  const t = norm(text).replace(/[^\p{L}\p{N} ./-]+/gu, '');
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesNeedle(haystack, needle) {
  if (!needle) return false;
  if (needle.length >= 12) return haystack.includes(needle);
  return new RegExp(`(^|\\s)${escapeRe(needle)}(\\s|$)`).test(haystack);
}

function findOnPages(needle, pages, from = 0) {
  if (!needle || needle.length < 3) return -1;
  for (let i = from; i < pages.length; i++) {
    if (includesNeedle(norm(pages[i].text), needle)) return i;
  }
  for (let i = from; i < pages.length; i++) {
    const all = `${pages[i].header} ${pages[i].text} ${pages[i].footer}`;
    if (includesNeedle(norm(all), needle)) return i;
  }
  return -1;
}

function lineForNeedle(page, needle) {
  if (!page || !needle) return null;
  const n = needle;
  for (const l of page.body) {
    const t = norm(l.text);
    if (!t) continue;
    if (t === n || t.startsWith(n) || (n.startsWith(t) && (t.length >= 8 || n === t || n.startsWith(`${t} `)))) return l;
    if (n.length >= 12 && t.includes(n.slice(0, 12))) return l;
  }
  return null;
}

function describeLook(block) {
  const look = block.look || {};
  const bits = [];
  if (look.fontSize) bits.push(look.fontSize);
  if (look.fontWeight && Number(look.fontWeight) >= 600) bits.push('bold');
  if (look.color) bits.push(look.color);
  if (look.background) bits.push(`bg ${look.background}`);
  if (look.borderBottom) bits.push(`rule ${look.borderBottom}`);
  if (look.borderLeft) bits.push(`bar ${look.borderLeft}`);
  if (look.align && look.align !== 'left') bits.push(look.align);
  if (look.lines > 1 && (block.kind === 'p' || block.kind === 'quote' || block.kind === 'callout')) {
    bits.push(`${look.lines} lines`);
  }
  if (look.overflowX) bits.push('OVERFLOW-X');
  return bits.join(', ');
}

function describeBlock(block) {
  const label = KIND_LABEL[block.kind] || block.kind.toUpperCase();
  if (block.kind === 'cover') {
    const c = block.cover || {};
    const parts = ['cover page'];
    if (c.hasLogo) parts.push('logo');
    if (c.kicker) parts.push(`kicker "${c.kicker}"`);
    if (c.title) parts.push(`title "${c.title}"`);
    if (c.subtitle) parts.push(`subtitle "${c.subtitle}"`);
    return { label, summary: parts.join(' · '), extra: c.titleLook ? describeLook({ look: c.titleLook, kind: 'h1' }) : describeLook(block) };
  }
  if (block.kind === 'toc') {
    const t = block.toc || {};
    return { label, summary: `${t.entries || 0} entries`, extra: (t.preview || []).slice(0, 6).join(' · ') };
  }
  if (block.kind === 'table') {
    const t = block.table || {};
    const head = t.hasHeader ? `header [${(t.header || []).join(' | ')}]` : 'no header';
    const split = block.split
      ? `rows ${block.split.from}–${block.split.to} of ${t.rows}`
      : `${t.rows} rows`;
    const colours = t.hasHeader && t.headerBackground
      ? `header ${t.headerColor} on ${t.headerBackground}`
      : '';
    return {
      label,
      summary: `${t.cols} cols, ${split}, ${head}`,
      extra: [colours, t.rowsPreview?.[0] ? `e.g. ${(t.rowsPreview[0] || []).join(' | ')}` : ''].filter(Boolean).join(' · '),
    };
  }
  if (block.kind === 'ul' || block.kind === 'ol' || block.kind === 'tasks') {
    const l = block.list || {};
    return { label, summary: `${l.items || 0} items`, extra: (l.preview || []).slice(0, 4).join(' · ') };
  }
  if (block.kind === 'code') {
    const c = block.code || {};
    return { label, summary: [c.lang, c.title && `"${c.title}"`, c.lines && `${c.lines} lines`].filter(Boolean).join(' · '), extra: block.text };
  }
  if (block.kind === 'callout') {
    return { label, summary: (block.callout?.type || 'note').toUpperCase(), extra: block.text };
  }
  if (block.kind === 'figure' || block.kind === 'diagram' || block.kind === 'logo') {
    const img = block.image;
    const size = img ? `${img.width}×${img.height}px` : '';
    return { label, summary: [size, img?.alt && `alt "${img.alt}"`, block.caption && `"${block.caption}"`].filter(Boolean).join(' · '), extra: describeLook(block) };
  }
  if (block.kind === 'hr') return { label, summary: 'horizontal rule', extra: describeLook(block) };
  if (block.kind === 'title') {
    return { label, summary: `"${block.text}"`, extra: [describeLook(block), block.image ? `logo ${block.image.width}×${block.image.height}px` : ''].filter(Boolean).join(' · ') };
  }
  return { label, summary: block.text ? `"${block.text}"` : '', extra: describeLook(block) };
}

function inferBreak(prevPage, page, firstBlock) {
  if (!prevPage || !firstBlock) return '';
  const flags = firstBlock.flags || {};
  if (firstBlock.kind === 'cover') return 'cover';
  if (firstBlock.kind === 'toc' && firstBlock === page.blocks[0]) return 'contents page';
  if (flags.manualPageStart) return 'manual \\pagebreak';
  if (flags.headingPageStart) return `heading mode (${firstBlock.kind})`;
  if (firstBlock.kind === 'table' && firstBlock.split && firstBlock.split.from > 1) return 'table continuation';
  if (firstBlock.kind === 'code' && firstBlock.split) return 'code continuation';
  if (prevPage.usedPct < 55 && /^h[1-6]$/.test(firstBlock.kind)) return 'keep-together (section opening did not fit)';
  if (prevPage.usedPct >= 90) return 'page full';
  return 'content overflow';
}

function padPct(n) {
  const v = Number.isFinite(n) ? Math.max(0, Math.min(99, Math.round(n))) : 0;
  return String(v).padStart(2, ' ');
}

/**
 * Attach each DOM block to the printed page whose text contains it.
 * Tables/code that span pages are cloned into a continuation on later pages.
 */
export function assignBlocksToPages(dom, printed) {
  const pages = printed.pages.map((p) => ({
    number: p.number,
    header: p.header,
    footer: p.footer,
    usedPct: p.usedPct,
    text: p.text,
    body: p.body,
    blocks: [],
    role: '',
  }));

  let cursor = 0;
  for (const block of dom.blocks || []) {
    if (block.kind === 'table' && block.table?.rowNeedles?.length) {
      const rows = block.table.rowNeedles;
      let firstPage = -1;
      let lastPage = -1;
      const byPage = new Map();
      rows.forEach((row, idx) => {
        const n = needleOf(row, 48);
        const pi = findOnPages(n, printed.pages, Math.max(0, cursor - 0));
        if (pi < 0) return;
        if (firstPage < 0) firstPage = pi;
        lastPage = pi;
        if (!byPage.has(pi)) byPage.set(pi, { from: idx + 1, to: idx + 1 });
        else byPage.get(pi).to = idx + 1;
      });
      if (firstPage < 0) {
        const pi = Math.min(cursor, pages.length - 1);
        pages[pi].blocks.push({ ...block, yPct: null, split: null });
        continue;
      }
      cursor = firstPage;
      for (const [pi, range] of byPage) {
        const startNeedle = needleOf(rows[range.from - 1], 48);
        const line = lineForNeedle(printed.pages[pi], startNeedle);
        pages[pi].blocks.push({
          ...block,
          yPct: line ? line.yPct : null,
          split: byPage.size > 1 ? range : null,
        });
      }
      cursor = Math.max(cursor, lastPage);
      continue;
    }

    const needle = needleOf(block.cover?.title || block.text, 42);
    let pi = findOnPages(needle, printed.pages, cursor);
    if (pi < 0 && block.kind === 'cover') pi = 0;
    if (pi < 0 && (block.kind === 'figure' || block.kind === 'diagram' || block.kind === 'logo' || block.kind === 'hr')) {
      pi = Math.min(cursor, pages.length - 1);
    }
    if (pi < 0) {
      pi = Math.min(cursor, pages.length - 1);
    }
    cursor = pi;
    const line = lineForNeedle(printed.pages[pi], needle);
    pages[pi].blocks.push({ ...block, yPct: line ? line.yPct : null, split: null });
  }

  for (const page of pages) {
    const kinds = page.blocks.map((b) => b.kind);
    if (kinds[0] === 'cover' && kinds.every((k) => k === 'cover')) page.role = 'cover';
    else if (kinds[0] === 'toc' && kinds.filter((k) => k !== 'toc').length === 0) page.role = 'contents';
    else if (kinds.includes('toc') && page.number === 1) page.role = 'title + contents';
  }

  return pages;
}

export function detectLayoutIssues(pages, { title = '', settings = {}, overflow = [] } = {}) {
  const issues = [];
  const headerText = (settings.header?.text || '').replace(/\{title\}/gi, title).trim();
  if (headerText && title && norm(headerText) === norm(title)) {
    issues.push({
      severity: 'warning',
      code: 'header-repeats-title',
      message: 'Running header repeats the document title on every page. Clear header.text — the H1 already prints once.',
    });
  }

  for (const el of overflow) {
    issues.push({
      severity: 'warning',
      code: 'horizontal-overflow',
      message: `Content is wider than the page and will clip or squeeze: ${el}`,
    });
  }

  pages.forEach((page, idx) => {
    const next = pages[idx + 1];
    const last = page.blocks[page.blocks.length - 1];
    const first = page.blocks[0];

    if (page.blocks.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'blank-page',
        page: page.number,
        message: `Page ${page.number} has no body content (blank page).`,
      });
    }

    if (last && /^h[1-6]$/.test(last.kind) && (last.yPct == null || last.yPct >= 78)) {
      issues.push({
        severity: 'warning',
        code: 'heading-at-bottom',
        page: page.number,
        message: `Page ${page.number} ends with ${last.kind.toUpperCase()} "${last.text}" — the heading is stranded at the bottom. Put \\pagebreak before it, or keep a paragraph with it.`,
      });
    }

    if (next && page.usedPct > 0 && page.usedPct < 32 && page.role !== 'cover' && page.role !== 'contents') {
      issues.push({
        severity: 'info',
        code: 'sparse-page',
        page: page.number,
        message: `Page ${page.number} is only ${Math.round(page.usedPct)}% full before a break to page ${next.number} (${inferBreak(page, next, next.blocks[0]) || 'forced break'}).`,
      });
    }

    if (!next && pages.length > 1 && page.usedPct > 0 && page.usedPct < 14 && first && /^h[1-6]$/.test(first.kind)) {
      issues.push({
        severity: 'info',
        code: 'short-last-page',
        page: page.number,
        message: `Last page is only ${Math.round(page.usedPct)}% full and starts with ${first.kind.toUpperCase()} "${first.text}". A manual break may have left a near-empty sheet.`,
      });
    }

    for (const block of page.blocks) {
      if (block.kind === 'table' && block.split && block.split.from === 1 && block.split.to <= 2 && next) {
        issues.push({
          severity: 'info',
          code: 'table-thin-start',
          page: page.number,
          message: `Table "${(block.table?.header || []).join(' | ') || 'untitled'}" shows only rows ${block.split.from}–${block.split.to} on page ${page.number} before continuing.`,
        });
      }
      if ((block.kind === 'figure' || block.kind === 'diagram') && (block.image?.height || 0) > 620) {
        issues.push({
          severity: 'info',
          code: 'tall-figure',
          page: page.number,
          message: `${block.kind} on page ${page.number} is ${block.image.height}px tall and may dominate the page.`,
        });
      }
      if (block.kind === 'table' && (block.table?.cols || 0) > 6) {
        issues.push({
          severity: 'info',
          code: 'wide-table',
          page: page.number,
          message: `Table on page ${page.number} has ${block.table.cols} columns — cells will be tight on portrait paper.`,
        });
      }
    }
  });

  return issues;
}

function formatChrome(label, text) {
  return text ? `${label}  ${text}` : `${label}  (none)`;
}

/**
 * Human-readable layout report. Stable, compact, and meant to be read by an agent.
 */
export function formatLayoutReport({ printed, pages, issues, settings, design, title, look }) {
  const paper = `${settings.paperSize} ${settings.orientation}`;
  const theme = settings.theme;
  const font = design?.font?.name || look?.bodyFont || 'body';
  const headingFont = design?.headingFont?.name || look?.headingFont || font;
  const size = design?.fontSize?.label || look?.bodySize || '';
  const margins = settings.margins;
  const usableW = (design?.pageWidth || 0) - 2 * (design?.margins?.x || 0);
  const usableH = (design?.pageHeight || 0)
    - 2 * (design?.margins?.y || 0)
    - (design?.hasRunningHeader ? 30 : 0)
    - (design?.hasRunningFooter ? 30 : 0);

  const lines = [];
  lines.push(`LAYOUT REPORT — ${printed.pageCount} page${printed.pageCount === 1 ? '' : 's'} · ${paper} · theme ${theme}`);
  lines.push(`Type  ${size} ${font}${headingFont !== font ? ` / headings ${headingFont}` : ''} · margins ${margins} · usable ${Math.round(usableW)}×${Math.round(usableH)} px`);
  const lookBits = [
    look?.pageBackground && `page ${look.pageBackground}`,
    look?.text && `text ${look.text}`,
    look?.headingColor && `headings ${look.headingColor}${look.h1Size ? ` (H1 ${look.h1Size}` : ''}${look.h2Size ? `, H2 ${look.h2Size}` : ''}${look.h1Size ? ')' : ''}`,
    look?.h2Rule ? 'H2 has a bottom rule' : '',
    settings.accentColor && `accent ${settings.accentColor}`,
    settings.background && settings.background !== 'none' && `background ${settings.background}`,
    settings.justify && 'justified',
  ].filter(Boolean);
  if (lookBits.length) lines.push(`Look  ${lookBits.join(' · ')}`);

  const headerDesc = [
    settings.header?.text?.trim() && `"${settings.header.text.trim()}"`,
    settings.header?.showDate && 'date',
    settings.logo?.position === 'page-header' && 'logo',
  ].filter(Boolean);
  const footerDesc = [
    settings.footer?.text?.trim() && `"${settings.footer.text.trim()}"`,
    settings.footer?.pageNumbers && (settings.footer.pageNumberStyle === 'n' ? 'page n' : 'page n / N'),
  ].filter(Boolean);
  lines.push(`Chrome  header: ${headerDesc.length ? headerDesc.join(', ') : '(none)'} · footer: ${footerDesc.length ? footerDesc.join(', ') : '(none)'}`);
  lines.push('');

  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');
  lines.push(`ISSUES  ${warnings.length} warning${warnings.length === 1 ? '' : 's'}, ${infos.length} note${infos.length === 1 ? '' : 's'}`);
  if (!issues.length) {
    lines.push('  (none — page breaks look reasonable)');
  } else {
    for (const issue of issues) {
      lines.push(`  [${issue.severity === 'warning' ? 'warn' : 'info'}] ${issue.message}`);
    }
  }
  lines.push('');

  lines.push('BREAKS');
  if (pages.length <= 1) {
    lines.push('  (single page — no breaks)');
  } else {
    for (let i = 1; i < pages.length; i++) {
      const prev = pages[i - 1];
      const page = pages[i];
        const first = [...page.blocks].sort((a, b) => (a.yPct ?? 0) - (b.yPct ?? 0))[0];
        const lastPrev = [...prev.blocks].sort((a, b) => (a.yPct ?? 0) - (b.yPct ?? 0)).at(-1);
      const why = inferBreak(prev, page, first);
      const from = lastPrev ? `${(KIND_LABEL[lastPrev.kind] || lastPrev.kind)} ${lastPrev.text ? `"${lastPrev.text.slice(0, 48)}"` : ''}`.trim() : 'end of content';
      const to = first ? `${(KIND_LABEL[first.kind] || first.kind)} ${first.text ? `"${first.text.slice(0, 48)}"` : ''}`.trim() : 'next page';
      const line = `p.${prev.number} → p.${page.number}  ${why || 'break'} · after ${from} · next ${to}`;
      lines.push(`  ${line.replace(/\s+/g, ' ').trim()}`);
    }
  }
  lines.push('');

  for (const page of pages) {
    const role = page.role ? ` · ${page.role}` : '';
    const fill = Number.isFinite(page.usedPct) ? `${Math.round(page.usedPct)}% full` : '';
    lines.push(`PAGE ${page.number}/${printed.pageCount}${role} · ${fill}`.replace(/\s+·\s+$/, ''));
    lines.push(`  ${formatChrome('HEADER', page.header)}`);
    const ordered = [...page.blocks].sort((a, b) => (a.yPct ?? 1e9) - (b.yPct ?? 1e9) || 0);
    if (!ordered.length && page.body?.length) {
      for (const line of page.body) {
        lines.push(`  ${padPct(line.yPct)}%  TEXT    "${line.text}"`);
      }
    }
    for (const block of ordered) {
      const { label, summary, extra } = describeBlock(block);
      const y = block.yPct == null ? '  ·' : `${padPct(block.yPct)}%`;
      lines.push(`  ${y}  ${label.padEnd(7)} ${summary}`.trimEnd());
      const look = describeLook(block);
      const detail = [extra && extra !== summary ? extra : '', look && extra !== look ? look : !extra ? look : '']
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(' · ');
      if (detail) lines.push(`           ${clipLine(detail, 118)}`);
    }
    if (!page.blocks.length && !page.body?.length) {
      lines.push('  (empty)');
    }
    lines.push(`  ${formatChrome('FOOTER', page.footer)}`);
    lines.push('');
  }

  lines.push('How to use this report: fix warnings with \\pagebreak / {: .newpage } before the stranded heading, or by shortening the previous section. Do not screenshot the PDF unless a logo, diagram or colour is still unclear.');
  return lines.join('\n').trim() + '\n';
}

function clipLine(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * @param {{ printed: object, dom: object, settings: object, design: object, title: string }} input
 */
export function buildLayoutReport({ printed, dom, settings, design, title }) {
  const pages = assignBlocksToPages(dom, printed);
  const issues = detectLayoutIssues(pages, { title, settings, overflow: dom.overflow || [] });
  const text = formatLayoutReport({
    printed,
    pages,
    issues,
    settings,
    design,
    title,
    look: dom.look,
  });
  return {
    pageCount: printed.pageCount,
    pages: pages.map((p) => ({
      number: p.number,
      role: p.role,
      usedPct: p.usedPct,
      header: p.header,
      footer: p.footer,
      blocks: p.blocks.map((b) => ({
        kind: b.kind,
        id: b.id,
        text: b.text,
        yPct: b.yPct,
        split: b.split,
        flags: b.flags,
        look: b.look,
        table: b.table && { cols: b.table.cols, rows: b.table.rows, hasHeader: b.table.hasHeader, header: b.table.header },
        callout: b.callout,
        code: b.code,
        list: b.list && { items: b.list.items },
        cover: b.cover && { title: b.cover.title, kicker: b.cover.kicker, subtitle: b.cover.subtitle, hasLogo: b.cover.hasLogo },
      })),
    })),
    issues,
    look: dom.look,
    text,
  };
}
