'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as I from '@/components/icons';
import { Button, Input, Segmented, cx } from '@/components/ui';
import { ToastProvider, useToast } from '@/components/Toast';

const EXAMPLES = ['https://en.wikipedia.org/wiki/Markdown', 'https://nextjs.org/docs', 'https://github.com/markedjs/marked', 'https://developer.mozilla.org/en-US/docs/Web/HTML'];

function Scraper() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('markdown');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const scrape = async (e) => {
    e?.preventDefault();
    let target = url.trim();
    if (!target) return setError('Enter a URL to fetch.');
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    try {
      new URL(target);
    } catch {
      return setError('That does not look like a valid URL.');
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const endpoint = format === 'markdown' ? '/api/scrape' : '/api/scrapehtml';
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(target)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'Ok') throw new Error(data.message || `Request failed (${res.status})`);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch the page.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Clipboard is not available.');
    }
  };

  const openInEditor = () => {
    if (!result) return;
    try {
      const key = 'md2pdf:document:v2';
      const name = (result.page.title || new URL(result.page.url).hostname).replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
      localStorage.setItem(key, JSON.stringify({ markdown: result.page.content, fileName: `${name}.md` }));
      window.location.href = '/';
    } catch {
      window.location.href = `/?content=${encodeURIComponent(result.page.content)}`;
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[11px] font-black text-white">M↓</span>
            <span className="font-semibold">Markdown Studio</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            Back to editor <I.ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Web page to Markdown</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Fetch any public web page, strip the clutter and get clean Markdown (or HTML) you can turn into a PDF.</p>
        </div>

        <form onSubmit={scrape} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" disabled={loading} aria-label="URL" className="h-10 flex-1" />
            <Segmented value={format} onChange={setFormat} options={[{ value: 'markdown', label: 'Markdown' }, { value: 'html', label: 'HTML' }]} />
            <Button type="submit" variant="primary" size="lg" disabled={loading || !url.trim()}>
              {loading ? <I.Spinner className="h-4 w-4" /> : <I.Globe className="h-4 w-4" />}
              {loading ? 'Fetching…' : 'Fetch'}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span>Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setUrl(ex)} className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600 hover:border-brand-400 hover:text-brand-700 dark:border-gray-700 dark:text-gray-300">
                {new URL(ex).hostname.replace('www.', '')}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">{error}</p>}
        </form>

        {result && (
          <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{result.page.title || result.page.url}</h2>
                <p className="truncate text-xs text-gray-500">
                  {result.page.url} · {result.page.content.length.toLocaleString()} chars · {result.metadata.duration} ms
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => copy(result.page.content, 'Content')}>
                  <I.Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                {format === 'markdown' && (
                  <Button size="sm" variant="primary" onClick={openInEditor}>
                    <I.Pencil className="h-3.5 w-3.5" /> Open in editor
                  </Button>
                )}
              </div>
            </div>
            <pre className={cx('max-h-[60vh] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200')}>{result.page.content}</pre>
          </section>
        )}

        <section className="mt-10 grid gap-4 text-sm text-gray-600 sm:grid-cols-2 dark:text-gray-400">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">API</h3>
            <p className="mb-2">The same endpoint is available programmatically:</p>
            <code className="block rounded-md bg-gray-100 px-3 py-2 font-mono text-xs break-all text-gray-800 dark:bg-gray-800 dark:text-gray-200">GET /api/scrape?url=https://example.com</code>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">How it works</h3>
            <p>A headless browser loads the page, removes navigation, ads and scripts, keeps the main article, and converts it to GitHub-flavoured Markdown with absolute links and images.</p>
          </div>
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
