/** Kramdown IAL that starts a new page, e.g. `{: .newpage }` or `{:.pagebreak}`. */
export const NEWPAGE_IAL_RE = /\s*\{:\s*(?:[^\n{}]*?\s)?\.(?:newpage|page-break|pagebreak)\b[^\n{}]*\}\s*$/i;

const PAGE_BREAK_MARKER = String.raw`\\(?:pagebreak|newpage)|<!--\s*(?:pagebreak|page-break|newpage)\s*-->|---pagebreak---|\{:\s*(?:[^\n{}]*?\s)?\.(?:newpage|page-break|pagebreak)\b[^\n{}]*\}`;

export const PAGE_BREAK_BLOCK_RE = new RegExp(
  String.raw`^(?: {0,3})(?:${PAGE_BREAK_MARKER})[\t ]*(?:\n[\t ]*\n|\n?$)`,
  'i',
);

/** True when a source line is a standalone page-break directive (including `{: .newpage }`). */
export const PAGE_BREAK_LINE_RE = new RegExp(
  String.raw`^(?: {0,3})(?:${PAGE_BREAK_MARKER})\s*$`,
  'i',
);

export function stripNewpageIal(text) {
  return String(text || '').replace(NEWPAGE_IAL_RE, '').trimEnd();
}

export function hasNewpageIal(text) {
  return NEWPAGE_IAL_RE.test(String(text || ''));
}

/**
 * Turn kramdown `{: .newpage }` into a `\\pagebreak` before the target block.
 * Same-line and next-line IALs attach to the heading; a blank-separated IAL
 * behaves like a standalone page-break marker.
 */
export function rewriteNewpageIals(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let inFence = null;

  const lastNonEmpty = () => {
    let j = out.length - 1;
    while (j >= 0 && !out[j].trim()) j--;
    return j;
  };

  const pushBreak = () => {
    const j = lastNonEmpty();
    if (j >= 0 && PAGE_BREAK_LINE_RE.test(out[j])) return;
    if (out.length && out[out.length - 1].trim()) out.push('');
    out.push('\\pagebreak');
    out.push('');
  };

  for (const line of lines) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (inFence) {
      if (fence && fence[1][0] === inFence[0] && fence[1].length >= inFence.length && !fence[2].trim()) inFence = null;
      out.push(line);
      continue;
    }
    if (fence) {
      inFence = fence[1];
      out.push(line);
      continue;
    }
    if (/^(?: {4}|\t)/.test(line)) {
      out.push(line);
      continue;
    }

    const heading = line.match(/^(\s{0,3}#{1,6}[ \t]+)(.*)$/);
    if (heading) {
      const text = heading[2].replace(/[ \t]+#*[ \t]*$/, '');
      if (hasNewpageIal(text)) {
        pushBreak();
        out.push(heading[1] + stripNewpageIal(text).trimEnd());
        continue;
      }
    }

    if (PAGE_BREAK_LINE_RE.test(line) && line.includes('{:')) {
      const j = lastNonEmpty();
      const prev = j >= 0 ? out[j] : '';
      const attached = j === out.length - 1 && /^\s{0,3}#{1,6}[ \t]+/.test(prev);
      if (attached) {
        let k = j - 1;
        while (k >= 0 && !out[k].trim()) k--;
        if (!(k >= 0 && PAGE_BREAK_LINE_RE.test(out[k]))) {
          const prefix = j > 0 && out[j - 1].trim() ? [''] : [];
          out.splice(j, 0, ...prefix, '\\pagebreak', '');
        }
        continue;
      }
      pushBreak();
      continue;
    }

    out.push(line);
  }
  return out.join('\n');
}

