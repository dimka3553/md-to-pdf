'use client';

/**
 * Client-side helpers shared by the /scraper page and the editor:
 * fetching an import, remembering recent imports and handing a document
 * over to the editor through localStorage (URLs are too short for that).
 */

export const HANDOFF_KEY = 'md2pdf:handoff:v1';
export const RECENT_KEY = 'md2pdf:scraper:recent:v1';
const RECENT_MAX = 8;

/** Accepts "example.com/x" or a full URL; returns a normalised https URL or throws. */
export function normalizeUrl(input) {
  let target = String(input || '').trim();
  if (!target) throw new Error('Enter a URL to fetch.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) target = `https://${target}`;
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http(s) pages can be imported.');
  return parsed.toString();
}

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Safe base file name (no extension) for an imported page. */
export function fileNameFor(title, url) {
  const base = (title || hostnameOf(url)).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);
  return base || 'imported';
}

/**
 * Call the scrape API.
 * @param {{ url: string, format: 'markdown'|'html', keepImages?: boolean, keepLinks?: boolean, signal?: AbortSignal }} args
 */
export async function fetchImport({ url, format, keepImages = true, keepLinks = true, signal }) {
  const endpoint = format === 'html' ? '/api/scrapehtml' : '/api/scrape';
  const params = new URLSearchParams({ url, images: String(keepImages), links: String(keepLinks) });
  const res = await fetch(`${endpoint}?${params}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'Ok') {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---- Handoff to the editor -----------------------------------------------------------------

/** Stage a document for the editor; the editor consumes and clears it on load. */
export function stageHandoff({ markdown, fileName, mode = 'replace', source }) {
  try {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify({ markdown, fileName, mode, source, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** Read and remove a staged document. Returns null when there is none or it is stale (> 10 min). */
export function takeHandoff() {
  try {
    const raw = window.localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(HANDOFF_KEY);
    const v = JSON.parse(raw);
    if (!v || typeof v.markdown !== 'string' || !v.markdown.trim()) return null;
    if (Date.now() - (v.at || 0) > 10 * 60 * 1000) return null;
    return {
      markdown: v.markdown,
      fileName: typeof v.fileName === 'string' && v.fileName.trim() ? v.fileName : 'imported.md',
      mode: v.mode === 'append' ? 'append' : 'replace',
      source: v.source && typeof v.source === 'object' ? v.source : null,
    };
  } catch {
    return null;
  }
}

// ---- Recent imports -------------------------------------------------------------------------

export function loadRecent() {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((r) => r && typeof r.url === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry) {
  const list = [{ ...entry, at: Date.now() }, ...loadRecent().filter((r) => r.url !== entry.url)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
  return list;
}

export function clearRecent() {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
