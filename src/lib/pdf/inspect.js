/**
 * Snapshot every rendered block (kind, text, colours, size) from the live
 * Chromium document. Positions on the printed page come from the PDF itself;
 * this pass answers "what is this and how does it look?".
 *
 * The function is self-contained so Puppeteer can serialize it into page.evaluate.
 */

export function collectDomSnapshot() {
  function rgbToHex(color) {
    const m = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (!m) return '';
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (a < 0.06) return '';
    const mix = (c) => Math.round(Number(c) * a + 255 * (1 - a));
    const hex = [mix(m[1]), mix(m[2]), mix(m[3])].map((n) => n.toString(16).padStart(2, '0')).join('');
    return `#${hex.toUpperCase()}`;
  }

  function clip(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  function kindOf(el) {
    if (el.classList.contains('footnotes')) return 'footnotes';
    if (el.classList.contains('cover')) return 'cover';
    if (el.classList.contains('toc')) return 'toc';
    if (el.classList.contains('title-block')) return 'title';
    if (el.classList.contains('logo-above')) return 'logo';
    if (el.classList.contains('table-wrap')) return 'table';
    if (el.classList.contains('code-block')) return 'code';
    if (el.classList.contains('markdown-alert')) return 'callout';
    if (el.classList.contains('page-break')) return 'break';
    if (el.tagName === 'FIGURE') return el.classList.contains('diagram') ? 'diagram' : 'figure';
    if (el.tagName === 'BLOCKQUOTE') return 'quote';
    if (el.tagName === 'UL') return el.querySelector('.task-item') ? 'tasks' : 'ul';
    if (el.tagName === 'OL') return 'ol';
    if (el.tagName === 'HR') return 'hr';
    if (el.tagName === 'P') return 'p';
    if (/^H[1-6]$/.test(el.tagName)) return el.tagName.toLowerCase();
    return el.tagName.toLowerCase();
  }

  function calloutType(el) {
    const m = [...el.classList].find((c) => c.startsWith('markdown-alert-') && c !== 'markdown-alert-title');
    return m ? m.replace('markdown-alert-', '') : 'note';
  }

  function lookOf(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const lh = parseFloat(cs.lineHeight);
    const lineHeight = Number.isFinite(lh) && lh > 0 ? lh : parseFloat(cs.fontSize) * 1.6 || 16;
    const lines = r.height > 0 ? Math.max(1, Math.round(r.height / lineHeight)) : 0;
    const parent = el.parentElement && el.parentElement.getBoundingClientRect();
    const widthPct = parent && parent.width ? Math.round((r.width / parent.width) * 100) : 100;
    const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
    const overflowX = el.scrollWidth - el.clientWidth > 2;
    const bg = rgbToHex(cs.backgroundColor);
    return {
      fontSize: `${Math.round(parseFloat(cs.fontSize) * 10) / 10}px`,
      fontWeight: String(cs.fontWeight),
      fontFamily: (cs.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim(),
      color: rgbToHex(cs.color) || cs.color,
      background: bg === '#000000' && /^rgba?\(0,\s*0,\s*0,\s*0/.test(cs.backgroundColor) ? '' : bg,
      borderBottom: borderBottom >= 1 ? `${Math.round(borderBottom)}px ${rgbToHex(cs.borderBottomColor) || cs.borderBottomColor}` : '',
      borderLeft: (parseFloat(cs.borderLeftWidth) || 0) >= 3 ? `${Math.round(parseFloat(cs.borderLeftWidth))}px ${rgbToHex(cs.borderLeftColor)}` : '',
      lines,
      height: Math.round(r.height),
      width: Math.round(r.width),
      widthPct,
      overflowX,
      align: cs.textAlign === 'justify' ? 'justify' : cs.textAlign === 'center' ? 'center' : 'left',
    };
  }

  function tableInfo(wrap) {
    const table = wrap.querySelector('table');
    if (!table) return { cols: 0, rows: 0, hasHeader: false, header: [], rowsPreview: [], rowNeedles: [] };
    const cols = parseInt(table.getAttribute('data-cols') || '0', 10)
      || table.querySelectorAll('thead th, tr:first-child td').length;
    const hasHeader = !table.classList.contains('no-header') && !!table.querySelector('thead');
    const header = hasHeader ? [...table.querySelectorAll('thead th')].map((th) => clip(th.innerText, 40)) : [];
    const rows = [...table.querySelectorAll('tbody tr')];
    const rowsPreview = rows.slice(0, 8).map((tr) => [...tr.children].map((td) => clip(td.innerText, 36)));
    const rowNeedles = rows.map((tr) => clip(tr.innerText, 80));
    const th = table.querySelector('th');
    const headerLook = th ? lookOf(th) : null;
    return {
      cols,
      rows: rows.length,
      hasHeader,
      header,
      rowsPreview,
      rowNeedles,
      headerColor: headerLook ? headerLook.color : '',
      headerBackground: headerLook ? headerLook.background : '',
    };
  }

  function listInfo(el) {
    const items = [...el.children].filter((n) => n.tagName === 'LI');
    return {
      items: items.length,
      preview: items.slice(0, 8).map((li) => clip(li.innerText, 80)),
      start: el.tagName === 'OL' ? parseInt(el.getAttribute('start') || '1', 10) : undefined,
    };
  }

  function imageInfo(el) {
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return {
      alt: clip(img.getAttribute('alt') || '', 80),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  const root = document.querySelector('.doc');
  const blocks = [];
  const overflow = [];
  if (!root) return { blocks, look: {}, overflow };

  const bodyCs = getComputedStyle(document.body);
  const h1 = document.querySelector('h1, .cover-title');
  const h2 = document.querySelector('h2');
  const look = {
    pageBackground: rgbToHex(bodyCs.backgroundColor),
    text: rgbToHex(bodyCs.color),
    bodyFont: (bodyCs.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim(),
    bodySize: `${Math.round(parseFloat(bodyCs.fontSize) * 10) / 10}px`,
    headingColor: h1 ? rgbToHex(getComputedStyle(h1).color) : '',
    headingFont: h1 ? (getComputedStyle(h1).fontFamily || '').split(',')[0].replace(/['"]/g, '').trim() : '',
    h1Size: h1 ? `${Math.round(parseFloat(getComputedStyle(h1).fontSize) * 10) / 10}px` : '',
    h2Size: h2 ? `${Math.round(parseFloat(getComputedStyle(h2).fontSize) * 10) / 10}px` : '',
    h2Rule: !!(h2 && (parseFloat(getComputedStyle(h2).borderBottomWidth) || 0) >= 1),
  };

  for (const el of root.children) {
    if (el.hidden || el.classList.contains('page-gap') || el.classList.contains('page-guide')) continue;
    const kind = kindOf(el);
    if (kind === 'break') continue;
    const text = clip(el.innerText, 220);
    const appearance = lookOf(el);
    if (appearance.overflowX) overflow.push(clip(text, 60) || kind);
    const block = {
      kind,
      id: el.id || '',
      text,
      look: appearance,
      flags: {
        headingPageStart: el.classList.contains('heading-page-start'),
        manualPageStart: el.classList.contains('manual-page-start'),
        keepBlock: el.classList.contains('keep-block'),
        keepNext: el.classList.contains('keep-next'),
      },
    };

    if (kind === 'cover') {
      const title = el.querySelector('.cover-title');
      const kicker = el.querySelector('.cover-kicker');
      const subtitle = el.querySelector('.cover-subtitle');
      block.cover = {
        title: clip(title ? title.innerText : '', 120),
        kicker: clip(kicker ? kicker.innerText : '', 120),
        subtitle: clip(subtitle ? subtitle.innerText : '', 160),
        hasLogo: !!el.querySelector('.cover-logo'),
        titleLook: title ? lookOf(title) : null,
      };
    } else if (kind === 'toc') {
      const items = [...el.querySelectorAll('li')];
      block.toc = {
        entries: items.length,
        preview: items.slice(0, 12).map((li) => clip(li.innerText, 80)),
      };
    } else if (kind === 'table') {
      block.table = tableInfo(el);
    } else if (kind === 'ul' || kind === 'ol' || kind === 'tasks') {
      block.list = listInfo(el);
    } else if (kind === 'code') {
      const code = el.querySelector('code');
      block.code = {
        title: clip(el.querySelector('.code-title') ? el.querySelector('.code-title').innerText : '', 80),
        lines: parseInt(el.getAttribute('data-lines') || '0', 10) || appearance.lines,
        lang: (code && code.className.match(/language-([\w-]+)/) || [])[1] || '',
      };
    } else if (kind === 'callout') {
      block.callout = { type: calloutType(el) };
    } else if (kind === 'footnotes') {
      const items = [...el.querySelectorAll('li')];
      block.footnotes = {
        entries: items.length,
        preview: items.slice(0, 8).map((li) => clip(li.innerText, 80)),
      };
    } else if (kind === 'figure' || kind === 'diagram' || kind === 'logo' || kind === 'title') {
      block.image = imageInfo(el);
      if (kind === 'figure' || kind === 'diagram') {
        const cap = el.querySelector('figcaption');
        block.caption = clip(cap ? cap.innerText : '', 120);
      }
    }

    blocks.push(block);
  }

  return { blocks, look, overflow };
}
