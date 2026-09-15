/**
 * In-page extraction script.
 *
 * `extractPageDocument` is serialised by puppeteer and executed inside the
 * scraped page *after* it has rendered, so it can use everything the browser
 * knows that a static HTML parser does not: computed styles (is this element
 * actually visible? is it a fixed cookie banner? is this span laid out as a
 * block?), rendered text (`innerText` of code blocks), lazy-loaded image URLs
 * and the real DOM produced by the site's JavaScript.
 *
 * It must stay ONE self-contained function: no imports and no references to
 * anything outside its own body, because only its source text is shipped to
 * the page.
 *
 * Pipeline:
 *   1. metadata (meta tags + JSON-LD)          → title, author, date …
 *   2. prune junk (scripts, forms, icons …)
 *   3. prune invisible / fixed / off-canvas nodes using computed styles
 *   4. prune site chrome (nav, header, footer, sidebars, share bars …)
 *   5. pick the content root by text density, keeping the headline
 *   6. render that subtree to GitHub-flavoured Markdown (and cleaned HTML)
 *
 * @param {{ stripImages?: boolean, stripLinks?: boolean }} opts
 */
export function extractPageDocument(opts) {
  const stripImages = !!(opts && opts.stripImages);
  const stripLinks = !!(opts && opts.stripLinks);
  const win = window;
  const doc = document;
  const body = doc.body;
  if (!body) return { error: 'The page has no body.' };
  const trace = [];
  const mark = (stage) => {
    if (opts && opts.debug) trace.push(`${stage}: ${(body.innerText || '').replace(/\s+/g, ' ').trim().length} chars`);
  };

  // ------------------------------------------------------------------ helpers
  const BLOCK_TAGS = new Set(
    'ADDRESS ARTICLE ASIDE BLOCKQUOTE BODY CAPTION CENTER DD DETAILS DIALOG DIV DL DT FIELDSET FIGCAPTION FIGURE FOOTER FORM H1 H2 H3 H4 H5 H6 HEADER HGROUP HR IFRAME LI MAIN NAV OL P PRE SECTION SUMMARY TABLE TBODY TD TFOOT TH THEAD TR UL'.split(' '),
  );
  const VOID_TAGS = new Set('IMG BR WBR HR INPUT SOURCE TRACK AREA COL EMBED PARAM'.split(' '));
  const NEGATIVE =
    /(?:^|[\s_-])(?:ads?|advert\w*|banner|breadcrumbs?|comments?|community|cookie\w*|consent|disqus|gdpr|menu|navbar|navigation|related|share|sharing|social|sidebar|sponsor\w*|promo\w*|newsletter|subscribe|subscription|signup|login|modal|overlay|popup|toast|tooltip|toc|table-of-contents|skip\w*|pagination|pager|footer|masthead|widget|recommend\w*|trending|popular|announcement|feedback|edit-?section|jump-?link)(?:$|[\s_-])/i;
  const POSITIVE = /(?:^|[\s_-])(?:article|body|content|entry|hentry|h-entry|main|page|post|text|blog|story|prose|markdown|docs?|documentation|readme|wiki|question|answer)(?:$|[\s_-])/i;
  const CALLOUT = /(?:^|[\s_-])(?:admonition|alert|callout|note|tip|hint|info|warning|warn|caution|danger|important|attention|success|error|notice|markdown-alert|custom-block)(?:$|[\s_-])/i;
  const LINE_NUMBERS = '.line-numbers-rows, .linenos, .lineno, .line-number, .line-numbers, .hljs-ln-numbers, .gutter, td.linenos, .code-line-numbers, [class*="line-number"], [class*="linenumber"], [class*="lineNumber"], .react-syntax-highlighter-line-number';

  const styleCache = new WeakMap();
  const css = (el) => {
    let s = styleCache.get(el);
    if (!s) {
      s = win.getComputedStyle(el);
      styleCache.set(el, s);
    }
    return s;
  };
  const attr = (el, name) => (el && el.getAttribute ? el.getAttribute(name) || '' : '');
  const classId = (el) => `${attr(el, 'class')} ${attr(el, 'id')}`.trim();
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const simplify = (s) => norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const remove = (el) => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const absolute = (url) => {
    try {
      return new URL(url, location.href).href;
    } catch {
      return '';
    }
  };

  // ----------------------------------------------------------------- metadata
  const meta = (...names) => {
    for (const n of names) {
      const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`);
      const v = el && el.getAttribute('content');
      if (v && v.trim()) return v.trim();
    }
    return '';
  };
  const ld = {};
  for (const script of all(doc, 'script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent);
      const items = Array.isArray(parsed) ? parsed : parsed && parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        if (!ld.author && it.author) {
          const a = Array.isArray(it.author) ? it.author[0] : it.author;
          ld.author = typeof a === 'string' ? a : a && a.name;
        }
        if (!ld.published && it.datePublished) ld.published = it.datePublished;
        if (!ld.headline && it.headline) ld.headline = it.headline;
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const siteName = meta('og:site_name', 'application-name') || location.hostname.replace(/^www\./, '');
  const rawTitle = meta('og:title', 'twitter:title') || ld.headline || doc.title || '';
  const description = meta('description', 'og:description', 'twitter:description');
  const author = meta('author', 'article:author', 'parsely-author', 'byl', 'dc.creator', 'twitter:creator') || ld.author || '';
  const published =
    meta('article:published_time', 'datePublished', 'date', 'parsely-pub-date', 'dc.date', 'dc.date.issued', 'pubdate') ||
    ld.published ||
    attr(doc.querySelector('time[datetime]'), 'datetime') ||
    '';
  const canonicalEl = doc.querySelector('link[rel="canonical"]');
  const canonical = (canonicalEl && canonicalEl.href) || meta('og:url') || location.href;
  const lang = attr(doc.documentElement, 'lang') || '';

  /** "Article title | Site name" → "Article title". */
  function cleanTitle(title) {
    const t = norm(title);
    if (!t) return '';
    const parts = t.split(/\s+[|\-–—·»:]{1,2}\s+/);
    if (parts.length < 2) return t;
    const last = parts[parts.length - 1];
    const site = simplify(siteName);
    const lastSimple = simplify(last);
    const looksLikeSite = (site && (lastSimple === site || site.includes(lastSimple) || lastSimple.includes(site))) || last.length <= 24;
    if (looksLikeSite && parts.slice(0, -1).join(' ').length >= 8) return norm(parts.slice(0, -1).join(' - '));
    return t;
  }

  // -------------------------------------------------------------- visibility
  function isHidden(el) {
    const tag = el.tagName;
    if (tag === 'HTML' || tag === 'BODY') return false;
    const s = css(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return true;
    if (s.display === 'contents') return false;
    if (VOID_TAGS.has(tag)) return false;
    const r = el.getBoundingClientRect();
    const overflowHidden = /hidden|clip/.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`);
    const clipped = (s.clipPath && s.clipPath !== 'none') || (s.clip && s.clip !== 'auto');
    // Screen-reader-only text: 1×1 px, clipped.
    if (r.width <= 1 && r.height <= 1 && (overflowHidden || clipped)) return true;
    // Collapsed accordion / hidden tab panel: zero-size box that clips its children.
    if ((r.width === 0 || r.height === 0) && overflowHidden && (el.children.length > 0 || el.textContent.trim())) return true;
    // Parked off-canvas (mobile drawers, "left: -9999px" honeypots) — unless simply scrolled out of an inner scroller.
    if (r.width > 0 && r.height > 0 && (r.right + win.scrollX <= 0 || r.bottom + win.scrollY <= 0) && !inScrollContainer(el)) return true;
    return false;
  }
  function inScrollContainer(el) {
    for (let p = el.parentElement; p && p !== body; p = p.parentElement) {
      const s = css(p);
      if (/(auto|scroll)/.test(`${s.overflowX} ${s.overflowY}`)) return true;
    }
    return false;
  }

  function firstVisibleHeadline() {
    for (const h of all(body, 'h1')) {
      if (h.closest('pre, code, nav, [role="navigation"]')) continue;
      const clone = h.cloneNode(true);
      for (const a of all(clone, 'a[href^="#"]')) if (norm(a.textContent).length <= 2 || /^(permalink|anchor|link)/i.test(norm(a.textContent))) remove(a);
      const t = norm(clone.textContent);
      if (t && t.length <= 300 && !isHidden(h)) return { el: h, text: t };
    }
    return null;
  }

  // --------------------------------------------------------------- text stats
  const stats = new WeakMap(); // element → { text, link } visible-ish character counts
  function computeStats(el) {
    let text = 0;
    let link = 0;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) text += norm(n.nodeValue).length;
      else if (n.nodeType === 1) {
        const c = computeStats(n);
        text += c.text;
        link += c.link;
      }
    }
    const s = { text, link: el.tagName === 'A' ? text : Math.min(link, text) };
    stats.set(el, s);
    return s;
  }
  const textOf = (el) => (stats.get(el) || { text: 0 }).text;
  const linkDensity = (el) => {
    const s = stats.get(el);
    return !s || !s.text ? 0 : s.link / s.text;
  };
  const nonLinkText = (el) => {
    const s = stats.get(el);
    return s ? Math.max(0, s.text - s.link) : 0;
  };

  // ======================================================================
  // 1. Things that must happen before anything is removed
  // ======================================================================
  const headline = firstVisibleHeadline();
  const headlineText = headline ? headline.text : '';

  mark('start');
  // Expand collapsed sections so their content counts as visible.
  for (const d of all(body, 'details')) d.setAttribute('open', '');

  // Math: the TeX source lives in nodes the browser hides (<annotation>, assistive
  // MathML, <script type="math/tex">), so lift it into placeholders before pruning.
  const mathPlaceholder = (el, tex, display) => {
    const node = doc.createElement(display ? 'div' : 'span');
    node.setAttribute('data-md-math', display ? 'block' : 'inline');
    node.textContent = tex.trim();
    el.replaceWith(node);
  };
  for (const s of all(body, 'script[type^="math/tex"]')) {
    if (s.textContent.trim()) mathPlaceholder(s, s.textContent, /mode\s*=\s*display/i.test(attr(s, 'type')));
    else remove(s);
  }
  for (const el of all(body, '.katex, .MathJax, mjx-container, .MathJax_Preview, math')) {
    if (!el.isConnected || (el.tagName === 'MATH' && el.closest('.katex, .MathJax, mjx-container'))) continue;
    if (/MathJax_Preview/.test(attr(el, 'class'))) {
      remove(el);
      continue;
    }
    const annotation = el.querySelector('annotation[encoding*="tex" i]');
    const mathEl = el.tagName === 'MATH' ? el : el.querySelector('math');
    const tex = (annotation && annotation.textContent) || attr(mathEl, 'alttext') || attr(el, 'data-tex') || attr(el, 'alttext') || '';
    if (!tex.trim()) continue;
    const display =
      attr(el, 'display') === 'true' ||
      attr(mathEl, 'display') === 'block' ||
      /katex-display|MathJax_Display/.test(attr(el, 'class')) ||
      (el.parentElement && /katex-display|MathJax_Display/.test(attr(el.parentElement, 'class'))) ||
      css(el).display === 'block';
    mathPlaceholder(el, tex, display);
  }

  // Video embeds → a link, everything else in an iframe is unreachable.
  for (const f of all(body, 'iframe')) {
    const src = absolute(attr(f, 'src') || attr(f, 'data-src'));
    if (/^(https?:)?\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be|player\.vimeo\.com|vimeo\.com|loom\.com|wistia\.\w+|dailymotion\.com)\//i.test(src)) {
      const p = doc.createElement('p');
      const a = doc.createElement('a');
      a.href = src;
      a.textContent = attr(f, 'title') ? `Video: ${attr(f, 'title')}` : 'Watch the embedded video';
      p.appendChild(a);
      f.replaceWith(p);
    } else remove(f);
  }

  // ======================================================================
  // 2. Junk that never carries content
  // ======================================================================
  for (const el of all(body, 'script, noscript, template, svg, canvas, video, audio, object, embed, map, area, select, textarea, button, input:not([type="checkbox"]), link, meta, base, dialog:not([open]), [role="tooltip"], [role="status"], [role="alert"]:not(.markdown-alert), .mw-editsection, .navbox, .catlinks, .mw-indicators, .sistersitebox, #siteSub, .mw-jump-link, .ambox, .mbox-small, .shortdescription')) {
    remove(el);
  }
  for (const el of all(body, '[aria-hidden="true"]')) {
    if (el.isConnected && norm(el.textContent).length < 40 && !el.querySelector('img')) remove(el);
  }

  mark('junk removed');

  // ======================================================================
  // 3. Invisible, fixed and off-canvas nodes (computed styles)
  // ======================================================================
  computeStats(body);
  const bodyText = textOf(body);

  (function pruneInvisible(el) {
    for (const child of Array.from(el.children)) {
      if (!child.isConnected) continue;
      if (isHidden(child)) {
        remove(child);
        continue;
      }
      const pos = css(child).position;
      if (pos === 'fixed' && textOf(child) < 0.5 * bodyText) {
        remove(child);
        continue;
      }
      if (pos === 'sticky' && !/^(TH|TR|THEAD|TD)$/.test(child.tagName) && (linkDensity(child) > 0.5 || textOf(child) < 200 || /^(HEADER|NAV)$/.test(child.tagName))) {
        remove(child);
        continue;
      }
      pruneInvisible(child);
    }
  })(body);

  mark('invisible removed');
  // Styles are no longer needed once visibility has been decided.
  for (const el of all(body, 'style, link[rel="stylesheet"]')) remove(el);

  // ======================================================================
  // 4. Site chrome
  // ======================================================================
  computeStats(body);
  const insideContent = (el) => !!el.closest('article, main, [role="main"], [itemprop="articleBody"]');

  const bodyTextNow = textOf(body);
  for (const el of all(body, 'nav, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="dialog"], [role="alertdialog"], [role="search"], [role="menu"], [role="menubar"], [role="tablist"], [role="toolbar"], [aria-modal="true"], footer')) {
    if (!el.isConnected) continue;
    if (textOf(el) > 0.6 * bodyTextNow && el.querySelector('article, main, [role="main"], h1')) continue; // mislabelled page wrapper
    remove(el);
  }
  mark('landmarks removed');
  for (const el of all(body, 'header')) {
    if (!el.isConnected) continue;
    if (!insideContent(el) || linkDensity(el) > 0.5 || el.querySelector('nav, ul li a')) remove(el);
  }
  for (const el of all(body, 'aside')) {
    if (!el.isConnected) continue;
    if (!insideContent(el) || linkDensity(el) > 0.3 || NEGATIVE.test(classId(el))) remove(el);
  }
  mark('header/aside removed');
  const pageText = textOf(body);
  for (const el of all(body, '[class], [id]')) {
    if (!el.isConnected || el === body) continue;
    const tag = el.tagName;
    if (tag === 'ARTICLE' || tag === 'MAIN' || tag === 'HTML') continue;
    const cls = classId(el);
    if (!NEGATIVE.test(cls) || POSITIVE.test(cls)) continue;
    // Never take out a layout wrapper (state classes like "Sidebar--expanded" on the app shell).
    if (textOf(el) > 0.5 * pageText || el.querySelector('article, main, [role="main"]') || (headline && headline.el.isConnected && el.contains(headline.el) && textOf(el) > 0.25 * pageText)) continue;
    if (textOf(el) < 1500 || linkDensity(el) > 0.4) remove(el);
  }
  mark('class-based chrome removed');
  // Link farms (tag clouds, "more from…" lists) that survived the class filter — not on pages that *are* link lists.
  computeStats(body);
  for (const list of linkDensity(body) > 0.7 ? [] : all(body, 'ul, ol')) {
    if (!list.isConnected || list.closest('pre')) continue;
    const items = list.children.length;
    if (items >= 4 && linkDensity(list) > 0.9 && textOf(list) / items < 60 && !insideContent(list)) remove(list);
  }

  // "#", "¶", "Permalink" anchors inside headings are navigation, not text.
  for (const h of all(body, 'h1, h2, h3, h4, h5, h6')) {
    for (const a of all(h, 'a')) {
      const t = norm(a.textContent);
      const href = attr(a, 'href');
      const toFragment = href.startsWith('#') || /#[^/]*$/.test(href);
      if (toFragment && (!t || t.length <= 2 || /^(#|¶|§|permalink|anchor|link|link to this|direct link|copy link)/i.test(t) || a.querySelector('svg, img') && t.length <= 2)) remove(a);
      else if (toFragment || absolute(href) === location.href.split('#')[0]) {
        const span = doc.createElement('span');
        while (a.firstChild) span.appendChild(a.firstChild);
        a.replaceWith(span);
      }
    }
  }

  // Options that change what counts as content.
  if (stripImages) {
    for (const f of all(body, 'figure')) if (f.querySelector('img, picture')) remove(f);
    for (const el of all(body, 'img, picture')) remove(el);
  }
  if (stripLinks) {
    for (const a of all(body, 'a')) {
      const span = doc.createElement('span');
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    }
  }

  // ======================================================================
  // 5. Content root
  // ======================================================================
  mark('link farms removed');
  computeStats(body);
  // Articles are judged by prose outside links; link-dense pages (news fronts, directories) by all text.
  const weight = linkDensity(body) > 0.7 ? textOf : nonLinkText;
  const total = weight(body);
  if (total < 120) {
    return { error: 'empty', visibleText: norm(body.innerText || body.textContent).slice(0, 400), title: cleanTitle(rawTitle), trace };
  }

  let root = body;
  let depth = 0;
  while (depth < 60) {
    if (/^(ARTICLE|MAIN)$/.test(root.tagName) || attr(root, 'role') === 'main' || attr(root, 'itemprop') === 'articleBody') break;
    const mine = weight(root);
    if (!mine) break;
    let best = null;
    let bestText = 0;
    for (const c of root.children) {
      const t = weight(c);
      if (t > bestText) {
        bestText = t;
        best = c;
      }
    }
    if (!best || bestText < 0.7 * mine || bestText < 0.5 * total) break;
    root = best;
    depth += 1;
  }
  // The descent may have skipped the article header; climb back to include the headline.
  if (headline && headline.el.isConnected && !root.contains(headline.el)) {
    let node = root;
    for (let i = 0; i < 4; i += 1) {
      const p = node.parentElement;
      if (!p || p === doc.documentElement) break;
      if (weight(p) > 1.4 * weight(root)) break;
      node = p;
      if (node.contains(headline.el)) {
        root = node;
        break;
      }
    }
  }
  const mode = root === body ? 'page' : 'article';

  // Absolute URLs, so both the Markdown and the HTML are portable.
  for (const a of all(root, 'a[href]')) {
    const href = attr(a, 'href');
    if (/^\s*(javascript|data|vbscript):/i.test(href)) a.removeAttribute('href');
    else if (!href.startsWith('#')) a.setAttribute('href', absolute(href) || href);
  }

  // ======================================================================
  // 6. Markdown renderer
  // ======================================================================
  const headings = all(root, 'h1, h2, h3, h4, h5, h6').filter((h) => !h.closest('pre') && norm(h.textContent));
  const hasH1 = headings.some((h) => h.tagName === 'H1');
  const minLevel = headings.reduce((m, h) => Math.min(m, +h.tagName[1]), 7);
  const headingShift = !hasH1 && minLevel >= 3 && minLevel < 7 ? minLevel - 2 : 0;

  // Semantic blocks stay blocks whatever the stylesheet says (Wikipedia renders <h2> as
  // display:inline); generic containers (div/span/a…) follow their computed display.
  const isBlockLevel = (el) => {
    const tag = el.tagName;
    if (BLOCK_TAGS.has(tag) && tag !== 'DIV') return true;
    const d = css(el).display;
    if (!d || d === 'none' || d === 'contents') return tag === 'DIV';
    if (d === 'inline' || d.startsWith('inline') || d === 'ruby' || d.startsWith('ruby')) return false;
    return true;
  };
  const containsBlock = (el) => Array.from(el.children).some((c) => isBlockLevel(c));
  // Inline wrappers (<span><h1>…) that carry structural content must be laid out as blocks.
  const SEMANTIC_BLOCKS = 'h1, h2, h3, h4, h5, h6, p, ul, ol, table, pre, blockquote, figure, dl, hr, details';
  const wrapsBlocks = (el) => !VOID_TAGS.has(el.tagName) && el.tagName !== 'A' && el.tagName !== 'CODE' && !!el.querySelector(SEMANTIC_BLOCKS);

  function escapeText(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/([*`[\]])/g, '\\$1')
      .replace(/~~/g, '\\~\\~')
      .replace(/(^|[^\p{L}\p{N}\\])_(?=[\p{L}\p{N}])/gu, '$1\\_')
      .replace(/([\p{L}\p{N}])_(?=$|[^\p{L}\p{N}])/gu, '$1\\_')
      .replace(/<(?=[a-zA-Z/!?])/g, '\\<');
  }
  function escapeLineStarts(line) {
    return line
      .replace(/^(\s*)(#{1,6})(\s|$)/, '$1\\$2$3')
      .replace(/^(\s*)([-+])(\s)/, '$1\\$2$3')
      .replace(/^(\s*)(\d{1,9})([.)])(\s)/, '$1$2\\$3$4')
      .replace(/^(\s*)>/, '$1\\>')
      .replace(/^(\s*)([-=]{3,})\s*$/, '$1\\$2')
      .replace(/^(\s*)(\|)/, '$1\\$2');
  }
  function encodeHref(href) {
    return href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/</g, '%3C').replace(/>/g, '%3E');
  }
  function wrap(delim, content) {
    const m = content.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const inner = m ? m[2] : content;
    if (!inner) return content;
    if (inner.startsWith(delim) && inner.endsWith(delim)) return content;
    return `${m[1]}${delim}${inner}${delim}${m[3]}`;
  }
  function codeSpan(text) {
    const t = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
    if (!t.trim()) return '';
    const runs = t.match(/`+/g);
    const fence = '`'.repeat((runs ? Math.max(...runs.map((r) => r.length)) : 0) + 1);
    const pad = t.startsWith('`') || t.endsWith('`') || fence.length > 1 ? ' ' : '';
    return `${fence}${pad}${t}${pad}${fence}`;
  }
  function finishInline(s) {
    const lines = s
      .split('\n')
      .map((l) => l.replace(/[ \t\u00a0\u200b\ufeff]+/g, ' ').trim())
      .map((l) => (l === '\\' ? '' : l))
      .map(escapeLineStarts);
    while (lines.length && !lines[0]) lines.shift();
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    const out = [];
    for (const l of lines) {
      if (!l && out.length && !out[out.length - 1]) continue;
      out.push(l);
    }
    return out.join('\n').replace(/\\$/, '').trim();
  }

  // ---- images
  function pickSrc(img) {
    const candidates = [];
    const push = (v) => {
      if (v && !/[{}]/.test(v)) candidates.push(v.trim());
    };
    push(attr(img, 'data-src'));
    push(attr(img, 'data-lazy-src'));
    push(attr(img, 'data-original'));
    push(attr(img, 'data-hi-res-src'));
    push(attr(img, 'data-url'));
    const srcset = attr(img, 'srcset') || attr(img, 'data-srcset') || attr(img, 'data-lazy-srcset');
    if (srcset) {
      let best = '';
      let bestW = -1;
      for (const part of srcset.split(',')) {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) continue;
        const d = bits[1] || '';
        const w = d ? parseFloat(d) * (d.endsWith('x') ? 1000 : 1) : 0;
        if (w > bestW) {
          bestW = w;
          best = bits[0];
        }
      }
      push(best);
    }
    push(img.currentSrc);
    push(attr(img, 'src'));
    for (const c of candidates) {
      if (/^data:|^blob:|^about:/i.test(c)) continue;
      const abs = absolute(c);
      if (abs && /^(https?|file):/i.test(abs)) return abs;
    }
    return '';
  }
  function image(img) {
    if (stripImages) return '';
    const alt = norm(attr(img, 'alt') || attr(img, 'title')).replace(/[[\]]/g, '');
    const r = img.getBoundingClientRect();
    const declaredW = /^\d+(\.\d+)?(px)?$/.test(attr(img, 'width')) ? parseFloat(attr(img, 'width')) : 0;
    const declaredH = /^\d+(\.\d+)?(px)?$/.test(attr(img, 'height')) ? parseFloat(attr(img, 'height')) : 0;
    // Declared dimensions express intent (a broken 16px icon renders its alt text wider than 16px).
    const w = (declaredW && declaredW <= 28 ? declaredW : 0) || r.width || declaredW || img.naturalWidth || 0;
    const h = (declaredH && declaredH <= 28 ? declaredH : 0) || r.height || declaredH || img.naturalHeight || 0;
    if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) return ''; // tracking pixel
    if (/emoji|twemoji|emojione/i.test(attr(img, 'class')) || (w > 0 && w <= 28 && h <= 28)) {
      // Icons and emoji: keep emoji text, drop decorative icons.
      return /^\p{Extended_Pictographic}/u.test(alt) || (alt.length > 0 && alt.length <= 2) ? escapeText(alt) : '';
    }
    const src = pickSrc(img);
    if (!src) return '';
    return `![${alt}](${encodeHref(src)})`;
  }
  function pictureImage(picture) {
    const img = picture.querySelector('img');
    if (img) return image(img);
    return '';
  }

  // ---- inline
  /** Rendered box of an element; falls back to its contents for display:contents wrappers. */
  function boxOf(el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0 || !el.firstChild) return r;
    const range = doc.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  }
  function inlineChildren(el, ctx) {
    return renderRun(Array.from(el.childNodes), ctx);
  }
  function renderRun(nodes, ctx) {
    let out = '';
    let prevBox = null; // box of the previous *element* node when no text sits between
    for (const n of nodes) {
      if (n.nodeType === 1 && prevBox && !ctx.pre) {
        // "<a>Author</a><span>2h ago</span>" touches in the DOM but not on screen: keep the visual gap.
        const r = boxOf(n);
        if (r.width > 0 && r.height > 0 && prevBox.width > 0 && (r.left >= prevBox.right + 3 || r.top >= prevBox.bottom - 2) && out && !/\s$/.test(out)) out += ' ';
      }
      out += inline(n, ctx);
      if (n.nodeType === 1) prevBox = boxOf(n);
      else if (n.nodeType === 3 && n.nodeValue) prevBox = null;
    }
    return out;
  }
  function inline(node, ctx) {
    if (node.nodeType === 3) {
      let t = node.nodeValue;
      if (ctx.pre) return t;
      const ws = node.parentElement ? css(node.parentElement).whiteSpace : 'normal';
      if (/^pre/.test(ws) && !ctx.heading && !ctx.table) {
        return escapeText(t.replace(/\u00a0/g, ' ')).replace(/\r?\n/g, '\\\n');
      }
      t = t.replace(/[\s\u00a0]+/g, ' ');
      return escapeText(t);
    }
    if (node.nodeType !== 1) return '';
    const el = node;
    const tag = el.tagName;
    if (tag === 'BR') return ctx.table ? '<br>' : ctx.heading ? ' ' : '\\\n';
    if (tag === 'WBR' || tag === 'INPUT' || tag === 'SCRIPT' || tag === 'STYLE') return '';
    if (tag === 'IMG') return image(el);
    if (tag === 'PICTURE') return pictureImage(el);
    if (attr(el, 'data-md-math')) return math(el, ctx);
    if (tag === 'A') return link(el, ctx);
    if (tag === 'STRONG' || tag === 'B') return wrap('**', inlineChildren(el, ctx));
    if (tag === 'EM' || tag === 'I' || tag === 'CITE' || tag === 'DFN' || tag === 'VAR') return wrap('*', inlineChildren(el, ctx));
    if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') return wrap('~~', inlineChildren(el, ctx));
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') return codeSpan(el.textContent);
    if (tag === 'SUP' || tag === 'SUB') {
      let inner = inlineChildren(el, ctx).trim();
      if (/^\\\[[^\]]*\\\]$/.test(inner)) inner = inner.replace(/\\([[\]])/g, '$1'); // footnote refs: <sup>[1]</sup>
      return inner ? `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>` : '';
    }
    if (tag === 'Q') return `"${inlineChildren(el, ctx).trim()}"`;
    if (tag === 'PRE') {
      // A code block in an inline context (table cell, heading): one code span per line.
      const lines = codeText(el).split('\n').map((l) => codeSpan(l)).filter(Boolean);
      return lines.join(ctx.table ? '<br>' : ' ');
    }
    if (tag === 'LI') {
      const inner = inlineChildren(el, ctx).trim();
      return inner ? (ctx.table ? `• ${inner}<br>` : ` ${inner}`) : '';
    }
    if (tag === 'UL' || tag === 'OL' || tag === 'P' || tag === 'DIV' || tag === 'SECTION' || tag === 'TABLE' || tag === 'TR' || tag === 'BLOCKQUOTE' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
      const inner = inlineChildren(el, ctx).trim();
      if (!inner) return '';
      return ctx.table ? `<br>${inner}<br>` : ` ${inner} `;
    }
    if (isBlockLevel(el)) {
      const inner = inlineChildren(el, ctx).trim();
      if (!inner) return '';
      return ctx.table ? `<br>${inner}<br>` : ` ${inner} `;
    }
    return inlineChildren(el, ctx);
  }
  function link(a, ctx) {
    const href = attr(a, 'href');
    const innerCtx = Object.assign({}, ctx, { inLink: true });
    const content = inlineChildren(a, innerCtx);
    if (!href || ctx.inLink || href.startsWith('#') || stripLinks) return content;
    const trimmed = content.trim();
    if (!trimmed) return '';
    const m = content.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return `${m[1]}[${trimmed.replace(/\s*\n\s*/g, ' ')}](${encodeHref(href)})${m[3]}`;
  }
  function math(el, ctx) {
    const tex = el.textContent.trim();
    if (!tex) return '';
    if (attr(el, 'data-md-math') === 'block' && !ctx.table && !ctx.heading) return `\n$$\n${tex}\n$$\n`;
    return `$${tex.replace(/\s*\n\s*/g, ' ')}$`;
  }

  // ---- code blocks
  /**
   * Rendered text of a code block. Like `innerText`, block-level line wrappers
   * (Shiki/Prism/CodeMirror `<span class="line">`, `<div>` per line) become line
   * breaks — but without doubling up when the markup already has "\n" between them.
   */
  function codeText(pre) {
    for (const ln of all(pre, LINE_NUMBERS)) remove(ln);
    let out = '';
    let closedBlock = false;
    const walk = (node) => {
      if (node.nodeType === 3) {
        let t = node.nodeValue;
        if (closedBlock && /^[ \t]*\n/.test(t)) t = t.replace(/^[ \t]*\n/, '');
        closedBlock = false;
        out += t;
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'BR') {
        out += '\n';
        closedBlock = true;
        return;
      }
      const s = css(node);
      if (s.display === 'none' || s.visibility === 'hidden') return;
      const block = node !== pre && (s.display === 'block' || s.display === 'flex' || s.display === 'grid' || s.display === 'list-item' || s.display === 'table' || s.display === 'table-row' || node.tagName === 'DIV' || node.tagName === 'P');
      if (block && out && !out.endsWith('\n')) out += '\n';
      for (const c of node.childNodes) walk(c);
      if (block) {
        if (!out.endsWith('\n')) out += '\n';
        closedBlock = true;
      }
    };
    walk(pre);
    if (!out.trim()) out = pre.textContent || '';
    return out.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
  }
  function detectLanguage(pre) {
    const sources = [];
    const code = pre.querySelector('code');
    for (const el of [code, pre, pre.parentElement, pre.parentElement && pre.parentElement.parentElement]) {
      if (!el || el === body) continue;
      sources.push(attr(el, 'class'), attr(el, 'data-lang'), attr(el, 'data-language'), attr(el, 'data-code-language'), attr(el, 'lang') === lang ? '' : attr(el, 'lang'));
    }
    const KNOWN = /(?:^|[\s-])(javascript|typescript|jsx|tsx|python|ruby|golang|go|rust|java|kotlin|swift|bash|shell|sh|zsh|console|json|jsonc|json5|yaml|yml|toml|html|css|scss|less|sql|c|cpp|csharp|cs|php|xml|markdown|md|diff|dockerfile|docker|graphql|powershell|ps1|ini|makefile|nginx|apache|plaintext|text|txt|http|hcl|terraform|lua|perl|r|scala|dart|elixir|erlang|haskell|clojure|objectivec|objc|matlab|vue|svelte|astro|mdx|latex|tex|proto|protobuf|prisma|solidity|zig|nim|ocaml|fsharp|groovy|gradle|cmake|asm|vim|bat|cmd)(?:$|[\s-])/i;
    for (const s of sources) {
      if (!s) continue;
      const m = s.match(/(?:^|[\s])(?:language|lang|highlight-source|highlight|brush|syntax|code|sourceCode)[-:_]([a-z0-9#+_.-]+)/i);
      if (m) return normaliseLang(m[1]);
    }
    for (const s of sources) {
      if (!s) continue;
      const m = s.match(KNOWN);
      if (m) return normaliseLang(m[1]);
    }
    return '';
  }
  function normaliseLang(l) {
    const v = String(l).toLowerCase();
    if (/^(plaintext|text|txt|plain|none|nohighlight|default)$/.test(v)) return '';
    return v;
  }
  function codeBlock(pre) {
    const text = codeText(pre);
    if (!text.trim()) return '';
    const language = detectLanguage(pre);
    const runs = text.match(/`{3,}/g);
    const fence = '`'.repeat(runs ? Math.max(3, ...runs.map((r) => r.length + 1)) : 3);
    return `${fence}${language}\n${text}\n${fence}`;
  }

  // ---- blocks
  function paragraph(el, ctx) {
    return finishInline(inlineChildren(el, ctx));
  }
  function joinBlocks(parts) {
    return parts.filter(Boolean).join('\n\n');
  }
  function blocks(el, ctx) {
    // A row of small flex/grid children (bylines, chips, key/value pairs) reads as one line.
    const d = css(el).display;
    if ((d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid') && el.children.length > 1 && el.children.length <= 8) {
      const kids = Array.from(el.children);
      const small = kids.every((k) => !containsBlock(k) && textOf(k) <= 120 && !/^(UL|OL|TABLE|PRE|BLOCKQUOTE|H[1-6]|FIGURE|IMG|PICTURE)$/.test(k.tagName) && !k.querySelector('img, picture'));
      const rowish = d.endsWith('grid') || !css(el).flexDirection.startsWith('column');
      if (small && rowish) {
        const pieces = kids
          .map((k) => inline(k, ctx).trim())
          .filter((t) => t && !/^[\s·•|\-–—,/\\]+$/.test(t)); // drop separator-only children, we add our own
        const line = finishInline(pieces.join(' · '));
        return line ? [line] : [];
      }
    }
    const out = [];
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const s = finishInline(renderRun(run, ctx));
      if (s) out.push(s);
      run = [];
    };
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) {
        if (n.nodeValue.trim() || run.length) run.push(n);
        continue;
      }
      if (n.nodeType !== 1) continue;
      if (isBlockLevel(n) || wrapsBlocks(n) || (n.tagName === 'A' && containsBlock(n)) || (n.tagName === 'PICTURE' && n.querySelector('img') && isBlockLevel(n.querySelector('img')))) {
        flush();
        const b = block(n, ctx);
        if (Array.isArray(b)) out.push(...b.filter(Boolean));
        else if (b) out.push(b);
      } else run.push(n);
    }
    flush();
    return out;
  }
  function block(el, ctx) {
    const tag = el.tagName;
    switch (tag) {
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6':
        return heading(el, ctx);
      case 'P':
        return containsBlock(el) ? joinBlocks(blocks(el, ctx)) : paragraph(el, ctx);
      case 'HR':
        return '---';
      case 'BR':
        return '';
      case 'UL':
      case 'OL':
        return list(el, ctx);
      case 'PRE':
        return codeBlock(el);
      case 'CODE':
        return /\n/.test(el.textContent.trim()) ? codeBlock(el) : paragraph(el, ctx);
      case 'BLOCKQUOTE':
        return quote(el, ctx);
      case 'TABLE':
        return table(el, ctx);
      case 'FIGURE':
        return figure(el, ctx);
      case 'FIGCAPTION': {
        const t = paragraph(el, ctx);
        return t ? wrap('*', t) : '';
      }
      case 'IMG':
        return finishInline(image(el));
      case 'PICTURE':
        return finishInline(pictureImage(el));
      case 'DETAILS':
        return details(el, ctx);
      case 'DL':
        return definitionList(el, ctx);
      case 'IFRAME':
        return '';
      case 'A': {
        // Card links: keep the inner layout and attach the link to the first line (usually the title).
        if (!containsBlock(el) && !wrapsBlocks(el)) return paragraph(el, ctx);
        const parts = blocks(el, Object.assign({}, ctx, { inLink: true }));
        const href = attr(el, 'href');
        if (!parts.length) return '';
        if (href && !href.startsWith('#') && !stripLinks && !ctx.inLink) {
          const target = encodeHref(href);
          const headingIndex = parts.findIndex((p) => /^#{1,6} [^\n]+$/.test(p));
          if (headingIndex >= 0) parts[headingIndex] = parts[headingIndex].replace(/^(#{1,6} )([\s\S]+)$/, (_, h, t) => `${h}[${t}](${target})`);
          else if (/^!\[[^\]]*\]\([^)\s]+\)$/.test(parts[0])) parts[0] = `[${parts[0]}](${target})`;
          else if (!/\n/.test(parts[0])) parts[0] = `[${parts[0]}](${target})`;
          else {
            const label = norm(el.textContent).replace(/^(.{0,80})(\s.*)?$/, '$1');
            parts.push(`[${label ? escapeText(label) : 'Read more'}](${target})`);
          }
        }
        return parts;
      }
      default: {
        if (attr(el, 'data-md-math') === 'block') return `$$\n${el.textContent.trim()}\n$$`;
        const type = calloutType(el);
        if (type && containsBlock(el)) return callout(el, ctx, type);
        if (containsBlock(el) || wrapsBlocks(el) || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN') return blocks(el, ctx);
        return paragraph(el, ctx);
      }
    }
  }
  function heading(el, ctx) {
    const text = finishInline(inlineChildren(el, Object.assign({}, ctx, { heading: true }))).replace(/\s*\n\s*/g, ' ');
    if (!text) return '';
    const level = Math.min(6, Math.max(1, +el.tagName[1] - headingShift));
    return `${'#'.repeat(level)} ${text.replace(/\s+#+\s*$/, '')}`;
  }
  function list(el, ctx) {
    const ordered = el.tagName === 'OL';
    const start = parseInt(attr(el, 'start'), 10) || 1;
    const items = Array.from(el.children).filter((c) => c.tagName === 'LI' || c.tagName === 'UL' || c.tagName === 'OL');
    const out = [];
    let index = start;
    for (const li of items) {
      if (li.tagName !== 'LI') {
        // Nested list without an <li> wrapper: attach to the previous item.
        const nested = list(li, ctx);
        if (nested) out.push(nested.replace(/^/gm, '  '));
        continue;
      }
      const marker = ordered ? `${index}. ` : '- ';
      index += 1;
      const indent = ' '.repeat(marker.length);
      const checkbox = li.querySelector(':scope > input[type="checkbox"], :scope > label > input[type="checkbox"], :scope > p:first-child > input[type="checkbox"], :scope > div:first-child > input[type="checkbox"]');
      const task = checkbox ? (checkbox.checked || checkbox.hasAttribute('checked') ? '[x] ' : '[ ] ') : '';
      const parts = blocks(li, ctx);
      if (!parts.length) continue;
      const loose = Array.from(li.children).filter((c) => c.tagName === 'P').length > 1;
      const first = parts[0];
      const rest = parts.slice(1);
      let text = marker + task + first.replace(/\n/g, `\n${indent}`);
      for (const part of rest) {
        const isList = /^(\s*)([-*+]|\d+[.)]) /.test(part);
        text += (isList || !loose ? '\n' : '\n\n') + part.replace(/^/gm, indent);
      }
      out.push(text);
    }
    return out.join('\n');
  }
  function quote(el, ctx) {
    const type = calloutType(el);
    if (type) return callout(el, ctx, type);
    const inner = joinBlocks(blocks(el, ctx));
    if (!inner) return '';
    return inner.replace(/^/gm, '> ').replace(/^> $/gm, '>');
  }
  function calloutType(el) {
    const cls = `${attr(el, 'class')} ${attr(el, 'data-type')} ${attr(el, 'data-style')} ${attr(el, 'data-callout')} ${attr(el, 'data-admonition-type')} ${attr(el, 'role') === 'note' ? 'note' : ''}`;
    const generic = CALLOUT.test(cls);
    const specific = cls.match(/(?:^|[\s_-])(note|tip|hint|info|warning|warn|caution|danger|important|attention|success|error|notice)(?:$|[\s_-])/i);
    let word = specific ? specific[1].toLowerCase() : '';
    if (!word && el.tagName === 'BLOCKQUOTE') {
      // Legacy GitHub style: "> **Note** …"
      const first = el.querySelector(':scope > p:first-child > strong:first-child, :scope > p:first-child > b:first-child, :scope > strong:first-child');
      const m = first && norm(first.textContent).match(/^\[?!?(note|tip|hint|info|warning|caution|danger|important)\]?:?$/i);
      if (m) word = m[1].toLowerCase();
    }
    if (!word) return generic && el.tagName !== 'BLOCKQUOTE' ? 'NOTE' : '';
    if (/^(note|info|notice)$/.test(word)) return 'NOTE';
    if (/^(tip|hint|success)$/.test(word)) return 'TIP';
    if (/^(important|attention)$/.test(word)) return 'IMPORTANT';
    if (/^(warning|warn)$/.test(word)) return 'WARNING';
    if (/^(caution|danger|error)$/.test(word)) return 'CAUTION';
    return '';
  }
  function callout(el, ctx, type) {
    const titleEl = el.querySelector(':scope > .admonition-title, :scope > .callout-title, :scope > .alert-title, :scope > .custom-block-title, :scope > [class*="title" i], :scope > [class*="heading" i], :scope > summary, :scope > p:first-child > strong:only-child, :scope > strong:first-child, :scope > b:first-child, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
    let title = '';
    if (titleEl && textOf(titleEl) <= 120) {
      title = finishInline(inlineChildren(titleEl, Object.assign({}, ctx, { heading: true }))).replace(/\s*\n\s*/g, ' ');
      const parent = titleEl.parentElement;
      remove(titleEl);
      if (parent && parent !== el && !norm(parent.textContent)) remove(parent);
    }
    const label = simplify(title).replace(/^[\s:!-]+|[\s:!-]+$/g, '');
    if (!label || /^(note|tip|hint|info|information|warning|caution|danger|important|attention|success|error|notice)$/.test(label) || label === type.toLowerCase()) title = '';
    const inner = joinBlocks(blocks(el, ctx));
    if (!inner && !title) return '';
    const head = title ? `[!${type}]\n${wrap('**', title.replace(/^\*+|\*+$/g, ''))}` : `[!${type}]`;
    return `${head}\n${inner}`.replace(/^/gm, '> ').replace(/^> $/gm, '>');
  }
  function figure(el, ctx) {
    const caption = el.querySelector(':scope > figcaption') || el.querySelector('figcaption');
    let captionText = '';
    if (caption) {
      captionText = finishInline(inlineChildren(caption, ctx)).replace(/\s*\n\s*/g, ' ');
      remove(caption);
    }
    const inner = joinBlocks(blocks(el, ctx));
    if (!inner) return '';
    return captionText ? `${inner}\n\n${wrap('*', captionText)}` : inner;
  }
  function details(el, ctx) {
    const summary = el.querySelector(':scope > summary');
    let title = '';
    if (summary) {
      title = finishInline(inlineChildren(summary, Object.assign({}, ctx, { heading: true }))).replace(/\s*\n\s*/g, ' ');
      remove(summary);
    }
    const parts = blocks(el, ctx);
    if (title) parts.unshift(wrap('**', title));
    return parts;
  }
  function definitionList(el, ctx) {
    const out = [];
    let terms = [];
    for (const child of Array.from(el.children)) {
      if (child.tagName === 'DT') {
        const t = finishInline(inlineChildren(child, Object.assign({}, ctx, { heading: true }))).replace(/\s*\n\s*/g, ' ');
        if (t) terms.push(t);
      } else if (child.tagName === 'DD' || child.tagName === 'DIV') {
        if (child.tagName === 'DIV' && child.querySelector('dt, dd')) {
          const nested = definitionList(child, ctx);
          if (nested) out.push(nested);
          continue;
        }
        const parts = blocks(child, ctx);
        const term = terms.length ? terms.map((t) => wrap('**', t)).join(', ') : '';
        terms = [];
        if (!parts.length) {
          if (term) out.push(`- ${term}`);
          continue;
        }
        const single = parts.length === 1 && !/\n/.test(parts[0]);
        if (single) out.push(term ? `- ${term} — ${parts[0]}` : `- ${parts[0]}`);
        else out.push(`- ${term || parts.shift()}\n${parts.map((p) => p.replace(/^/gm, '  ')).join('\n\n')}`);
      }
    }
    if (terms.length) out.push(terms.map((t) => `- ${wrap('**', t)}`).join('\n'));
    return out.join('\n');
  }

  // ---- tables
  function cellText(cell, ctx) {
    let s = inlineChildren(cell, Object.assign({}, ctx, { table: true }));
    s = s
      .replace(/[\s\u00a0]*\n[\s\u00a0]*/g, ' ')
      .replace(/(?:\s*<br>\s*){2,}/g, '<br>')
      .replace(/^(?:\s*<br>\s*)+|(?:\s*<br>\s*)+$/g, '')
      .replace(/[ \t\u00a0]+/g, ' ')
      .trim();
    return s.replace(/\|/g, '\\|');
  }
  function alignmentOf(th) {
    const a = (attr(th, 'align') || th.style.textAlign || '').toLowerCase();
    if (a === 'center') return ':---:';
    if (a === 'right') return '---:';
    return '---';
  }
  function table(el, ctx) {
    const rows = all(el, ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr').filter((r) => r.isConnected);
    if (!rows.length) return joinBlocks(blocks(el, ctx));
    const isLayout =
      attr(el, 'role') === 'presentation' ||
      el.querySelector('table') ||
      rows.every((r) => r.children.length <= 1) ||
      all(el, 'td, th').some((c) => c.querySelector('pre, h1, h2, h3, h4, h5, h6, blockquote, figure') || textOf(c) > 600 || (c.querySelectorAll('p').length > 2 && !el.querySelector('th')));
    if (isLayout) {
      const parts = [];
      for (const r of rows) for (const c of Array.from(r.children)) parts.push(...blocks(c, ctx));
      return joinBlocks(parts);
    }
    const caption = el.querySelector(':scope > caption');
    const captionText = caption ? finishInline(inlineChildren(caption, ctx)).replace(/\s*\n\s*/g, ' ') : '';
    const grid = [];
    let headerRowIndex = -1;
    rows.forEach((r, ri) => {
      const cells = Array.from(r.children).filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
      const row = [];
      for (const c of cells) {
        row.push({ text: cellText(c, ctx), el: c });
        const span = Math.min(parseInt(attr(c, 'colspan'), 10) || 1, 20);
        for (let i = 1; i < span; i += 1) row.push({ text: '', el: null });
      }
      const inHead = r.parentElement && r.parentElement.tagName === 'THEAD';
      const allTh = cells.length > 0 && cells.every((c) => c.tagName === 'TH');
      if (headerRowIndex === -1 && (inHead || (allTh && ri === 0))) headerRowIndex = ri;
      grid.push(row);
    });
    if (!grid.some((r) => r.some((c) => c.text))) return '';
    const cols = Math.max(...grid.map((r) => r.length));
    let header;
    let bodyRows;
    if (headerRowIndex >= 0) {
      header = grid[headerRowIndex];
      bodyRows = grid.filter((_, i) => i !== headerRowIndex);
    } else {
      header = Array.from({ length: cols }, () => ({ text: '', el: null }));
      bodyRows = grid;
    }
    const pad = (row) => {
      const r = row.slice(0, cols);
      while (r.length < cols) r.push({ text: '', el: null });
      return r;
    };
    header = pad(header);
    bodyRows = bodyRows.map(pad).filter((r) => r.some((c) => c.text));
    const widths = Array.from({ length: cols }, (_, i) => Math.max(3, header[i].text.length, ...bodyRows.map((r) => r[i].text.length)));
    const wide = widths.some((w) => w > 60);
    const fit = (text, i, align) => {
      if (wide) return text;
      const w = widths[i];
      if (align === ':---:') {
        const left = Math.floor((w - text.length) / 2);
        return ' '.repeat(left) + text + ' '.repeat(w - text.length - left);
      }
      if (align === '---:') return ' '.repeat(w - text.length) + text;
      return text + ' '.repeat(w - text.length);
    };
    const aligns = header.map((c) => (c.el ? alignmentOf(c.el) : '---'));
    const line = (row) => `| ${row.map((c, i) => fit(c.text, i, aligns[i])).join(' | ')} |`;
    const sep = `| ${aligns.map((a, i) => (wide ? a : a === ':---:' ? `:${'-'.repeat(widths[i] - 2)}:` : a === '---:' ? `${'-'.repeat(widths[i] - 1)}:` : '-'.repeat(widths[i]))).join(' | ')} |`;
    const md = [line(header), sep, ...bodyRows.map(line)].join('\n');
    return captionText ? `${wrap('*', captionText)}\n\n${md}` : md;
  }

  // ======================================================================
  // 7. Assemble
  // ======================================================================
  // Cleaned HTML (for the html format) is captured first: the Markdown renderer
  // consumes parts of the DOM (callout titles, captions, summaries) as it goes.
  let html = '';
  if (opts && opts.html) {
    for (const img of all(root, 'img')) {
      const src = pickSrc(img);
      if (src) img.setAttribute('src', src);
      img.removeAttribute('srcset');
    }
    for (const el of all(root, '*')) {
      for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name) || a.name === 'style') el.removeAttribute(a.name);
    }
    html = root.innerHTML;
  }

  const bodyParts = blocks(root, {});
  // Breadcrumbs / "back to" links that sit above the headline come out as lone link paragraphs.
  while (bodyParts.length && /^\[[^\]\n]{1,60}\]\([^)\s]+\)$/.test(bodyParts[0])) bodyParts.shift();
  let markdown = joinBlocks(bodyParts);

  const title = cleanTitle(rawTitle) || headlineText || norm(doc.title);
  if (!hasH1) {
    const heading = headlineText || title;
    if (heading) markdown = `# ${escapeText(heading).replace(/\s*\n\s*/g, ' ')}\n\n${markdown}`;
  }

  return {
    markdown: markdown.trim(),
    html,
    title,
    description,
    siteName,
    author: norm(author),
    published: norm(published),
    canonical,
    lang,
    mode,
    headline: headlineText,
    trace,
  };
}
