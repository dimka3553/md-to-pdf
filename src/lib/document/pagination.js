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

  // Keep compact tables intact; long tables retain native row fragmentation and headers.
  doc.querySelectorAll('.table-wrap').forEach((el) => {
    if (height(el) <= pageHeight * 0.4) el.classList.add('keep-block');
  });

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
