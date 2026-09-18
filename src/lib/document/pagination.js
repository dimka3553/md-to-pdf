/** Runs in the document after fonts/images settle. Keep this function self-contained. */
export function preparePagination(doc, pageHeight, pageBreaks = 'auto') {
  const ends = new Map();
  const heading = (el) => el && el.matches('h1,h2,h3,h4,h5,h6,.title-block');
  const height = (el) => el.getBoundingClientRect().height;
  const span = (start, end) => end.getBoundingClientRect().bottom - start.getBoundingClientRect().top;
  const shortParagraph = (el) => el?.tagName === 'P'
    && height(el) <= (parseFloat(getComputedStyle(el).lineHeight) || 20) * 3.1;

  doc.querySelectorAll('.keep-next, .keep-block, .manual-page-start, .heading-page-start')
    .forEach((el) => el.classList.remove('keep-next', 'keep-block', 'manual-page-start', 'heading-page-start'));

  // Empty boundary markers should not manufacture leading/trailing blank pages.
  const blocks = Array.from(doc.children).filter((el) => !el.matches('.page-gap, .page-guide'));
  let hasContent = false;
  let pendingBreak = null;
  for (const el of blocks) {
    if (el.matches('.page-break')) {
      el.hidden = true;
      if (hasContent) pendingBreak = el;
    } else {
      // Break on the content, so heading mode + marker coalesce at one boundary.
      if (pendingBreak) {
        pendingBreak.hidden = false;
        el.classList.add('manual-page-start');
        pendingBreak = null;
      }
      hasContent = true;
    }
  }
  const firstContent = blocks.find((el) => !el.matches('.page-break'));

  for (const start of doc.children) {
    if (!heading(start)) continue;
    const divider = start.previousElementSibling?.tagName === 'HR' ? start.previousElementSibling : null;
    if ((pageBreaks === 'h2' && start.matches('h1,h2,.title-block'))
        || (pageBreaks === 'h1' && start.matches('h1,.title-block'))) {
      const target = divider || start;
      if (firstContent !== target) target.classList.add('heading-page-start');
    }
    let end = start;
    while (heading(end.nextElementSibling)) end = end.nextElementSibling;
    // At most two short introductory paragraphs belong to the section opening.
    for (let i = 0; i < 2 && shortParagraph(end.nextElementSibling); i++) {
      const next = end.nextElementSibling;
      if (span(start, next) > pageHeight * 0.25) break;
      end = next;
    }
    const content = end.nextElementSibling;
    let requiredEnd = end;
    if (content?.matches('.table-wrap, figure, .code-block, blockquote, .markdown-alert, ul, ol')
        && span(start, content) <= pageHeight * 0.5) {
      content.classList.add('keep-block');
      requiredEnd = content;
    } else if (content?.matches('.table-wrap')) {
      const rows = content.querySelectorAll('tbody > tr');
      const firstRows = rows[Math.min(1, rows.length - 1)];
      // Require a header and two body rows, but allow exceptionally tall rows to flow.
      if (firstRows && span(start, firstRows) <= pageHeight * 0.5) {
        requiredEnd = firstRows;
        content.querySelector('thead')?.classList.add('keep-next');
        if (rows.length > 1) rows[0].classList.add('keep-next');
      }
    }

    // Don't bind an unbounded run of prose (or cross an explicit page break).
    for (let el = start; el && el !== end; el = el.nextElementSibling) el.classList.add('keep-next');
    if (requiredEnd !== end) end.classList.add('keep-next');
    ends.set(start, requiredEnd);
    // A section divider travels with its heading instead of stranding at the page foot.
    if (divider) {
      divider.classList.add('keep-next');
      ends.set(divider, requiredEnd);
    }
  }
  return ends;
}

/** Preview only: break an overflowing block so the next piece can start on a real page. */
export function splitOverflowingBlock(el, limit, docTop) {
  if (!el) return null;

  function mark(source, cont) {
    cont.removeAttribute('data-pg-split');
    cont.setAttribute('data-pg-cont', '1');
    cont.style.marginTop = '0px';
    source.setAttribute('data-pg-split', '1');
    source.style.marginBottom = '0px';
    if (source.parentNode) source.parentNode.insertBefore(cont, source.nextSibling);
    return cont;
  }

  function splitTable(wrap) {
    if (!wrap.classList || !wrap.classList.contains('table-wrap')) return null;
    const table = wrap.querySelector('table');
    const tbody = table && table.querySelector('tbody');
    if (!tbody || !tbody.rows.length) return null;
    const rows = Array.from(tbody.rows);
    let splitAt = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].getBoundingClientRect().bottom - docTop > limit + 0.5) { splitAt = i; break; }
    }
    if (splitAt < 1) return null;
    const cont = wrap.cloneNode(false);
    const newTable = table.cloneNode(false);
    const thead = table.querySelector('thead');
    if (thead) newTable.appendChild(thead.cloneNode(true));
    const newBody = tbody.cloneNode(false);
    for (let j = splitAt; j < rows.length; j++) newBody.appendChild(rows[j]);
    newTable.appendChild(newBody);
    cont.appendChild(newTable);
    return mark(wrap, cont);
  }

  function splitList(list) {
    if (list.tagName !== 'UL' && list.tagName !== 'OL') return null;
    const items = Array.from(list.children).filter((n) => n.tagName === 'LI');
    let splitAt = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].getBoundingClientRect().bottom - docTop > limit + 0.5) { splitAt = i; break; }
    }
    if (splitAt < 1) return null;
    const cont = list.cloneNode(false);
    if (list.tagName === 'OL') {
      const start = parseInt(list.getAttribute('start') || '1', 10);
      cont.setAttribute('start', String(start + splitAt));
    }
    for (let j = splitAt; j < items.length; j++) cont.appendChild(items[j]);
    return mark(list, cont);
  }

  function splitClip(node) {
    if (node.classList.contains('cover') || node.classList.contains('toc-page')) return null;
    const r = node.getBoundingClientRect();
    const top = r.top - docTop;
    const keep = limit - top;
    if (keep < 20 || keep >= r.height - 2) return null;
    const skip = parseFloat(node.getAttribute('data-pg-skip') || '0') || 0;
    const full = parseFloat(node.getAttribute('data-pg-full') || '0') || (skip + r.height);
    const newSkip = skip + keep;
    const remain = full - newSkip;
    if (remain < 2) return null;
    const cont = node.cloneNode(true);
    node.style.maxHeight = keep + 'px';
    node.style.overflow = 'hidden';
    node.setAttribute('data-pg-split', '1');
    node.style.marginBottom = '0px';
    cont.setAttribute('data-pg-cont', '1');
    cont.setAttribute('data-pg-clip', '1');
    cont.setAttribute('data-pg-skip', String(newSkip));
    cont.setAttribute('data-pg-full', String(full));
    cont.style.marginTop = '0px';
    cont.style.maxHeight = remain + 'px';
    cont.style.overflow = 'hidden';
    let shifter = cont.querySelector('[data-pg-shift]');
    if (!shifter) {
      shifter = node.ownerDocument.createElement('div');
      shifter.setAttribute('data-pg-shift', '1');
      while (cont.firstChild) shifter.appendChild(cont.firstChild);
      cont.appendChild(shifter);
    }
    shifter.style.marginTop = (-newSkip) + 'px';
    if (node.parentNode) node.parentNode.insertBefore(cont, node.nextSibling);
    return cont;
  }

  if (el.classList.contains('table-wrap')) return splitTable(el) || splitClip(el);
  if (el.tagName === 'UL' || el.tagName === 'OL') return splitList(el) || splitClip(el);
  return splitClip(el);
}

/** Restore blocks that preview pagination split across simulated pages. */
export function mergeSplitBlocks(root) {
  function prevFlow(el) {
    let prev = el.previousElementSibling;
    while (prev && (prev.classList.contains('page-gap') || prev.classList.contains('page-guide'))) {
      prev = prev.previousElementSibling;
    }
    return prev;
  }
  Array.from(root.querySelectorAll('[data-pg-clip]')).forEach((n) => n.remove());
  Array.from(root.querySelectorAll('[data-pg-split]')).forEach((el) => {
    el.style.maxHeight = '';
    el.style.overflow = '';
    el.style.marginBottom = '';
    el.removeAttribute('data-pg-split');
    el.removeAttribute('data-pg-skip');
    el.removeAttribute('data-pg-full');
  });
  Array.from(root.querySelectorAll('.table-wrap[data-pg-cont]')).forEach((cont) => {
    const prev = prevFlow(cont);
    const dest = prev && prev.classList.contains('table-wrap') ? prev.querySelector('tbody') : null;
    const src = cont.querySelector('tbody');
    if (dest && src) while (src.firstChild) dest.appendChild(src.firstChild);
    if (prev && prev.classList.contains('table-wrap')) prev.style.marginBottom = '';
    cont.remove();
  });
  Array.from(root.querySelectorAll('ul[data-pg-cont], ol[data-pg-cont]')).forEach((cont) => {
    const prev = prevFlow(cont);
    if (prev && prev.tagName === cont.tagName) {
      while (cont.firstChild) prev.appendChild(cont.firstChild);
      prev.style.marginBottom = '';
    }
    cont.remove();
  });
}

