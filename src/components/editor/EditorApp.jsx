'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import TopBar from './TopBar';
import FormatToolbar from './FormatToolbar';
import DesignPanel from './DesignPanel';
import PreviewPane from './PreviewPane';
import { ImagesDialog, ImportUrlDialog, ShortcutsDialog, TemplatesDialog } from './dialogs';
import { AddToAgentDialog } from './AddToAgentDialog';
import { ToastProvider, useToast } from '../Toast';
import ErrorBoundary from '../ErrorBoundary';
import * as I from '../icons';
import { cx } from '../ui';
import { DEFAULT_SETTINGS, normalizeSettings } from '@/lib/document/settings';
import { buildDocumentHtml } from '@/lib/document/html';
import { textStats } from '@/lib/document/markdown';
import { WELCOME_DOCUMENT, getTemplate } from '@/lib/templates';
import { useDebouncedValue, useIsMac, useMediaQuery, usePersistentState, useShortcuts } from '@/lib/client/hooks';
import { fileToDataUrl, uniqueAssetName } from '@/lib/client/images';
import { insertImage, replaceDocument } from '@/lib/client/editorCommands';

const MarkdownEditor = dynamic(() => import('./MarkdownEditor'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading editor…</div>,
});

const STORAGE = {
  doc: 'md2pdf:document:v2',
  settings: 'md2pdf:settings:v2',
  assets: 'md2pdf:assets:v2',
  ui: 'md2pdf:ui:v2',
};

const DEFAULT_UI = { dark: false, viewMode: 'split', panelOpen: true, split: 0.5 };

function parseDoc(raw) {
  const v = JSON.parse(raw);
  if (!v || typeof v !== 'object') throw new Error('invalid document');
  return {
    markdown: typeof v.markdown === 'string' ? v.markdown : '',
    fileName: typeof v.fileName === 'string' && v.fileName.trim() ? v.fileName : 'document.md',
  };
}

function parseSettings(raw) {
  return normalizeSettings(JSON.parse(raw));
}

function parseAssets(raw) {
  const v = JSON.parse(raw);
  const out = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) if (typeof val === 'string' && val.startsWith('data:image/')) out[k] = val;
  }
  return out;
}

function parseUi(raw) {
  const v = JSON.parse(raw) || {};
  return {
    dark: !!v.dark,
    viewMode: ['editor', 'split', 'preview'].includes(v.viewMode) ? v.viewMode : DEFAULT_UI.viewMode,
    panelOpen: v.panelOpen !== false,
    split: Number.isFinite(v.split) && v.split >= 0.25 && v.split <= 0.75 ? v.split : DEFAULT_UI.split,
  };
}

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Editor() {
  const toast = useToast();
  const isMac = useIsMac();
  const compact = useMediaQuery('(max-width: 1023px)');

  // Everything read back from storage is validated, so stale data from an older version can't crash the UI.
  const [doc, setDoc, docHydrated] = usePersistentState(STORAGE.doc, { markdown: WELCOME_DOCUMENT, fileName: 'welcome.md' }, { deserialize: parseDoc });
  const [settings, setSettingsRaw, settingsHydrated] = usePersistentState(STORAGE.settings, DEFAULT_SETTINGS, { deserialize: parseSettings });
  const [assets, setAssets] = usePersistentState(STORAGE.assets, {}, { deserialize: parseAssets });
  const [ui, setUi] = usePersistentState(STORAGE.ui, DEFAULT_UI, { deserialize: parseUi });

  const setSettings = useCallback((next) => setSettingsRaw(normalizeSettings(next)), [setSettingsRaw]);
  const { markdown, fileName } = doc;
  const setMarkdown = useCallback((value) => setDoc((d) => (d.markdown === value ? d : { ...d, markdown: value })), [setDoc]);
  const setFileName = useCallback((value) => setDoc((d) => ({ ...d, fileName: value })), [setDoc]);

  const viewRef = useRef(null);
  const imageInput = useRef(null);
  const mdInput = useRef(null);

  const [dialog, setDialog] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [pdf, setPdf] = useState({ url: null, loading: false, error: null, renderedKey: null, pages: null });
  const [pages, setPages] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(true);

  const debouncedMarkdown = useDebouncedValue(markdown, 250);
  const stats = useMemo(() => textStats(debouncedMarkdown), [debouncedMarkdown]);

  const currentKey = useMemo(() => hashString(markdown + JSON.stringify(settings) + Object.keys(assets).join('|')), [markdown, settings, assets]);

  // Apply UI theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!ui.dark);
  }, [ui.dark]);

  // "Saving…" indicator
  useEffect(() => {
    setSaved(false);
    const id = setTimeout(() => setSaved(true), 600);
    return () => clearTimeout(id);
  }, [markdown, settings, assets]);

  // Deep link into the "Add to AI agent" dialog (used from the README / docs): /#add-to-agent
  useEffect(() => {
    const check = () => window.location.hash === '#add-to-agent' && setDialog('agent');
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  // Legacy ?content= parameter from the scraper page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const content = params.get('content');
    if (content) {
      try {
        setDoc((d) => ({ ...d, markdown: decodeURIComponent(content), fileName: 'imported.md' }));
        window.history.replaceState(null, '', window.location.pathname);
        toast.success('Imported content from the scraper.');
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewMode = compact && ui.viewMode === 'split' ? 'editor' : ui.viewMode;
  const showEditor = viewMode !== 'preview';
  const showPreview = viewMode !== 'editor';

  // On narrow screens the design panel is a modal drawer, so it must start closed and
  // its open state is not persisted; on wide screens it is a docked sidebar.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelOpen = compact ? drawerOpen : ui.panelOpen;
  const togglePanel = useCallback(() => {
    if (compact) setDrawerOpen((o) => !o);
    else setUi((u) => ({ ...u, panelOpen: !u.panelOpen }));
  }, [compact, setUi]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // ---- Assets ------------------------------------------------------------------------------
  const addImageFiles = useCallback(
    async (files, { insert = true } = {}) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (!images.length) return;
      let next = { ...assets };
      const added = [];
      for (const file of images) {
        try {
          const { dataUrl, name } = await fileToDataUrl(file);
          const key = uniqueAssetName(name, next);
          next = { ...next, [key]: dataUrl };
          added.push(key);
        } catch (err) {
          toast.error(`Could not add ${file.name}: ${err.message}`);
        }
      }
      setAssets(next);
      if (insert && viewRef.current) {
        for (const key of added) insertImage(viewRef.current, `asset:${key}`, key.replace(/\.[a-z0-9]+$/i, ''));
      }
      if (added.length) toast.success(added.length === 1 ? `Added ${added[0]}` : `Added ${added.length} images`);
    },
    [assets, setAssets, toast],
  );

  const removeAsset = useCallback(
    (name) => {
      setAssets((a) => {
        const next = { ...a };
        delete next[name];
        return next;
      });
    },
    [setAssets],
  );

  const loadMarkdownFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setDoc({ markdown: String(reader.result), fileName: file.name.endsWith('.md') ? file.name : `${file.name}.md` });
        toast.success(`Opened ${file.name}`);
      };
      reader.onerror = () => toast.error('Could not read that file.');
      reader.readAsText(file);
    },
    [setDoc, toast],
  );

  const handleFiles = useCallback(
    (files) => {
      const list = Array.from(files);
      const md = list.find((f) => /\.(md|markdown|txt)$/i.test(f.name) || f.type === 'text/markdown' || f.type === 'text/plain');
      if (md) loadMarkdownFile(md);
      const images = list.filter((f) => f.type.startsWith('image/'));
      if (images.length) addImageFiles(images);
      if (!md && !images.length) toast.error('Drop a Markdown file or an image.');
    },
    [loadMarkdownFile, addImageFiles, toast],
  );

  const handleLogoFile = useCallback(
    async (file) => {
      try {
        const { dataUrl, name, width, height } = await fileToDataUrl(file, { maxSize: 600 });
        const aspect = width && height ? width / height : 1;
        setSettings({ ...settings, logo: { dataUrl, name, aspect, position: settings.logo?.position || 'title-right', size: settings.logo?.size || 'md' } });
        toast.success('Logo added');
      } catch (err) {
        toast.error(err.message);
      }
    },
    [settings, setSettings, toast],
  );

  // ---- PDF -------------------------------------------------------------------------------
  const requestPdf = useCallback(
    async ({ inline }) => {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, settings, assets, fileName, inline }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `The server returned ${res.status}.`);
      }
      return res.blob();
    },
    [markdown, settings, assets, fileName],
  );

  const renderPdfPreview = useCallback(async () => {
    if (!markdown.trim()) {
      toast.info('Write something first.');
      return;
    }
    setPdf((p) => ({ ...p, loading: true, error: null }));
    const key = currentKey;
    try {
      const blob = await requestPdf({ inline: true });
      const url = URL.createObjectURL(blob);
      setPdf((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
        return { url, blob, loading: false, error: null, renderedKey: key, pages: null };
      });
    } catch (err) {
      setPdf((p) => ({ ...p, loading: false, error: err.message }));
    }
  }, [markdown, requestPdf, currentKey, toast]);

  const exportPdf = useCallback(async () => {
    if (!markdown.trim()) {
      toast.info('Write something first.');
      return;
    }
    setExporting(true);
    try {
      const blob = pdf.blob && pdf.renderedKey === currentKey ? pdf.blob : await requestPdf({ inline: false });
      downloadBlob(blob, fileName.replace(/\.md$/i, '') + '.pdf');
      toast.success('PDF exported');
    } catch (err) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, [markdown, pdf, currentKey, requestPdf, fileName, toast]);

  const downloadRenderedPdf = useCallback(() => {
    if (pdf.blob) downloadBlob(pdf.blob, fileName.replace(/\.md$/i, '') + '.pdf');
  }, [pdf.blob, fileName]);

  // ---- Other actions ---------------------------------------------------------------------
  const downloadMarkdown = useCallback(() => {
    downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), fileName);
    toast.success(`Saved ${fileName}`);
  }, [markdown, fileName, toast]);

  const copyHtml = useCallback(async () => {
    try {
      const html = buildDocumentHtml({ markdown, settings, assets, mode: 'pdf' });
      await navigator.clipboard.writeText(html);
      toast.success('HTML copied to clipboard');
    } catch (err) {
      toast.error(err.message || 'Could not copy.');
    }
  }, [markdown, settings, assets, toast]);

  const applyTemplate = useCallback(
    (id) => {
      const t = getTemplate(id);
      if (!t) return;
      setDoc({ markdown: t.markdown, fileName: `${t.id}.md` });
      if (t.settings) setSettings({ ...DEFAULT_SETTINGS, logo: settings.logo, ...t.settings, cover: { ...DEFAULT_SETTINGS.cover, ...(t.settings.cover || {}) }, header: { ...DEFAULT_SETTINGS.header, ...(t.settings.header || {}) }, footer: { ...DEFAULT_SETTINGS.footer, ...(t.settings.footer || {}) } });
      toast.success(`Loaded “${t.name}” template`);
    },
    [setDoc, setSettings, settings.logo, toast],
  );

  const clearDocument = useCallback(() => {
    setDoc({ markdown: '', fileName: 'untitled.md' });
    toast.info('Document cleared', { action: { label: 'Undo', onClick: () => viewRef.current && replaceDocument(viewRef.current, markdown) } });
  }, [setDoc, toast, markdown]);

  const importFromUrl = useCallback(
    ({ markdown: md, title, url, replace }) => {
      const name = (title || new URL(url).hostname).replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
      if (replace) setDoc({ markdown: md, fileName: `${name}.md` });
      else setMarkdown(`${markdown.trimEnd()}\n\n---\n\n${md}`);
      toast.success(`Imported “${title || url}”`);
    },
    [setDoc, setMarkdown, markdown, toast],
  );

  const actions = useMemo(
    () => ({
      templates: () => setDialog('templates'),
      open: () => mdInput.current?.click(),
      importUrl: () => setDialog('import'),
      images: () => setDialog('images'),
      downloadMd: downloadMarkdown,
      copyHtml,
      exportPdf,
      shortcuts: () => setDialog('shortcuts'),
      addToAgent: () => setDialog('agent'),
      clear: clearDocument,
    }),
    [downloadMarkdown, copyHtml, exportPdf, clearDocument],
  );

  useShortcuts({
    s: downloadMarkdown,
    'shift+e': exportPdf,
    'shift+d': togglePanel,
    'shift+p': () => setUi((u) => ({ ...u, viewMode: u.viewMode === 'preview' ? 'split' : u.viewMode === 'split' ? 'editor' : 'split' })),
    o: () => mdInput.current?.click(),
  });

  // ---- Split resizing --------------------------------------------------------------------
  const layoutRef = useRef(null);
  const onResizeStart = (e) => {
    e.preventDefault();
    const el = layoutRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const move = (ev) => {
      const ratio = Math.min(0.75, Math.max(0.25, (ev.clientX - rect.left) / rect.width));
      setUi((u) => ({ ...u, split: ratio }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const hydrated = docHydrated && settingsHydrated;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
    >
      <input ref={mdInput} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadMarkdownFile(f); e.target.value = ''; }} />
      <input ref={imageInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImageFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />

      <TopBar
        fileName={fileName}
        onFileNameChange={setFileName}
        actions={actions}
        viewMode={viewMode}
        onViewModeChange={(m) => setUi((u) => ({ ...u, viewMode: m }))}
        panelOpen={panelOpen}
        onTogglePanel={togglePanel}
        uiDark={!!ui.dark}
        onToggleUiTheme={() => setUi((u) => ({ ...u, dark: !u.dark }))}
        exporting={exporting}
        saved={saved}
        isMac={isMac}
        compact={compact}
      />

      <div ref={layoutRef} className="relative flex min-h-0 flex-1">
        {hydrated && panelOpen && (
          <div className={cx(compact ? 'pop-in absolute inset-y-0 left-0 z-40 w-[320px] max-w-[90vw] shadow-2xl' : 'w-[300px] shrink-0', 'border-r border-gray-200 dark:border-gray-800')}>
            <ErrorBoundary name="design panel">
              <DesignPanel settings={settings} onChange={setSettings} onLogoFile={handleLogoFile} onClose={compact ? closeDrawer : undefined} />
            </ErrorBoundary>
          </div>
        )}
        {hydrated && compact && panelOpen && <div className="fade-in absolute inset-0 z-30 bg-black/30" onClick={closeDrawer} aria-hidden="true" />}

        {showEditor && (
          <div className="flex min-w-0 flex-col bg-white dark:bg-gray-900" style={{ flex: showPreview ? `0 0 ${Math.round(ui.split * 100)}%` : '1 1 0%', minWidth: 0 }}>
            <FormatToolbar viewRef={viewRef} isMac={isMac} onInsertImage={() => (Object.keys(assets).length ? setDialog('images') : imageInput.current?.click())} />
            <div className="relative min-h-0 flex-1">
              {hydrated && (
                <ErrorBoundary name="editor">
                  <MarkdownEditor
                    value={markdown}
                    onChange={setMarkdown}
                    dark={!!ui.dark}
                    onReady={(view) => { viewRef.current = view; }}
                    onPasteFiles={addImageFiles}
                    onDropFiles={handleFiles}
                    placeholder="Start writing Markdown… or drop a .md file here."
                  />
                </ErrorBoundary>
              )}
            </div>
          </div>
        )}

        {showEditor && showPreview && (
          <div role="separator" aria-orientation="vertical" onPointerDown={onResizeStart} className="group relative z-10 w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-brand-400 dark:bg-gray-800 dark:hover:bg-brand-500" title="Drag to resize">
            <span className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {showPreview && (
          <div className="min-w-0 flex-1">
            {hydrated && (
              <ErrorBoundary name="preview">
                <PreviewPane
                  markdown={debouncedMarkdown}
                  settings={settings}
                  assets={assets}
                  fileName={fileName}
                  pdf={{ ...pdf, currentKey }}
                  onRenderPdf={renderPdfPreview}
                  onDownloadPdf={downloadRenderedPdf}
                  onPagesChange={setPages}
                  onClose={compact ? () => setUi((u) => ({ ...u, viewMode: 'editor' })) : undefined}
                />
              </ErrorBoundary>
            )}
          </div>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-brand-600/10 backdrop-blur-[1px]">
            <div className="rounded-xl border-2 border-dashed border-brand-500 bg-white/90 px-6 py-4 text-sm font-medium text-brand-700 shadow-xl dark:bg-gray-900/90 dark:text-brand-300">
              Drop a Markdown file to open it, or images to embed them
            </div>
          </div>
        )}
      </div>

      <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-gray-200 bg-white px-3 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        <div className="flex items-center gap-3 tabular-nums">
          <span>{stats.words.toLocaleString()} words</span>
          <span className="hidden sm:inline">{stats.chars.toLocaleString()} characters</span>
          <span className="hidden sm:inline">~{stats.minutes} min read</span>
          {showPreview && <span>{pages} page{pages === 1 ? '' : 's'}</span>}
          {Object.keys(assets).length > 0 && (
            <button type="button" onClick={() => setDialog('images')} className="hover:text-gray-800 dark:hover:text-gray-200">
              {Object.keys(assets).length} image{Object.keys(assets).length === 1 ? '' : 's'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">Autosaved in this browser</span>
          <a href="/scraper" className="hidden items-center gap-1 hover:text-gray-800 sm:inline-flex dark:hover:text-gray-200">
            <I.Globe className="h-3 w-3" /> Web scraper
          </a>
          <button type="button" onClick={() => setDialog('shortcuts')} className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200">
            <I.Keyboard className="h-3 w-3" /> Shortcuts
          </button>
        </div>
      </footer>

      <ImportUrlDialog open={dialog === 'import'} onClose={() => setDialog(null)} onImport={importFromUrl} />
      <TemplatesDialog open={dialog === 'templates'} onClose={() => setDialog(null)} onPick={applyTemplate} dirty={markdown.trim().length > 0} />
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={() => setDialog(null)} isMac={isMac} />
      <AddToAgentDialog open={dialog === 'agent'} onClose={() => setDialog(null)} />
      <ImagesDialog
        open={dialog === 'images'}
        onClose={() => setDialog(null)}
        assets={assets}
        onInsert={(name) => viewRef.current && insertImage(viewRef.current, `asset:${name}`, name.replace(/\.[a-z0-9]+$/i, ''))}
        onRemove={removeAsset}
        onUpload={(files) => addImageFiles(files, { insert: false })}
      />
    </div>
  );
}

export default function EditorApp() {
  return (
    <ToastProvider>
      <Editor />
    </ToastProvider>
  );
}
