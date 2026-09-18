import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';
import markedAlert from 'marked-alert';
import GithubSlugger from 'github-slugger';
import hljs from 'highlight.js/lib/common';
import twemoji from 'twemoji';
import { escapeHtml } from './utils.js';
import { hasNewpageIal, PAGE_BREAK_BLOCK_RE, rewriteNewpageIals, stripNewpageIal } from './pageBreaks.js';

const LANG_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  md: 'markdown',
  html: 'xml',
  vue: 'xml',
  svelte: 'xml',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  ps1: 'powershell',
  dockerfile: 'dockerfile',
  plaintext: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
};

function highlight(code, lang) {
  const normalized = LANG_ALIASES[lang] || lang;
  if (normalized && hljs.getLanguage(normalized)) {
    try {
      return { html: hljs.highlight(code, { language: normalized, ignoreIllegals: true }).value, lang: normalized };
    } catch {
      /* fall through */
    }
  }
  if (!lang && code.length > 20 && code.length < 20000) {
    try {
      const auto = hljs.highlightAuto(code, ['javascript', 'typescript', 'python', 'bash', 'json', 'xml', 'css', 'sql', 'go', 'rust', 'java']);
      if (auto.relevance >= 8) return { html: auto.value, lang: auto.language || '' };
    } catch {
      /* fall through */
    }
  }
  return { html: escapeHtml(code), lang: normalized || '' };
}

/**
 * Parse a fenced-code info string like ```ts title="src/index.ts" or ```js:app.js
 * into { lang, title }.
 */
function parseInfo(info) {
  const raw = (info || '').trim();
  if (!raw) return { lang: '', title: '' };
  const titleMatch = raw.match(/title=("([^"]*)"|'([^']*)'|(\S+))/);
  let title = titleMatch ? titleMatch[2] ?? titleMatch[3] ?? titleMatch[4] : '';
  let lang = raw.replace(/title=("[^"]*"|'[^']*'|\S+)/, '').trim().split(/\s+/)[0] || '';
  if (!title && lang.includes(':')) {
    const [l, ...rest] = lang.split(':');
    lang = l;
    title = rest.join(':');
  }
  return { lang: lang.toLowerCase(), title };
}

function isBlankTableHeader(header) {
  return (header || []).every((cell) => {
    if (String(cell?.text || '').replace(/&nbsp;/gi, ' ').trim()) return false;
    return !(cell.tokens || []).some((t) => t.type === 'image' || (t.type === 'html' && /<img\b/i.test(t.text || t.raw || '')));
  });
}

/**
 * Build a Marked instance. A fresh instance per document keeps heading-id
 * slugs and footnote counters isolated between renders.
 *
 * @param {{ assets?: Record<string,string>, headingNumbers?: boolean }} opts
 */
export function createParser(opts = {}) {
  const assets = opts.assets || {};
  const counters = [0, 0, 0, 0, 0, 0];
  // GitHub-style heading ids (used by the table of contents and in-document links).
  // A fresh slugger per parser keeps duplicate-heading suffixes (-1, -2) isolated per document.
  const slugger = new GithubSlugger();

  const marked = new Marked(
    markedAlert(),
    markedFootnote({ footnoteDivider: true, description: 'Footnotes' }),
  );

  marked.use({
    gfm: true,
    breaks: false,
    extensions: [{
      name: 'pageBreak',
      level: 'block',
      tokenizer(src) {
        const match = PAGE_BREAK_BLOCK_RE.exec(src);
        if (match) return { type: 'pageBreak', raw: match[0] };
      },
      renderer() { return '<div class="page-break"></div>\n'; },
    }],
    renderer: {
      code({ text, lang: info }) {
        const { lang, title } = parseInfo(info);
        const source = text.replace(/\n$/, '');

        if (lang === 'mermaid') {
          return `<figure class="diagram"><pre class="mermaid">${escapeHtml(source)}</pre>${
            title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''
          }</figure>\n`;
        }

        const { html, lang: resolved } = highlight(source, lang);
        const label = title || (resolved && resolved !== 'plaintext' ? resolved : '');
        const lines = source.split('\n').length;
        return `<div class="code-block${label ? ' has-title' : ''}" data-lines="${lines}">${
          label ? `<div class="code-title"><span>${escapeHtml(label)}</span></div>` : ''
        }<pre><code class="hljs${resolved ? ` language-${escapeHtml(resolved)}` : ''}">${html}\n</code></pre></div>\n`;
      },

      heading({ tokens, depth }) {
        let inner = this.parser.parseInline(tokens);
        const newpage = hasNewpageIal(inner.replace(/<[^>]+>/g, ''));
        if (newpage) inner = stripNewpageIal(inner);
        const plain = inner.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|#039);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'" })[e]);
        const id = slugger.slug(plain.trim().toLowerCase()) || `section-${depth}`;
        let prefix = '';
        if (opts.headingNumbers && depth <= 3) {
          counters[depth - 1] += 1;
          for (let i = depth; i < counters.length; i++) counters[i] = 0;
          prefix = `<span class="heading-number">${counters.slice(0, depth).join('.')}</span> `;
        }
        const marker = newpage ? '<div class="page-break"></div>\n' : '';
        return `${marker}<h${depth} id="${escapeHtml(id)}">${prefix}${inner}</h${depth}>\n`;
      },

      image({ href, title, text }) {
        let src = href || '';
        if (src.startsWith('asset:')) {
          const key = decodeURIComponent(src.slice('asset:'.length));
          src = assets[key] || '';
          if (!src) {
            return `<span class="missing-asset">Missing image: ${escapeHtml(key)}</span>`;
          }
        }
        // Support "=WIDTHxHEIGHT" or "=WIDTH" size hints after a space in the URL: ![alt](img.png =300x)
        let sizeStyle = '';
        const sizeMatch = src.match(/\s=(\d+)?x?(\d+)?$/);
        if (sizeMatch) {
          src = src.replace(/\s=(\d+)?x?(\d+)?$/, '');
          const w = sizeMatch[1] ? `width:${sizeMatch[1]}px;` : '';
          const h = sizeMatch[2] ? `height:${sizeMatch[2]}px;` : '';
          sizeStyle = ` style="${w}${h}"`;
        }
        const alt = escapeHtml(text || '');
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(src)}" alt="${alt}"${t}${sizeStyle} loading="eager">`;
      },

      listitem(item) {
          const content = this.parser.parse(item.tokens, !!item.loose);
          if (!item.task) return `<li>${content}</li>\n`;
          return `<li class="task-item${item.checked ? ' done' : ''}"><span class="task-box" role="img" aria-label="${item.checked ? 'done' : 'to do'}"></span><div class="task-body">${content}</div></li>\n`;
      },

      checkbox() {
        return '';
      },

      table(token) {
        const blankHeader = isBlankTableHeader(token.header);
        let header = '';
        if (!blankHeader) {
          for (const cell of token.header) header += this.tablecell(cell);
          header = `<thead><tr>${header}</tr></thead>`;
        }
        let body = '';
        token.rows.forEach((row, i) => {
          let cells = '';
          for (const cell of row) cells += this.tablecell(cell);
          body += `<tr${i % 2 === 1 ? ' class="alt"' : ''}>${cells}</tr>`;
        });
        const cols = token.header.length;
        return `<div class="table-wrap"><table data-cols="${cols}"${blankHeader ? ' class="no-header"' : ''}>${header}${
          body ? `<tbody>${body}</tbody>` : ''
        }</table></div>\n`;
      },

      paragraph({ tokens }) {
        const inner = this.parser.parseInline(tokens);
        // Standalone image → figure, with optional *caption* on the next line.
        const m = inner.match(/^(<img[^>]*>)(?:\s*<br>\s*|\s*)(<em>(.*?)<\/em>)?\s*$/s);
        if (m) {
          return `<figure>${m[1]}${m[3] ? `<figcaption>${m[3]}</figcaption>` : ''}</figure>\n`;
        }
        return `<p>${inner}</p>\n`;
      },
    },
  });

  return marked;
}

/**
 * Convert markdown to a fragment of HTML.
 * @param {string} markdown
 * @param {{ assets?: Record<string,string>, headingNumbers?: boolean, emoji?: boolean }} opts
 */
export function markdownToHtml(markdown, opts = {}) {
  const parser = createParser(opts);
  let html = parser.parse(rewriteNewpageIals(markdown || ''), { async: false });

  if (opts.emoji !== false) {
    html = twemoji.parse(html, {
      folder: 'svg',
      ext: '.svg',
      base: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/',
      className: 'emoji',
      attributes: () => ({ loading: 'eager' }),
    });
  }

  return html;
}

/** Extract headings (h1–h3) with their ids for a table of contents. */
export function extractHeadings(html, maxDepth = 3) {
  const out = [];
  const re = /<h([1-6])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    const depth = Number(m[1]);
    if (depth > maxDepth || m[2] === 'footnote-label') continue;
    const text = m[3]
      .replace(/<span class="heading-number">.*?<\/span>\s*/g, '')
      .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text) out.push({ depth, id: m[2], text });
  }
  return out;
}

/** Plain-text stats for the editor status bar. */
export function textStats(markdown) {
  const text = (markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>\-\[\]()!|]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = (markdown || '').length;
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, chars, minutes };
}
