import { CODE_FONT, LOGO_SIZES, normalizeSettings, resolveDesign } from './settings.js';
import { markdownToHtml, extractHeadings } from './markdown.js';
import { buildStyles } from './styles.js';
import { escapeHtml, formatDate, inferTitle } from './utils.js';

const MERMAID_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

/**
 * Build a complete, self-contained HTML document from markdown + design settings.
 *
 * `mode` is 'preview' for the in-app iframe (adds a paper sheet, simulated
 * running header/footer and page guides) or 'pdf' for Puppeteer (real page
 * breaks, running header/footer handled by the PDF engine).
 *
 * @param {{ markdown: string, settings?: object, assets?: Record<string,string>, mode?: 'preview'|'pdf', title?: string }} input
 */
export function buildDocumentHtml({ markdown, settings: rawSettings, assets = {}, mode = 'pdf', title }) {
  const settings = normalizeSettings(rawSettings);
  const design = resolveDesign(settings);
  const t = design.theme;
  const isPreview = mode === 'preview';
  // The first H1 wins; `title` (usually the file name) is only a fallback so preview and PDF agree.
  const docTitle = inferTitle(markdown, title || 'Document');

  let body = markdownToHtml(markdown, { assets, headingNumbers: settings.headingNumbers });

  // ---- Logo placement around the first heading -------------------------------------------
  const logo = settings.logo;
  const logoPx = logo ? LOGO_SIZES[logo.size].px : 0;
  const logoImg = (cls, h) => (logo ? `<img class="${cls}" src="${logo.dataUrl}" alt="" style="height:${h}px">` : '');
  // Cover already has its own title (and optional logo). Don't also pin a logo to the in-body H1.
  const placeTitleLogo = logo && !settings.cover.enabled;

  if (placeTitleLogo && logo.position === 'title-right') {
    let replaced = false;
    body = body.replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/, (m, attrs, inner) => {
      replaced = true;
      return `<div class="title-block"><h1${attrs}>${inner}</h1>${logoImg('title-logo', logoPx)}</div>`;
    });
    if (!replaced) body = `<div class="title-block"><h1>${escapeHtml(docTitle)}</h1>${logoImg('title-logo', logoPx)}</div>${body}`;
  } else if (placeTitleLogo && logo.position === 'title-above') {
    body = logoImg('logo-above', logoPx) + body;
  }

  if (settings.cover.enabled) body = stripLeadingTitle(body);

  // ---- Table of contents -----------------------------------------------------------------
  if (settings.toc) {
    const headings = extractHeadings(body, 3);
    // Skip the document title (first h1) when it is the only h1.
    const h1Count = headings.filter((h) => h.depth === 1).length;
    const items = headings.filter((h) => !(h1Count === 1 && h.depth === 1));
    if (items.length) {
      // After a cover page the TOC gets its own page; otherwise it follows the title.
      const standalone = settings.cover.enabled;
      const toc = `<nav class="toc${standalone ? ' toc-page' : ''}"><p class="toc-title">Contents</p><ol>${items
        .map((h) => `<li class="d${h.depth}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`)
        .join('')}</ol></nav>${standalone && isPreview ? '<div class="page-break"></div>' : ''}`;
      body = standalone ? toc + body : insertAfterTitle(body, toc);
    }
  }

  // ---- Cover page ------------------------------------------------------------------------
  let cover = '';
  if (settings.cover.enabled) {
    const c = settings.cover;
    const coverTitle = c.title || docTitle;
    cover = `<section class="cover">
      ${logo && c.showLogo ? `<img class="cover-logo" src="${logo.dataUrl}" alt="">` : ''}
      ${c.author || c.date ? `<div class="cover-kicker">${escapeHtml([c.author, c.date].filter(Boolean).join(' · '))}</div>` : ''}
      <h1 class="cover-title">${escapeHtml(coverTitle)}</h1>
      ${c.subtitle ? `<p class="cover-subtitle">${escapeHtml(c.subtitle)}</p>` : ''}
      <div class="cover-rule"></div>
    </section>${isPreview ? '<div class="page-break"></div>' : ''}`;
  }

  const needsMermaid = body.includes('class="mermaid"');
  const fonts = fontLink(design);
  const styles = buildStyles(design, settings, mode) + (isPreview ? '' : buildPageCss(settings, design, docTitle));

  const running = runningParts(settings, design, docTitle);
  const previewRunning = isPreview
    ? `${design.hasRunningHeader ? `<div class="running top">${running.headerLeft}${running.headerRight}</div>` : ''}
       ${design.hasRunningFooter ? `<div class="running bottom">${running.footerLeft}${running.footerRight}</div>` : ''}`
    : '';

  const watermark = logo && logo.position === 'watermark' ? `<div class="watermark"><img src="${logo.dataUrl}" alt=""></div>` : '';

  return `<!DOCTYPE html>
<html lang="en" data-md2pdf="1"${t.dark ? ' data-dark' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(docTitle)}</title>
${fonts}
<style>${styles}</style>
${needsMermaid ? `<script src="${MERMAID_SRC}"></script>` : ''}
</head>
<body>
<div class="sheet">
  <div class="page-bg"></div>
  ${watermark}
  ${previewRunning}
  <div class="sheet-inner">
    <main class="doc">
      ${cover}
      ${body}
    </main>
  </div>
</div>
<script>
(function () {
  var dark = ${t.dark ? 'true' : 'false'};
  var pageH = ${design.pageHeight}, preview = ${isPreview ? 'true' : 'false'};
  var padTop = ${design.margins.y + (design.hasRunningHeader ? 30 : 0)}, padBottom = ${design.margins.y + (design.hasRunningFooter ? 30 : 0)};
  function whenImages() {
    var imgs = Array.prototype.slice.call(document.images);
    return Promise.all(imgs.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (res) { img.addEventListener('load', res); img.addEventListener('error', res); });
    }));
  }
  function whenMermaid() {
    if (!window.mermaid) return Promise.resolve();
    try {
      window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', fontFamily: getComputedStyle(document.body).fontFamily });
      return window.mermaid.run({ querySelector: '.mermaid' }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  var GUTTER = 28, runningOffset = ${Math.round(design.margins.y * 0.55)};
  var perPage = pageH - padTop - padBottom;
  var pageBreaks = ${JSON.stringify(settings.pageBreaks)};
  var doc = document.querySelector('.doc');

  function cleanupPagination() {
    Array.prototype.forEach.call(doc.querySelectorAll('.page-gap, .page-guide'), function (n) { n.remove(); });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-pg-mt]'), function (n) { n.style.marginTop = ''; n.removeAttribute('data-pg-mt'); });
    doc.style.paddingBottom = '';
  }
  function keepTogether(el, h) {
    if (h > perPage * 0.9) return false;
    if (el.classList.contains('cover') || el.classList.contains('toc-page')) return false;
    if (/^H[1-6]$/.test(el.tagName) || el.classList.contains('title-block')) return true;
    if (el.matches('figure, blockquote, .markdown-alert, hr, .logo-above')) return true;
    if (el.classList.contains('code-block')) return (parseInt(el.getAttribute('data-lines'), 10) || 99) <= 28;
    if (el.tagName === 'P') { var lh = parseFloat(getComputedStyle(el).lineHeight) || 20; return h <= lh * 5.5; }
    return false;
  }
  function cloneRunning(sel, gap, top, pageNo) {
    var src = document.querySelector(sel);
    if (!src) return;
    var c = src.cloneNode(true);
    c.style.top = top + 'px'; c.style.bottom = 'auto';
    var n = c.querySelector('.pageNumber'); if (n) n.textContent = pageNo;
    gap.appendChild(c);
  }
  function paginate() {
    if (!preview) return 1;
    cleanupPagination();
    var pageTop = 0, limit = perPage, pageNo = 1, forceBreak = false;
    var docTop = function () { return doc.getBoundingClientRect().top; };
    var guard = 0;
    for (var i = 0; i < doc.children.length && guard++ < 5000; i++) {
      var el = doc.children[i];
      if (el.classList.contains('page-gap') || el.classList.contains('page-guide')) continue;
      if (el.classList.contains('page-break')) { forceBreak = true; continue; }
      var base = docTop(), r = el.getBoundingClientRect();
      var top = r.top - base, bottom = r.bottom - base, h = bottom - top;
      var headingBreak = pageBreaks === 'h2'
        ? (el.tagName === 'H1' || el.tagName === 'H2' || el.classList.contains('title-block'))
        : pageBreaks === 'h1'
          ? (el.tagName === 'H1' || el.classList.contains('title-block'))
          : false;
      var startsNewPage = forceBreak || top >= limit - 0.5 || (headingBreak && top > pageTop + 1);

      if (!startsNewPage && bottom > limit + 0.5 && keepTogether(el, h) && top > pageTop + 1) startsNewPage = true;

      // Headings stay with the block that follows them.
      if (!startsNewPage && (/^H[1-6]$/.test(el.tagName) || el.classList.contains('title-block')) && top > pageTop + 1) {
        var next = el.nextElementSibling;
        if (next && !next.classList.contains('page-break')) {
          var nr = next.getBoundingClientRect();
          var need = Math.min(nr.bottom - nr.top, 56);
          if (nr.top - base + need > limit + 0.5) startsNewPage = true;
        }
      }

      if (startsNewPage) {
        var gap = document.createElement('div');
        gap.className = 'page-gap' + (forceBreak ? ' manual' : '');
        forceBreak = false;
        doc.insertBefore(gap, el);
        el.style.marginTop = '0px'; el.setAttribute('data-pg-mt', '1');
        var gapTop = gap.getBoundingClientRect().top - docTop();
        var fill = Math.max(0, limit - gapTop);
        gap.style.height = (fill + padBottom + GUTTER + padTop) + 'px';
        gap.style.setProperty('--fill', fill + 'px');
        var bandH = (document.querySelector('.running') || { offsetHeight: 12 }).offsetHeight || 12;
        cloneRunning('.running.bottom', gap, fill + padBottom - runningOffset - bandH, pageNo);
        pageNo++;
        cloneRunning('.running.top', gap, fill + padBottom + GUTTER + runningOffset, pageNo);
        pageTop = limit + padBottom + GUTTER + padTop;
        limit = pageTop + perPage;
        i--; // re-evaluate this block on the new page
        continue;
      }

      if (el.classList.contains('cover') || el.classList.contains('toc-page')) forceBreak = true;

      // Block flows across page boundaries (long list / table / code): mark each split point.
      while (bottom > limit + 0.5) {
        var g = document.createElement('div');
        g.className = 'page-guide';
        g.style.top = limit + 'px';
        g.setAttribute('data-label', 'page ' + (pageNo + 1));
        doc.appendChild(g);
        pageNo++;
        pageTop = limit; limit += perPage;
      }
    }
    // Pad the last page to full height.
    var last = doc.lastElementChild;
    var lastBottom = last ? last.getBoundingClientRect().bottom - docTop() : 0;
    var guides = doc.querySelectorAll('.page-guide');
    if (guides.length) lastBottom = Math.max(lastBottom, parseFloat(guides[guides.length - 1].style.top));
    doc.style.paddingBottom = Math.max(0, limit - lastBottom) + 'px';
    Array.prototype.forEach.call(document.querySelectorAll('.totalPages'), function (n) { n.textContent = pageNo; });
    return pageNo;
  }
  var layoutGuides = paginate;
  var resizeTimer = null;
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () {
    var pages = paginate();
    if (window.parent !== window) window.parent.postMessage({ type: 'md2pdf:preview-pages', pages: pages }, '*');
  }, 120); }
  function done() {
    var pages = layoutGuides();
    document.documentElement.setAttribute('data-ready', '1');
    if (preview && window.parent !== window) {
      window.parent.postMessage({ type: 'md2pdf:preview-ready', pages: pages }, '*');
    }
  }
  var ready = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());
  Promise.all([ready, whenImages(), whenMermaid()]).then(done, done);
  if (preview) {
    window.addEventListener('resize', onResize);
    var scrollTimer = null;
    window.addEventListener('scroll', function () {
      if (scrollTimer) return;
      scrollTimer = setTimeout(function () {
        scrollTimer = null;
        if (window.parent !== window) window.parent.postMessage({ type: 'md2pdf:preview-scroll', y: window.scrollY }, '*');
      }, 80);
    }, { passive: true });
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'md2pdf:scroll-to') window.scrollTo(0, e.data.y || 0);
    });
  }
})();
</script>
</body>
</html>`;
}

/** Remove the leading document title so a cover page can own it. */
function stripLeadingTitle(body) {
  let html = body.replace(/^\s*<img class="logo-above"[^>]*>\s*/, '');
  const titleBlock = html.match(/^\s*<div class="title-block">[\s\S]*?<\/div>\s*/);
  if (titleBlock) return html.slice(titleBlock[0].length);
  const h1 = html.match(/^\s*<h1\b[\s\S]*?<\/h1>\s*/);
  if (h1) return html.slice(h1[0].length);
  return html;
}

/** Place HTML after the title row (logo + h1), never inside the title flex box. */
function insertAfterTitle(body, html) {
  const titleBlock = body.match(/<div class="title-block">[\s\S]*?<\/div>\n?/);
  if (titleBlock && titleBlock.index !== undefined && !body.slice(0, titleBlock.index).includes('<h1')) {
    const cut = titleBlock.index + titleBlock[0].length;
    return body.slice(0, cut) + html + body.slice(cut);
  }
  const h1 = body.match(/<h1\b[\s\S]*?<\/h1>\n?/);
  if (h1 && h1.index !== undefined) {
    const cut = h1.index + h1[0].length;
    return body.slice(0, cut) + html + body.slice(cut);
  }
  return html + body;
}

function fontLink(design) {
  const families = new Set([design.font.google, design.headingFont.google, CODE_FONT.google]);
  const query = Array.from(families).map((f) => `family=${f}`).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${query}&display=swap">`;
}

/**
 * Text content of the running header/footer, shared by the preview bands and
 * the PDF's CSS `@page` margin boxes.
 */
function runningContent(settings, docTitle) {
  // Margin boxes use the page font, which has no emoji glyphs; strip pictographs from the title.
  const plainTitle = docTitle.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim() || docTitle;
  return {
    headerText: settings.header.text.replace(/\{title\}/gi, plainTitle).trim(),
    dateText: settings.header.showDate ? formatDate() : '',
    footerText: settings.footer.text.replace(/\{title\}/gi, plainTitle),
    pageNumbers: settings.footer.pageNumbers ? settings.footer.pageNumberStyle : null,
    headerLogo: settings.logo && settings.logo.position === 'page-header' ? settings.logo : null,
  };
}

/** HTML for the simulated header/footer bands shown in the live preview. */
function runningParts(settings, design, docTitle) {
  const r = runningContent(settings, docTitle);
  const logoImg = r.headerLogo ? `<img src="${r.headerLogo.dataUrl}" alt="" style="height:${HEADER_LOGO_HEIGHT}px;width:${headerLogoWidth(r.headerLogo)}px;object-fit:contain;object-position:left center;${r.headerText ? 'transform:translateY(-1px)' : ''}">` : '';
  const pageNumber = r.pageNumbers ? (r.pageNumbers === 'n' ? '<span class="pageNumber">1</span>' : '<span class="pageNumber">1</span> / <span class="totalPages">N</span>') : '';
  return {
    headerLeft: `<span class="running-brand">${logoImg}${r.headerText ? `<span>${escapeHtml(r.headerText)}</span>` : ''}</span>`,
    headerRight: `<span>${escapeHtml(r.dateText)}</span>`,
    footerLeft: `<span>${escapeHtml(r.footerText)}</span>`,
    footerRight: `<span>${pageNumber}</span>`,
  };
}

const HEADER_LOGO_HEIGHT = 14;
const RUNNING_BAND = 30;

function cssString(text) {
  return `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
}

/** Shared logo bounds keep preview and printed headers identical. */
function headerLogoWidth(logo) {
  return Math.max(1, Math.min(160, Math.round(HEADER_LOGO_HEIGHT * logo.aspect)));
}

function headerLogoUrl(logo) {
  const width = headerLogoWidth(logo);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER_LOGO_HEIGHT}"><image href="${escapeHtml(logo.dataUrl)}" width="${width}" height="${HEADER_LOGO_HEIGHT}" preserveAspectRatio="xMinYMid meet"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * CSS `@page` rule for the PDF: paper size, margins, full-bleed page background
 * and the running header/footer as margin boxes (with native page counters).
 */
function buildPageCss(settings, design, docTitle) {
  const t = design.theme;
  const { x, y } = design.margins;
  const r = runningContent(settings, docTitle);
  const top = y + (design.hasRunningHeader ? RUNNING_BAND : 0);
  const bottom = y + (design.hasRunningFooter ? RUNNING_BAND : 0);
  const base = `font-family: ${design.font.family}; font-size: 8pt; color: ${t.muted}; vertical-align: middle; -webkit-print-color-adjust: exact;`;
  const box = (name, content, extra = '') => (content ? `@${name} { content: ${content}; ${base} ${extra} }` : '');

  // Apply a 1px optical lift when text accompanies the logo: visible glyphs
  // sit above the line-box center. Keep standalone logos geometrically centered.
  // A background centers the logo independently of the text baseline. Generate
  // the box for logo-only headers too, but reserve a gap only when text exists.
  const headerLeft = r.headerLogo || r.headerText ? cssString(r.headerText) : '';
  const headerLogoStyle = r.headerLogo
    ? `background-image: url(${cssString(headerLogoUrl(r.headerLogo))}); background-repeat: no-repeat; background-position: left ${r.headerText ? 'calc(50% - 1px)' : 'center'}; background-size: ${headerLogoWidth(r.headerLogo)}px ${HEADER_LOGO_HEIGHT}px; padding-left: ${headerLogoWidth(r.headerLogo) + (r.headerText ? 8 : 0)}px;`
    : '';
  const headerRight = r.dateText ? cssString(r.dateText) : '';
  const pageCounter = r.pageNumbers ? (r.pageNumbers === 'n' ? 'counter(page)' : 'counter(page) " / " counter(pages)') : '';
  const footerLeft = r.footerText ? cssString(r.footerText) : '';

  return `@page {
    size: ${settings.paperSize} ${settings.orientation};
    margin: ${top}px ${x}px ${bottom}px ${x}px;
    background: ${t.background};
    ${box('top-left', headerLeft, `text-align: left; line-height: ${HEADER_LOGO_HEIGHT}px; ${headerLogoStyle}`)}
    ${box('top-right', headerRight, 'text-align: right;')}
    ${box('bottom-left', footerLeft, 'text-align: left;')}
    ${box(footerLeft ? 'bottom-right' : 'bottom-center', pageCounter, (footerLeft ? 'text-align: right;' : 'text-align: center;') + ' font-variant-numeric: tabular-nums;')}
  }`;
}

/**
 * Puppeteer `page.pdf()` options for a settings object. Page geometry and
 * running header/footer live in CSS (see buildPageCss), so this is small.
 */
export function buildPdfPageOptions(rawSettings, markdown, fallbackTitle) {
  const settings = normalizeSettings(rawSettings);
  return {
    format: settings.paperSize,
    landscape: settings.orientation === 'landscape',
    title: inferTitle(markdown, fallbackTitle || 'Document'),
  };
}
