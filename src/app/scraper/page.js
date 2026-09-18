'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as I from '@/components/icons';
import { Button, Segmented, cx, inputClass } from '@/components/ui';
import { ToastProvider, useToast } from '@/components/Toast';
import { analyzeMarkdown } from '@/lib/mcp/analyze';
import { clearRecent, fetchImport, fileNameFor, hostnameOf, loadRecent, normalizeUrl, pushRecent, stageHandoff, timeAgo } from '@/lib/client/scraper';

const EXAMPLES = [
  { url: 'https://en.wikipedia.org/wiki/Markdown', label: 'Wikipedia article' },
  { url: 'https://nextjs.org/docs/app/getting-started/installation', label: 'Docs page' },
  { url: 'https://github.com/markedjs/marked', label: 'GitHub README' },
  { url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', label: 'MDN reference' },
];

const STEPS = ['Starting a headless browser…', 'Loading the page…', 'Waiting for scripts and images to settle…', 'Removing navigation, ads and sidebars…', 'Converting the article to Markdown…', 'Almost there — big pages take a moment…'];

const MCP_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://md-to-pdf.vercel.app'}/api/mcp`;

// ---- Small building blocks -----------------------------------------------------------------

function Card({ className, children }) {
  return <div className={cx('rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900', className)}>{children}</div>;
}

function Chip({ pressed, onClick, children, title }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
        pressed
          ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300'
          : 'border-gray-200 bg-white text-gray-500 line-through decoration-gray-400 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', pressed ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600')} />
      {children}
    </button>
  );
}

function Stat({ icon, value, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600 tabular-nums dark:text-gray-300" title={label}>
      <span className="text-gray-400">{icon}</span>
      {value} <span className="text-gray-400">{label}</span>
    </span>
  );
}

function HostBadge({ url, size = 'md' }) {
  const host = hostnameOf(url);
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white uppercase',
        size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm',
      )}
      aria-hidden="true"
    >
      {host.charAt(0) || '?'}
    </span>
  );
}

// ---- Progress ------------------------------------------------------------------------------

function ProgressCard({ url, onCancel }) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const s = (Date.now() - start) / 1000;
      setElapsed(s);
      setStep(Math.min(STEPS.length - 1, Math.floor(s / 1.8)));
    }, 200);
    return () => clearInterval(id);
  }, []);
  return (
    <Card className="mt-6 overflow-hidden" role="status" aria-live="polite">
      <div className="h-1 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <div className="progress-bar h-full w-1/3 rounded-full bg-brand-500" />
      </div>
      <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <I.Spinner className="h-5 w-5 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{STEPS[step]}</p>
          <p className="truncate text-xs text-gray-500">
            {hostnameOf(url)} · {elapsed.toFixed(0)} s · usually 3–15 s
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

// ---- Result --------------------------------------------------------------------------------

function Outline({ outline }) {
  if (!outline.length) return <p className="px-5 py-8 text-center text-sm text-gray-500">No headings were found. The page probably uses styled paragraphs instead — add `##` headings in the editor.</p>;
  const min = Math.min(...outline.map((h) => h.depth));
  return (
    <ol className="max-h-[60vh] overflow-auto px-5 py-3 text-sm">
      {outline.map((h, i) => (
        <li key={`${h.line}-${i}`} className="flex items-baseline gap-2 py-1 text-gray-800 dark:text-gray-200" style={{ paddingLeft: `${(h.depth - min) * 16}px` }}>
          <span className="w-6 shrink-0 font-mono text-[10px] text-gray-400">H{h.depth}</span>
          <span className={cx('min-w-0 truncate', h.depth === min && 'font-medium')}>{h.text}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-400">L{h.line}</span>
        </li>
      ))}
    </ol>
  );
}

function Notes({ warnings }) {
  if (!warnings.length) {
    return (
      <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-emerald-700 dark:text-emerald-300">
        <I.Check className="h-4 w-4" /> No formatting issues — this will render cleanly.
      </p>
    );
  }
  return (
    <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-auto text-sm dark:divide-gray-800">
      {warnings.map((w, i) => (
        <li key={i} className="flex items-start gap-3 px-5 py-2.5">
          <span
            className={cx(
              'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
              w.severity === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
            )}
          >
            {w.severity === 'warning' ? 'fix' : 'tip'}
          </span>
          <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-300">{w.message}</span>
          {w.line && <span className="shrink-0 font-mono text-[10px] text-gray-400">L{w.line}</span>}
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ result, format, onOpen, onCopy, onDownload }) {
  const { page, metadata } = result;
  const isMd = format === 'markdown';
  const report = useMemo(() => (isMd ? analyzeMarkdown(page.content) : null), [isMd, page.content]);
  const [tab, setTab] = useState('source'); // ResultCard is keyed on url+format, so this resets per import

  const fixes = report?.warnings.filter((w) => w.severity === 'warning').length || 0;
  const tabs = isMd
    ? [
        { value: 'source', label: 'Markdown' },
        { value: 'outline', label: `Outline${report.outline.length ? ` · ${report.outline.length}` : ''}` },
        { value: 'notes', label: `Notes${report.warnings.length ? ` · ${report.warnings.length}` : ''}` },
      ]
    : [{ value: 'source', label: 'HTML' }];

  const lines = useMemo(() => page.content.split('\n').length, [page.content]);

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <HostBadge url={page.url} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{page.title || page.url}</h2>
            <p className="truncate text-xs text-gray-500">
              <a href={page.url} target="_blank" rel="noreferrer noopener" className="hover:underline">{page.siteName || hostnameOf(page.url)}</a>
              {page.author && <> · {page.author}</>}
              {page.published && <> · {formatDate(page.published)}</>}
              <> · fetched in {(metadata.duration / 1000).toFixed(1)} s</>
            </p>
            {page.description && <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">{page.description}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {report ? (
              <>
                <Stat icon={<I.FileText className="h-3.5 w-3.5" />} value={report.stats.words.toLocaleString()} label="words" />
                <Stat icon={<I.Clock className="h-3.5 w-3.5" />} value={`~${report.stats.minutes}`} label="min read" />
                <Stat icon={<I.Heading className="h-3.5 w-3.5" />} value={report.outline.length} label="headings" />
                <Stat icon={<I.Image className="h-3.5 w-3.5" />} value={report.stats.images} label="images" />
                {report.stats.tables > 0 && <Stat icon={<I.Table className="h-3.5 w-3.5" />} value={report.stats.tables} label="tables" />}
                {report.stats.codeBlocks > 0 && <Stat icon={<I.CodeBlock className="h-3.5 w-3.5" />} value={report.stats.codeBlocks} label="code blocks" />}
              </>
            ) : (
              <Stat icon={<I.Code className="h-3.5 w-3.5" />} value={(page.content.length / 1024).toFixed(1)} label="KB of HTML" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onCopy}>
              <I.Copy className="h-3.5 w-3.5" /> Copy
            </Button>
            <Button size="sm" onClick={onDownload}>
              <I.Download className="h-3.5 w-3.5" /> .{isMd ? 'md' : 'html'}
            </Button>
            {isMd && (
              <>
                <Button size="sm" onClick={() => onOpen('append')} title="Add to the end of the document that is open in the editor">
                  <I.Plus className="h-3.5 w-3.5" /> Append
                </Button>
                <Button size="sm" variant="primary" onClick={() => onOpen('replace')}>
                  <I.Pencil className="h-3.5 w-3.5" /> Open in editor
                </Button>
              </>
            )}
          </div>
        </div>

        {isMd && fixes > 0 && (
          <button type="button" onClick={() => setTab('notes')} className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50">
            <I.AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {fixes} thing{fixes === 1 ? '' : 's'} to tidy before this prints well — see <strong>Notes</strong>. Open it in the editor to fix by hand, or ask your AI agent to polish it.
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-gray-800">
        <Segmented size="sm" value={tab} onChange={setTab} options={tabs} className="max-w-full overflow-x-auto" />
        <span className="hidden font-mono text-[11px] text-gray-400 sm:inline">{lines.toLocaleString()} lines · {page.content.length.toLocaleString()} chars</span>
      </div>

      {tab === 'source' && (
        <pre className="max-h-[60vh] overflow-auto p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 sm:p-5 dark:text-gray-200">{page.content}</pre>
      )}
      {tab === 'outline' && report && <Outline outline={report.outline} />}
      {tab === 'notes' && report && <Notes warnings={report.warnings} />}
    </Card>
  );
}

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---- Recent --------------------------------------------------------------------------------

function RecentList({ items, onPick, onClear }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          <I.History className="h-3.5 w-3.5" /> Recent imports
        </h2>
        <button type="button" onClick={onClear} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Clear</button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.url}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700 dark:hover:bg-brand-900/10"
            >
              <HostBadge url={r.url} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{r.title || r.url}</span>
                <span className="block truncate text-xs text-gray-500">
                  {hostnameOf(r.url)} · {r.format === 'html' ? 'HTML' : 'Markdown'} · {timeAgo(r.at)}
                </span>
              </span>
              <I.ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Page ----------------------------------------------------------------------------------

function Scraper() {
  const toast = useToast();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('markdown');
  const [keepImages, setKeepImages] = useState(true);
  const [keepLinks, setKeepLinks] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const run = useCallback(
    async (rawUrl, opts = {}) => {
      let target;
      try {
        target = normalizeUrl(rawUrl);
      } catch (err) {
        setError(err.message);
        inputRef.current?.focus();
        return;
      }
      const fmt = opts.format ?? format;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setUrl(target);
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const data = await fetchImport({ url: target, format: fmt, keepImages: opts.keepImages ?? keepImages, keepLinks: opts.keepLinks ?? keepLinks, signal: controller.signal });
        setResult({ ...data, format: fmt });
        setRecent(pushRecent({ url: target, title: data.page.title, format: fmt }));
        window.history.replaceState(null, '', `/scraper?url=${encodeURIComponent(target)}`);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to fetch the page.');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [format, keepImages, keepLinks],
  );

  // Deep link: /scraper?url=https://… pre-fills and fetches.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('url');
    if (initial) run(initial);
    else inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.page.content);
      toast.success(`${result.format === 'html' ? 'HTML' : 'Markdown'} copied`);
    } catch {
      toast.error('Clipboard is not available.');
    }
  };

  const download = () => {
    const ext = result.format === 'html' ? 'html' : 'md';
    const blob = new Blob([result.page.content], { type: ext === 'html' ? 'text/html' : 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileNameFor(result.page.title, result.page.url)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const openInEditor = (mode) => {
    if (!result) return;
    const ok = stageHandoff({
      markdown: result.page.content,
      fileName: `${fileNameFor(result.page.title, result.page.url)}.md`,
      mode,
      source: { url: result.page.url, title: result.page.title },
    });
    if (!ok) return toast.error('Could not hand the document to the editor (storage is unavailable).');
    router.push('/');
  };

  const submit = (e) => {
    e.preventDefault();
    run(url);
  };

  return (
    <div className="h-dvh overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-2 px-4">
          <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link href="/" className="flex min-w-0 items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-600 text-[11px] font-black text-white">M↓</span>
              <span className="hidden font-semibold sm:inline">Markdown Studio</span>
            </Link>
            <I.ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-gray-300 sm:block" />
            <span className="truncate text-gray-900 dark:text-gray-100">Import from URL</span>
          </nav>
          <Link href="/" className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-600 hover:underline">
            <span className="hidden sm:inline">Back to editor</span>
            <span className="sm:hidden">Editor</span>
            <I.ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-gray-100">Turn any web page into Markdown</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Paste a link. A headless browser loads the page, strips navigation, ads and scripts, keeps the article and hands you clean Markdown — ready to polish and export as a PDF.
          </p>
        </div>

        <Card className="p-4">
          <form onSubmit={submit} aria-busy={loading}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <I.Globe className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').trim();
                    if (!url && /^https?:\/\/\S+$/i.test(pasted)) {
                      e.preventDefault();
                      run(pasted);
                    }
                  }}
                  placeholder="https://example.com/article"
                  disabled={loading}
                  aria-label="Web page URL"
                  aria-invalid={!!error}
                  className={cx(inputClass, 'h-11 pl-9 text-[15px]')}
                />
                {url && !loading && (
                  <button type="button" onClick={() => { setUrl(''); setError(null); inputRef.current?.focus(); }} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Clear">
                    <I.X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="primary" size="lg" className="h-11 sm:min-w-28" disabled={loading || !url.trim()}>
                {loading ? <I.Spinner className="h-4 w-4" /> : <I.Download className="h-4 w-4" />}
                {loading ? 'Fetching…' : 'Fetch'}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'markdown', label: 'Markdown', title: 'GitHub-flavoured Markdown, ready for the editor' },
                  { value: 'html', label: 'HTML', title: 'The cleaned main-content HTML fragment' },
                ]}
              />
              <span className="hidden h-4 w-px bg-gray-200 sm:block dark:bg-gray-700" />
              <Chip pressed={keepImages} onClick={() => setKeepImages((v) => !v)} title="Keep or drop images">Images</Chip>
              <Chip pressed={keepLinks} onClick={() => setKeepLinks((v) => !v)} title="Keep hyperlinks, or replace them with their text">Links</Chip>
              <span className="ml-auto hidden text-[11px] text-gray-400 sm:inline">Paste a URL to fetch instantly</span>
            </div>

            {error && (
              <div role="alert" className="mt-3 flex flex-col items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:flex-row dark:bg-red-950/60 dark:text-red-300">
                <I.AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p>{error}</p>
                  <p className="mt-1 text-xs opacity-80">Pages behind a login, paywall or bot check cannot be read. Try the canonical article URL, or the HTML format for heavily scripted pages.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => run(url)}>
                  <I.Refresh className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}
          </form>

          {!result && !loading && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <span>Try:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.url} type="button" onClick={() => run(ex.url)} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-gray-600 hover:border-brand-400 hover:text-brand-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-600 dark:hover:text-brand-300">
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </Card>

        {loading && <ProgressCard url={url} onCancel={cancel} />}

        <div ref={resultRef} className="scroll-mt-16">
          {result && <ResultCard key={`${result.page.url}|${result.format}`} result={result} format={result.format} onOpen={openInEditor} onCopy={copy} onDownload={download} />}
        </div>

        <RecentList items={recent} onPick={(r) => run(r.url, { format: r.format || 'markdown' })} onClear={() => setRecent(clearRecent())} />

        <section className="mt-10 grid gap-4 text-sm text-gray-600 md:grid-cols-3 dark:text-gray-400">
          <Card className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
              <I.Sparkles className="h-4 w-4 text-brand-500" /> How it works
            </h3>
            <p>A real Chromium tab loads the page (so JavaScript-rendered content works), removes navigation, ads, forms and scripts, keeps the <code className="font-mono text-xs">&lt;main&gt;</code> / <code className="font-mono text-xs">&lt;article&gt;</code>, and converts it to GitHub-flavoured Markdown with absolute links and images.</p>
          </Card>
          <Card className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
              <I.Bot className="h-4 w-4 text-brand-500" /> From your AI agent
            </h3>
            <p className="mb-2">The same importer is an MCP tool, so Cursor, Claude, Codex & co. can fetch a page, fix the notes and render a PDF in one go:</p>
            <code className="block truncate rounded-md bg-gray-100 px-3 py-2 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200" title={MCP_URL}>import_web_page(url)</code>
            <p className="mt-2 text-xs">Prompt <code className="font-mono">pdf_from_url</code> does the whole flow. <Link href="/#add-to-agent" className="text-brand-600 hover:underline">Add to AI agent →</Link></p>
          </Card>
          <Card className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
              <I.Terminal className="h-4 w-4 text-brand-500" /> API
            </h3>
            <p className="mb-2">Plain HTTP, CORS enabled, no key:</p>
            <code className="block rounded-md bg-gray-100 px-3 py-2 font-mono text-xs break-all text-gray-800 dark:bg-gray-800 dark:text-gray-200">GET /api/scrape?url=https://example.com&amp;images=true&amp;links=true</code>
            <p className="mt-2 text-xs"><code className="font-mono">/api/scrapehtml</code> returns HTML. Responses include title, description, site name, author and date.</p>
          </Card>
        </section>
      </main>
    </div>
  );
}

export default function ScraperPage() {
  return (
    <ToastProvider>
      <Scraper />
    </ToastProvider>
  );
}
