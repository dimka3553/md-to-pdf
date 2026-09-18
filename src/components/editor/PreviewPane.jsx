'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as I from '../icons';
import { Button, IconButton, Segmented, cx } from '../ui';
import { buildDocumentHtml } from '@/lib/document/html';
import { normalizeSettings, resolveDesign } from '@/lib/document/settings';
import { useElementWidth } from '@/lib/client/hooks';

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5];

export default function PreviewPane({ markdown, settings, assets, fileName, pdf, onRenderPdf, onDownloadPdf, onPagesChange, onClose }) {
  const [mode, setMode] = useState('live');
  const [zoom, setZoom] = useState('fit');
  const [containerRef, containerWidth] = useElementWidth();
  const iframeRef = useRef(null);
  const scrollRef = useRef(0);
  const [pages, setPages] = useState(1);

  const design = useMemo(() => resolveDesign(normalizeSettings(settings)), [settings]);

  const html = useMemo(() => {
    try {
      return buildDocumentHtml({ markdown, settings, assets, mode: 'preview', title: fileName?.replace(/\.md$/i, '') });
    } catch (err) {
      console.error('[preview] render failed', err);
      return `<!doctype html><body style="font-family:system-ui;padding:24px;color:#b91c1c"><h3>Preview error</h3><pre>${String(err.message)}</pre></body>`;
    }
  }, [markdown, settings, assets, fileName]);

  const htmlRef = useRef(html);
  htmlRef.current = html;
  const paintedRef = useRef('');

  // Write the document into the frame rather than using `srcdoc`. Chromium tries to restore
  // dynamically-inserted srcdoc frames from session history on reload, and when the attribute
  // is not there yet the frame resolves to the parent's URL — the whole app would render inside
  // its own preview. An `about:blank` frame that we write into has no URL to restore.
  const paintPreview = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const next = htmlRef.current;
    // about:blank (or a browser reset) has an empty body — rewrite even if we already
    // painted this HTML once. A completed document with the same HTML is a no-op.
    if (paintedRef.current === next && doc.body?.childElementCount > 0) return;
    paintedRef.current = next;
    doc.open();
    doc.write(next);
    doc.close();
  }, []);

  useEffect(() => {
    paintPreview();
  }, [html, paintPreview]);

  // Messages from the preview document: readiness/page count, and scroll position
  // (remembered so the next re-render can restore it).
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow || !e.data?.type) return;
      if (e.data.type === 'md2pdf:preview-ready' || e.data.type === 'md2pdf:preview-pages') {
        setPages(e.data.pages || 1);
        onPagesChange?.(e.data.pages || 1);
        if (e.data.type === 'md2pdf:preview-ready') e.source.postMessage({ type: 'md2pdf:scroll-to', y: scrollRef.current }, '*');
      } else if (e.data.type === 'md2pdf:preview-scroll') {
        scrollRef.current = e.data.y || 0;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPagesChange]);

  const sheetWidth = design.pageWidth + 48; // sheet + gutter
  const scale = zoom === 'fit' ? Math.min(1, (containerWidth - 8) / sheetWidth) : zoom;
  const effectiveScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const zoomIn = useCallback(() => setZoom((z) => { const cur = z === 'fit' ? effectiveScale : z; return ZOOM_STEPS.find((s) => s > cur + 0.01) ?? ZOOM_STEPS.at(-1); }), [effectiveScale]);
  const zoomOut = useCallback(() => setZoom((z) => { const cur = z === 'fit' ? effectiveScale : z; return [...ZOOM_STEPS].reverse().find((s) => s < cur - 0.01) ?? ZOOM_STEPS[0]; }), [effectiveScale]);

  const stale = pdf.url && pdf.renderedKey !== pdf.currentKey;

  return (
    <section className="flex h-full min-w-0 flex-col bg-gray-100 dark:bg-gray-950" aria-label="Preview">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (m === 'pdf' && !pdf.url && !pdf.loading) onRenderPdf();
            }}
            options={[
              { value: 'live', label: 'Live', icon: <I.Eye className="h-3.5 w-3.5" />, title: 'Instant HTML preview of the document' },
              { value: 'pdf', label: 'PDF', icon: <I.FilePdf className="h-3.5 w-3.5" />, title: 'Render the actual PDF file' },
            ]}
          />
          <span className="hidden text-xs text-gray-500 md:inline dark:text-gray-400">
            {mode === 'live' ? `${pages} page${pages === 1 ? "" : "s"} · ${design.pageWidth > design.pageHeight ? 'landscape' : 'portrait'} ${settings.paperSize}` : pdf.pages ? `${pdf.pages} page${pdf.pages === 1 ? '' : 's'}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {mode === 'live' ? (
            <>
              <IconButton label="Zoom out" size="sm" onClick={zoomOut} disabled={effectiveScale <= ZOOM_STEPS[0] + 0.001}><I.ZoomOut /></IconButton>
              <button type="button" onClick={() => setZoom('fit')} className="min-w-[44px] rounded px-1 font-mono text-[11px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" title="Fit to width">
                {Math.round(effectiveScale * 100)}%
              </button>
              <IconButton label="Zoom in" size="sm" onClick={zoomIn} disabled={effectiveScale >= ZOOM_STEPS.at(-1) - 0.001}><I.ZoomIn /></IconButton>
            </>
          ) : (
            <>
              <Button size="sm" variant={stale ? 'primary' : 'secondary'} onClick={onRenderPdf} disabled={pdf.loading} className="px-2 sm:px-2.5">
                {pdf.loading ? <I.Spinner className="h-3.5 w-3.5" /> : <I.Refresh className="h-3.5 w-3.5" />}
                <span className="hidden min-[400px]:inline">{pdf.loading ? 'Rendering…' : stale ? 'Re-render' : 'Refresh'}</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={onDownloadPdf} disabled={!pdf.url || pdf.loading} title="Download this PDF">
                <I.Download className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {onClose && (
            <IconButton label="Close preview" size="sm" onClick={onClose}><I.X /></IconButton>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {mode === 'live' ? (
          <div className="h-full w-full overflow-hidden" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: sheetWidth * effectiveScale, height: '100%', overflow: 'hidden' }}>
              <iframe
                ref={iframeRef}
                key="live"
                title="Document preview"
                sandbox="allow-scripts allow-same-origin"
                className="block border-0 bg-transparent"
                onLoad={paintPreview}
                style={{
                  width: sheetWidth,
                  height: `${100 / effectiveScale}%`,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: '0 0',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            {pdf.url ? (
              <iframe key={pdf.url} title="PDF preview" src={`${pdf.url}#toolbar=0&view=FitH`} className="block h-full w-full border-0 bg-gray-200 dark:bg-gray-900" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                {pdf.loading ? (
                  <>
                    <I.Spinner className="h-6 w-6 text-brand-600" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">Rendering your PDF…</p>
                    <p className="max-w-xs text-xs text-gray-500">This runs a real print engine on the server, so it takes a few seconds.</p>
                  </>
                ) : pdf.error ? (
                  <>
                    <I.AlertTriangle className="h-6 w-6 text-red-500" />
                    <p className="max-w-sm text-sm text-red-700 dark:text-red-300">{pdf.error}</p>
                    <Button size="sm" onClick={onRenderPdf}>Try again</Button>
                  </>
                ) : (
                  <>
                    <I.FilePdf className="h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">Render the PDF to see exactly what you&apos;ll download.</p>
                    <Button size="sm" variant="primary" onClick={onRenderPdf}>Render PDF</Button>
                  </>
                )}
              </div>
            )}
            {pdf.url && pdf.loading && (
              <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-white/80 py-1.5 text-xs text-gray-600 backdrop-blur dark:bg-gray-900/80 dark:text-gray-300">
                <I.Spinner className="h-3.5 w-3.5" /> Rendering…
              </div>
            )}
            {stale && !pdf.loading && (
              <div className={cx('absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-amber-50/95 py-1.5 text-xs text-amber-800 dark:bg-amber-950/90 dark:text-amber-200')}>
                The document changed since this PDF was rendered.
                <button type="button" onClick={onRenderPdf} className="font-semibold underline underline-offset-2">Re-render</button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
