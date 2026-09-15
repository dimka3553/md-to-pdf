'use client';

import { EditorSelection } from '@codemirror/state';

/** Wrap (or unwrap) each selection range with inline markers, e.g. ** for bold. */
export function toggleInline(view, before, after = before, placeholder = 'text') {
  const { state } = view;
  view.dispatch(
    state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const pre = state.sliceDoc(Math.max(0, range.from - before.length), range.from);
      const post = state.sliceDoc(range.to, range.to + after.length);

      if (pre === before && post === after) {
        return {
          changes: [
            { from: range.from - before.length, to: range.from },
            { from: range.to, to: range.to + after.length },
          ],
          range: EditorSelection.range(range.from - before.length, range.to - before.length),
        };
      }
      if (text.startsWith(before) && text.endsWith(after) && text.length >= before.length + after.length) {
        const inner = text.slice(before.length, text.length - after.length);
        return { changes: { from: range.from, to: range.to, insert: inner }, range: EditorSelection.range(range.from, range.from + inner.length) };
      }
      const content = text || placeholder;
      const insert = before + content + after;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + content.length),
      };
    }),
  );
  view.focus();
}

function selectedLines(state, range) {
  const start = state.doc.lineAt(range.from);
  const end = state.doc.lineAt(range.to);
  const lines = [];
  for (let n = start.number; n <= end.number; n++) lines.push(state.doc.line(n));
  return lines;
}

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/;
const HEADING_RE = /^(#{1,6})\s+/;
const QUOTE_RE = /^>\s?/;

/** Toggle a block prefix ("- ", "1. ", "- [ ] ", "> ") on every selected line. */
export function toggleLinePrefix(view, kind) {
  const { state } = view;
  const changes = [];
  const seen = new Set();

  for (const range of state.selection.ranges) {
    const lines = selectedLines(state, range);
    const allHave = lines.every((l) => lineHas(l.text, kind));
    lines.forEach((line, i) => {
      if (seen.has(line.number)) return;
      seen.add(line.number);
      let text = line.text;
      if (allHave) {
        text = strip(text, kind);
      } else {
        text = strip(text, 'any');
        text = prefixFor(kind, i) + text;
      }
      changes.push({ from: line.from, to: line.to, insert: text });
    });
  }
  view.dispatch({ changes, scrollIntoView: true });
  view.focus();
}

function lineHas(text, kind) {
  if (kind === 'quote') return QUOTE_RE.test(text);
  const m = text.match(LIST_RE);
  if (!m) return false;
  if (kind === 'bullet') return /^[-*+]$/.test(m[2]) && !m[3];
  if (kind === 'ordered') return /\d/.test(m[2]);
  if (kind === 'task') return !!m[3];
  return false;
}

function strip(text, kind) {
  if (kind === 'quote') return text.replace(QUOTE_RE, '');
  if (kind === 'any') return text.replace(LIST_RE, '$1').replace(QUOTE_RE, '');
  return text.replace(LIST_RE, '$1');
}

function prefixFor(kind, index) {
  switch (kind) {
    case 'bullet':
      return '- ';
    case 'ordered':
      return `${index + 1}. `;
    case 'task':
      return '- [ ] ';
    case 'quote':
      return '> ';
    default:
      return '';
  }
}

/** Set (or clear, when level is 0 or already set) the heading level of selected lines. */
export function setHeading(view, level) {
  const { state } = view;
  const changes = [];
  const seen = new Set();
  for (const range of state.selection.ranges) {
    for (const line of selectedLines(state, range)) {
      if (seen.has(line.number)) continue;
      seen.add(line.number);
      const m = line.text.match(HEADING_RE);
      const current = m ? m[1].length : 0;
      const body = line.text.replace(HEADING_RE, '');
      const next = current === level || level === 0 ? body : `${'#'.repeat(level)} ${body}`;
      changes.push({ from: line.from, to: line.to, insert: next });
    }
  }
  view.dispatch({ changes });
  view.focus();
}

/** Insert a block of text on its own paragraph, keeping blank lines around it. */
export function insertBlock(view, text, { selectFrom, selectTo } = {}) {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  const prevBlank = line.number === 1 || state.doc.line(line.number - 1).text.trim() === '';
  const nextBlank = line.number === state.doc.lines || state.doc.line(line.number + 1).text.trim() === '';
  const atEmptyLine = line.text.trim() === '';

  let from;
  let insert;
  if (atEmptyLine) {
    from = line.from;
    insert = `${prevBlank ? '' : '\n'}${text}${nextBlank ? '' : '\n'}`;
    view.dispatch({ changes: { from, to: line.to, insert } });
  } else {
    from = line.to;
    insert = `\n\n${text}${nextBlank ? '' : '\n'}`;
    view.dispatch({ changes: { from, insert } });
  }
  const offset = from + insert.indexOf(text);
  const selFrom = selectFrom !== undefined ? offset + selectFrom : offset + text.length;
  const selTo = selectTo !== undefined ? offset + selectTo : selFrom;
  view.dispatch({ selection: EditorSelection.single(selFrom, selTo), scrollIntoView: true });
  view.focus();
}

export function insertLink(view, url = 'https://') {
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to) || 'link text';
  const insert = `[${text}](${url})`;
  const urlStart = range.from + text.length + 3;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.single(urlStart, urlStart + url.length),
  });
  view.focus();
}

export function insertImage(view, src, alt = 'image') {
  const { state } = view;
  const range = state.selection.main;
  const insert = `![${alt}](${src})`;
  const line = state.doc.lineAt(range.from);
  if (line.text.trim() === '') {
    insertBlock(view, insert);
  } else {
    view.dispatch({ changes: { from: range.from, to: range.to, insert }, selection: EditorSelection.cursor(range.from + insert.length) });
    view.focus();
  }
}

export function insertTable(view, rows = 3, cols = 3) {
  const header = `| ${Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ')} |`;
  const divider = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  const body = Array.from({ length: rows - 1 }, () => `| ${Array.from({ length: cols }, () => '   ').join(' | ')} |`).join('\n');
  insertBlock(view, `${header}\n${divider}\n${body}`, { selectFrom: 2, selectTo: 2 + 'Column 1'.length });
}

export function insertCodeBlock(view, lang = '') {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const text = `\`\`\`${lang}\n${selected || ''}\n\`\`\``;
  if (selected) {
    view.dispatch({ changes: { from: range.from, to: range.to, insert: text } });
    view.focus();
  } else {
    insertBlock(view, text, { selectFrom: 4 + lang.length, selectTo: 4 + lang.length });
  }
}

export function insertHorizontalRule(view) {
  insertBlock(view, '---');
}

export function insertPageBreak(view) {
  insertBlock(view, '\\pagebreak');
}

export function insertCallout(view, kind = 'NOTE') {
  insertBlock(view, `> [!${kind}]\n> `, { selectFrom: kind.length + 8, selectTo: kind.length + 8 });
}

export function insertFootnote(view) {
  const { state } = view;
  const count = (state.doc.toString().match(/\[\^\w+\]:/g) || []).length + 1;
  const range = state.selection.main;
  view.dispatch({ changes: { from: range.to, insert: `[^${count}]` } });
  const endPos = view.state.doc.length;
  const def = `\n\n[^${count}]: `;
  view.dispatch({ changes: { from: endPos, insert: def }, selection: EditorSelection.cursor(endPos + def.length), scrollIntoView: true });
  view.focus();
}

/** Replace the whole document, keeping undo history. */
export function replaceDocument(view, text) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: EditorSelection.cursor(0), scrollIntoView: true });
}
