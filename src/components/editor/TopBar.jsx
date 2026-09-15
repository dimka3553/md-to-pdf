'use client';

import { useEffect, useRef, useState } from 'react';
import * as I from '../icons';
import { Button, IconButton, Segmented, cx } from '../ui';

function FileMenu({ actions, isMac }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mod = isMac ? '⌘' : 'Ctrl';
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const Item = ({ icon, label, shortcut, onClick, danger }) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => { setOpen(false); onClick(); }}
      className={cx('flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800', danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}
    >
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="font-mono text-[10px] text-gray-400">{shortcut}</span>}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        File <I.ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && (
        <div role="menu" className="pop-in absolute top-full left-0 z-50 mt-1 w-60 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <Item icon={<I.Sparkles className="h-4 w-4" />} label="New from template…" onClick={actions.templates} />
          <Item icon={<I.Upload className="h-4 w-4" />} label="Open Markdown file…" shortcut={`${mod}O`} onClick={actions.open} />
          <Item icon={<I.Globe className="h-4 w-4" />} label="Import from URL…" onClick={actions.importUrl} />
          <Item icon={<I.Image className="h-4 w-4" />} label="Manage images…" onClick={actions.images} />
          <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
          <Item icon={<I.FileText className="h-4 w-4" />} label="Download Markdown" shortcut={`${mod}S`} onClick={actions.downloadMd} />
          <Item icon={<I.Copy className="h-4 w-4" />} label="Copy as HTML" onClick={actions.copyHtml} />
          <Item icon={<I.FilePdf className="h-4 w-4" />} label="Export PDF" shortcut={`${mod}⇧E`} onClick={actions.exportPdf} />
          <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
          <Item icon={<I.Keyboard className="h-4 w-4" />} label="Keyboard shortcuts" shortcut="?" onClick={actions.shortcuts} />
          <Item icon={<I.Trash className="h-4 w-4" />} label="Clear document" onClick={actions.clear} danger />
        </div>
      )}
    </div>
  );
}

function FileName({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const base = draft.trim().replace(/\.md$/i, '').replace(/[\\/:*?"<>|]/g, '-') || 'document';
    onChange(`${base}.md`);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className="h-7 w-48 rounded-md border border-brand-400 bg-white px-2 text-sm text-gray-900 outline-none ring-2 ring-brand-500/30 dark:bg-gray-800 dark:text-gray-100"
        aria-label="File name"
      />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="group flex h-7 max-w-[240px] items-center gap-1.5 rounded-md px-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800" title="Rename">
      <span className="truncate">{value}</span>
      <I.Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}

export default function TopBar({ fileName, onFileNameChange, actions, viewMode, onViewModeChange, panelOpen, onTogglePanel, uiDark, onToggleUiTheme, exporting, saved, isMac, compact }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 dark:border-gray-800 dark:bg-gray-900 sm:px-3">
      <div className="flex min-w-0 items-center gap-1">
        <a href="/" className="mr-1 flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Markdown Studio">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[11px] font-black text-white">M↓</span>
          <span className="hidden text-sm font-semibold text-gray-900 lg:inline dark:text-gray-100">Markdown Studio</span>
        </a>
        <FileMenu actions={actions} isMac={isMac} />
        <span className="hidden h-5 w-px bg-gray-200 sm:inline dark:bg-gray-700" />
        <div className="hidden sm:block">
          <FileName value={fileName} onChange={onFileNameChange} />
        </div>
        <span className={cx('hidden text-[11px] transition-opacity md:inline', saved ? 'text-gray-400' : 'text-amber-600')} aria-live="polite">
          {saved ? 'Saved' : 'Saving…'}
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <IconButton label={panelOpen ? 'Hide design panel (⌘⇧D)' : 'Show design panel (⌘⇧D)'} active={panelOpen} onClick={onTogglePanel}>
          <I.Palette />
        </IconButton>
        <Segmented
          size="sm"
          value={viewMode}
          onChange={onViewModeChange}
          options={
            compact
              ? [
                  { value: 'editor', icon: <I.Pencil className="h-3.5 w-3.5" />, title: 'Editor' },
                  { value: 'preview', icon: <I.Eye className="h-3.5 w-3.5" />, title: 'Preview' },
                ]
              : [
                  { value: 'editor', icon: <I.Pencil className="h-3.5 w-3.5" />, title: 'Editor only' },
                  { value: 'split', icon: <I.Columns className="h-3.5 w-3.5" />, title: 'Split view' },
                  { value: 'preview', icon: <I.Eye className="h-3.5 w-3.5" />, title: 'Preview only' },
                ]
          }
        />
        <IconButton label={uiDark ? 'Switch to light interface' : 'Switch to dark interface'} onClick={onToggleUiTheme}>
          {uiDark ? <I.Sun /> : <I.Moon />}
        </IconButton>
        <Button variant="primary" size="sm" onClick={actions.exportPdf} disabled={exporting} className="ml-1">
          {exporting ? <I.Spinner className="h-3.5 w-3.5" /> : <I.Download className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export PDF'}</span>
        </Button>
      </div>
    </header>
  );
}
