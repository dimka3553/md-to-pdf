'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, keymap, drawSelection, highlightActiveLine, dropCursor, placeholder as cmPlaceholder } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { toggleInline, insertLink, toggleLinePrefix, setHeading } from '@/lib/client/editorCommands';

function buildTheme(dark) {
  const c = dark
    ? { bg: '#0f172a', fg: '#e2e8f0', muted: '#64748b', accent: '#60a5fa', selection: 'rgba(96,165,250,.25)', active: 'rgba(148,163,184,.06)', gutter: '#475569', heading: '#f8fafc', code: '#fbbf24', link: '#93c5fd', quote: '#94a3b8', mark: '#a78bfa' }
    : { bg: '#ffffff', fg: '#1f2937', muted: '#9ca3af', accent: '#2553eb', selection: 'rgba(37,83,235,.15)', active: 'rgba(17,24,39,.03)', gutter: '#c4c9d2', heading: '#111827', code: '#b45309', link: '#1d4ed8', quote: '#6b7280', mark: '#7c3aed' };

  const theme = EditorView.theme(
    {
      '&': { backgroundColor: c.bg, color: c.fg, fontSize: '14px', height: '100%' },
      '.cm-scroller': { fontFamily: "'JetBrains Mono', var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: '1.7' },
      '.cm-content': { caretColor: c.accent },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: c.accent, borderLeftWidth: '2px' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: c.selection },
      '.cm-activeLine': { backgroundColor: c.active },
      '.cm-gutters': { backgroundColor: c.bg, color: c.gutter, border: 'none', fontSize: '11px' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: c.fg },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 16px', minWidth: '40px' },
      '.cm-placeholder': { color: c.muted, fontStyle: 'italic' },
      '.cm-tooltip': { backgroundColor: c.bg, border: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}`, borderRadius: '8px' },
      '.cm-panels': { backgroundColor: dark ? '#111827' : '#f9fafb', color: c.fg, borderColor: dark ? '#1f2937' : '#e5e7eb' },
      '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${dark ? '#1f2937' : '#e5e7eb'}` },
      '.cm-panel.cm-search': { padding: '6px 10px', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', fontSize: '12px' },
      '.cm-panel.cm-search input, .cm-panel.cm-search button': { borderRadius: '6px', border: `1px solid ${dark ? '#374151' : '#d1d5db'}`, backgroundColor: dark ? '#1f2937' : '#fff', color: c.fg, padding: '2px 8px', fontSize: '12px', margin: '0 2px' },
      '.cm-panel.cm-search button:hover': { backgroundColor: dark ? '#374151' : '#f3f4f6' },
      '.cm-panel.cm-search label': { fontSize: '12px', marginLeft: '6px' },
      '.cm-searchMatch': { backgroundColor: dark ? 'rgba(250,204,21,.25)' : 'rgba(250,204,21,.45)', outline: '1px solid rgba(250,204,21,.6)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: dark ? 'rgba(96,165,250,.4)' : 'rgba(37,83,235,.3)' },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: tags.heading1, color: c.heading, fontWeight: '700', fontSize: '1.45em', lineHeight: '1.3' },
    { tag: tags.heading2, color: c.heading, fontWeight: '700', fontSize: '1.25em' },
    { tag: tags.heading3, color: c.heading, fontWeight: '700', fontSize: '1.1em' },
    { tag: [tags.heading4, tags.heading5, tags.heading6], color: c.heading, fontWeight: '700' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through', color: c.quote },
    { tag: tags.link, color: c.link },
    { tag: tags.url, color: c.link, textDecoration: 'underline', textDecorationColor: c.selection },
    { tag: tags.monospace, color: c.code },
    { tag: tags.quote, color: c.quote, fontStyle: 'italic' },
    { tag: tags.list, color: c.accent },
    { tag: tags.processingInstruction, color: c.muted },
    { tag: tags.meta, color: c.muted },
    { tag: tags.contentSeparator, color: c.muted },
    { tag: tags.labelName, color: c.mark },
    { tag: tags.comment, color: c.muted, fontStyle: 'italic' },
    { tag: tags.keyword, color: c.mark },
    { tag: tags.string, color: dark ? '#86efac' : '#15803d' },
    { tag: [tags.number, tags.bool], color: dark ? '#f9a8d4' : '#be185d' },
    { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: c.link },
    { tag: tags.typeName, color: c.code },
    { tag: tags.propertyName, color: dark ? '#7dd3fc' : '#0369a1' },
  ]);

  return [theme, syntaxHighlighting(highlight)];
}

export default function MarkdownEditor({ value, onChange, dark, onReady, placeholder, onPasteFiles, onDropFiles }) {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
      history(),
      drawSelection(),
      dropCursor(),
      highlightActiveLine(),
      EditorView.lineWrapping,
      ...buildTheme(dark),
      cmPlaceholder(placeholder || 'Start writing…'),
      keymap.of([
        { key: 'Mod-b', run: (v) => (toggleInline(v, '**'), true) },
        { key: 'Mod-i', run: (v) => (toggleInline(v, '*'), true) },
        { key: 'Mod-e', run: (v) => (toggleInline(v, '`', '`', 'code'), true) },
        { key: 'Mod-Shift-x', run: (v) => (toggleInline(v, '~~'), true) },
        { key: 'Mod-k', run: (v) => (insertLink(v), true) },
        { key: 'Mod-Shift-8', run: (v) => (toggleLinePrefix(v, 'bullet'), true) },
        { key: 'Mod-Shift-7', run: (v) => (toggleLinePrefix(v, 'ordered'), true) },
        { key: 'Mod-Shift-9', run: (v) => (toggleLinePrefix(v, 'task'), true) },
        { key: 'Mod-Shift-.', run: (v) => (toggleLinePrefix(v, 'quote'), true) },
        { key: 'Mod-Alt-1', run: (v) => (setHeading(v, 1), true) },
        { key: 'Mod-Alt-2', run: (v) => (setHeading(v, 2), true) },
        { key: 'Mod-Alt-3', run: (v) => (setHeading(v, 3), true) },
        { key: 'Mod-Alt-0', run: (v) => (setHeading(v, 0), true) },
        indentWithTab,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.domEventHandlers({
        paste(event) {
          const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
          if (files.length && onPasteFiles) {
            event.preventDefault();
            onPasteFiles(files);
            return true;
          }
          return false;
        },
        drop(event) {
          const files = Array.from(event.dataTransfer?.files || []);
          if (files.length && onDropFiles) {
            event.preventDefault();
            onDropFiles(files);
            return true;
          }
          return false;
        },
      }),
    ],
    [dark, placeholder, onPasteFiles, onDropFiles],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: true,
        bracketMatching: false,
        closeBrackets: false,
        autocompletion: false,
        indentOnInput: false,
        defaultKeymap: false,
        historyKeymap: false,
        searchKeymap: true,
        drawSelection: false,
        dropCursor: false,
        allowMultipleSelections: true,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: false,
        history: false,
      }}
      onCreateEditor={onReady}
      height="100%"
      className="h-full"
      aria-label="Markdown source"
    />
  );
}
