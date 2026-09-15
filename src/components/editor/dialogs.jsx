'use client';

import { useState } from 'react';
import * as I from '../icons';
import { Button, Dialog, Input, Kbd, cx } from '../ui';
import { TEMPLATES } from '@/lib/templates';
import { fetchImport, normalizeUrl } from '@/lib/client/scraper';

export function ImportUrlDialog({ open, onClose, onImport }) {
  const [url, setUrl] = useState('');
  const [replace, setReplace] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!url.trim()) return;
    let target;
    try {
      target = normalizeUrl(url);
    } catch (err) {
      setError(err.message);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchImport({ url: target, format: 'markdown' });
      onImport({ markdown: data.page.content, title: data.page.title, url: target, replace });
      setUrl('');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not import this page.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import from a web page"
      description="We fetch the page, strip navigation and ads, and convert the main content to Markdown."
      footer={
        <>
          <a href={url.trim() ? `/scraper?url=${encodeURIComponent(url.trim())}` : '/scraper'} className="mr-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600">
            More options <I.ExternalLink className="h-3 w-3" />
          </a>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={loading || !url.trim()}>
            {loading ? <I.Spinner className="h-4 w-4" /> : <I.Globe className="h-4 w-4" />}
            {loading ? 'Importing…' : 'Import'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" autoFocus disabled={loading} aria-label="URL" />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={replace} onChange={() => setReplace(true)} className="accent-brand-600" /> Replace document</label>
          <label className="flex items-center gap-2"><input type="radio" checked={!replace} onChange={() => setReplace(false)} className="accent-brand-600" /> Append to end</label>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">{error}</p>}
      </form>
    </Dialog>
  );
}

export function TemplatesDialog({ open, onClose, onPick, dirty }) {
  const [selected, setSelected] = useState(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start from a template"
      description={dirty ? 'Your current document will be replaced. It stays in your undo history.' : 'Pick a starting point — you can change everything afterwards.'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selected} onClick={() => { onPick(selected); onClose(); }}>Use template</Button>
        </>
      }
    >
      <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            onDoubleClick={() => { onPick(t.id); onClose(); }}
            className={cx(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
              selected === t.id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60',
            )}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800">
              <I.FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export function ShortcutsDialog({ open, onClose, isMac }) {
  const mod = isMac ? '⌘' : 'Ctrl';
  const rows = [
    ['Bold', [mod, 'B']],
    ['Italic', [mod, 'I']],
    ['Inline code', [mod, 'E']],
    ['Strikethrough', [mod, '⇧', 'X']],
    ['Link', [mod, 'K']],
    ['Heading 1 / 2 / 3', [mod, '⌥', '1–3']],
    ['Bulleted list', [mod, '⇧', '8']],
    ['Numbered list', [mod, '⇧', '7']],
    ['Task list', [mod, '⇧', '9']],
    ['Quote', [mod, '⇧', '.']],
    ['Find', [mod, 'F']],
    ['Save Markdown', [mod, 'S']],
    ['Export PDF', [mod, '⇧', 'E']],
    ['Toggle design panel', [mod, '⇧', 'D']],
    ['Toggle preview', [mod, '⇧', 'P']],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" width="max-w-md">
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-gray-700 dark:text-gray-300">{label}</span>
            <span className="flex items-center gap-1">
              {keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function ImagesDialog({ open, onClose, assets, onInsert, onRemove, onUpload }) {
  const entries = Object.entries(assets);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Images"
      description="Embedded images travel with the document. Reference them as ![alt](asset:name)."
      footer={
        <>
          <label className="inline-flex">
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onUpload(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              <I.Upload className="h-4 w-4" /> Upload
            </span>
          </label>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </>
      }
    >
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No images yet. Upload one, or paste / drop an image into the editor.</p>
      ) : (
        <ul className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {entries.map(([name, dataUrl]) => (
            <li key={name} className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="checker flex h-24 items-center justify-center">
                <img src={dataUrl} alt={name} className="max-h-24 max-w-full object-contain" />
              </div>
              <div className="truncate px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300" title={name}>{name}</div>
              <div className="absolute inset-x-0 bottom-6 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="primary" onClick={() => { onInsert(name); onClose(); }}>Insert</Button>
                <Button size="sm" variant="danger" onClick={() => onRemove(name)} aria-label={`Remove ${name}`}><I.Trash className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
