import { stripNewpageIal } from './pageBreaks.js';

export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Convert #rrggbb / #rgb to "r, g, b" for use inside rgba(). */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '0, 0, 0';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function formatDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** Derive a document title from the first H1 in the markdown, falling back to the file name. */
export function inferTitle(markdown, fallback = 'Document') {
  const m = (markdown || '').match(/^\s*#\s+(.+?)\s*#*\s*$/m);
  if (!m) return fallback;
  return stripNewpageIal(m[1].replace(/[*_`]/g, '')).trim() || fallback;
}
