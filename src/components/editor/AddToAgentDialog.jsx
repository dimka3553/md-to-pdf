'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import * as I from '../icons';
import { Button, Dialog, cx } from '../ui';
import { useToast } from '../Toast';
import { AGENTS, getAgent, mcpUrl } from '@/lib/agents';

const LAST_AGENT_KEY = 'md2pdf:agent';

function CodeBox({ label, value, onCopy, mono = true }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/70">
      {label && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <span className="min-w-0 truncate">{label}</span>
          <button type="button" onClick={() => onCopy(value)} className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100">
            <I.Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      )}
      <pre className={cx('max-h-40 overflow-auto px-3 py-2 text-xs leading-relaxed break-all whitespace-pre-wrap text-gray-800 dark:text-gray-100', mono && 'font-mono')}>{value}</pre>
    </div>
  );
}

function AgentBadge({ agent, size = 'md' }) {
  return (
    <span
      className={cx('flex shrink-0 items-center justify-center rounded-lg font-bold text-white', size === 'md' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-[11px]')}
      style={{ background: agent.color }}
      aria-hidden="true"
    >
      {agent.initials}
    </span>
  );
}

// Rendered with key={agent.id} so local state (the manual-config toggle) resets when the agent changes.
function Details({ agent, plan, url, launched, onLaunch, onCopy }) {
  const [showManual, setShowManual] = useState(false);

  const kindLabel = plan.kind === 'deeplink' ? 'One-click' : plan.kind === 'cli' ? 'Terminal' : 'Manual';

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <AgentBadge agent={agent} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{agent.name}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{kindLabel}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{agent.tagline}</p>
        </div>
      </div>

      {plan.kind === 'deeplink' && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-900/60 dark:bg-brand-900/20">
          <div className="flex items-start gap-2">
            {launched ? <I.Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <I.ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />}
            <div className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-100">
              <p className="font-medium">{launched ? `Opening ${agent.name}…` : `Open ${agent.name} to install`}</p>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                {launched ? `Approve the install prompt in ${agent.name}. If nothing happened, make sure it is installed and try again.` : 'Your browser will hand the server configuration to the app.'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={onLaunch} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-center">
              <I.ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">{launched ? 'Open again' : `Open ${agent.name}`}</span>
              <span className="hidden sm:inline">{launched ? `Open ${agent.name} again` : `Open in ${agent.name}`}</span>
            </Button>
            {plan.webHref && (
              <a href={plan.webHref} target="_blank" rel="noreferrer" className="text-xs text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                Didn&apos;t open? Use the web link
              </a>
            )}
          </div>
        </div>
      )}

      {plan.kind === 'cli' && <CodeBox label="Run in your terminal" value={plan.command} onCopy={onCopy} />}

      {plan.kind === 'manual' && plan.copy && <CodeBox label="Server URL" value={plan.copy} onCopy={onCopy} />}
      {plan.kind === 'manual' && plan.config && <CodeBox label={`Add to ${plan.configPath}`} value={plan.config} onCopy={onCopy} />}

      {plan.steps?.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-300">
          {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}

      {plan.kind !== 'manual' && (plan.config || (plan.kind === 'deeplink' && plan.command)) && (
        <div>
          <button type="button" onClick={() => setShowManual((v) => !v)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            <I.ChevronRight className={cx('h-3 w-3 transition-transform', showManual && 'rotate-90')} /> Configure manually instead
          </button>
          {showManual && (
            <div className="mt-2 space-y-2">
              {plan.kind === 'deeplink' && plan.command && <CodeBox label="Terminal" value={plan.command} onCopy={onCopy} />}
              {plan.config && <CodeBox label={`Add to ${plan.configPath}`} value={plan.config} onCopy={onCopy} />}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto rounded-lg border border-dashed border-gray-200 p-3 text-xs leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Once connected, just ask your agent: <em className="text-gray-700 dark:text-gray-200">&ldquo;Write a project proposal and export it as a PDF with Markdown Studio.&rdquo;</em> It reads the authoring guide, lints the Markdown and renders the PDF on its own.
        <span className="sr-only">{url}</span>
      </div>
    </div>
  );
}

const isBrowser = typeof window !== 'undefined';

function readLastAgent() {
  if (!isBrowser) return null;
  try {
    const last = localStorage.getItem(LAST_AGENT_KEY);
    return last && getAgent(last) ? last : null;
  } catch {
    return null;
  }
}

export function AddToAgentDialog({ open, onClose }) {
  const toast = useToast();
  // The dialog's body is only rendered client-side after a user action, so reading
  // window/localStorage in the initializers cannot cause a hydration mismatch.
  const [selectedId, setSelectedId] = useState(readLastAgent);
  const [launched, setLaunched] = useState(false);
  const [origin] = useState(() => (isBrowser ? window.location.origin : ''));
  const detailsRef = useRef(null);

  const close = useCallback(() => {
    setLaunched(false);
    onClose();
  }, [onClose]);

  const url = useMemo(() => mcpUrl(origin || undefined), [origin]);
  const agent = selectedId ? getAgent(selectedId) : null;
  const plan = useMemo(() => (agent ? agent.install(url) : null), [agent, url]);

  const copy = useCallback(
    async (value) => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success('Copied to clipboard');
      } catch {
        toast.error('Could not copy — select the text and copy it manually.');
      }
    },
    [toast],
  );

  const launch = useCallback((p) => {
    if (!p?.href) return;
    setLaunched(true);
    // Protocol handlers must be triggered by navigation, not fetch/window.open (which browsers often block).
    window.location.assign(p.href);
  }, []);

  const pick = (a) => {
    setSelectedId(a.id);
    setLaunched(false);
    try {
      localStorage.setItem(LAST_AGENT_KEY, a.id);
    } catch {
      /* ignore */
    }
    const p = a.install(url);
    if (p.kind === 'deeplink') launch(p);
    else if (isBrowser && window.matchMedia('(max-width: 767px)').matches) {
      requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add to AI agent"
      description="Connect the Markdown Studio MCP server so your coding agent writes better-formatted Markdown and exports PDFs — free, no sign-up."
      width="max-w-3xl"
      bodyClassName="flex flex-col"
      footer={
        <>
          <a href="https://github.com/dimka3553/md-to-pdf#for-ai-agents-mcp" target="_blank" rel="noreferrer" className="mr-auto inline-flex max-w-full items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            <I.Book className="h-3.5 w-3.5 shrink-0" /> Docs &amp; plugin install
          </a>
          <Button variant="primary" onClick={close}>Done</Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 sm:px-3 dark:border-gray-700 dark:bg-gray-800/70">
        <I.Plug className="h-4 w-4 shrink-0 text-gray-400" />
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-800 sm:text-xs dark:text-gray-100" title={url}>{url}</code>
        <Button size="sm" onClick={() => copy(url)} className="shrink-0 px-2 sm:px-2.5">
          <I.Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy URL</span>
          <span className="sm:hidden">Copy</span>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(12.5rem,15rem)_minmax(0,1fr)]">
        <ul
          className="grid grid-cols-2 content-start gap-1 md:sticky md:top-0 md:grid-cols-1 md:max-h-[min(28rem,calc(100dvh-16rem))] md:overflow-y-auto md:pr-1"
          role="listbox"
          aria-label="AI agents"
        >
          {AGENTS.map((a) => {
            const active = a.id === selectedId;
            const kind = a.install(url).kind;
            return (
              <li key={a.id} className="min-w-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(a)}
                  className={cx(
                    'flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 md:gap-2.5 md:px-2.5 md:py-2',
                    active ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60',
                  )}
                >
                  <AgentBadge agent={a} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{a.name}</span>
                    <span className="hidden truncate text-[11px] text-gray-500 md:block dark:text-gray-400">{a.tagline}</span>
                  </span>
                  {kind === 'deeplink' ? <I.ExternalLink className="hidden h-3.5 w-3.5 shrink-0 text-gray-400 md:block" /> : kind === 'cli' ? <I.Terminal className="hidden h-3.5 w-3.5 shrink-0 text-gray-400 md:block" /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div ref={detailsRef} className="min-h-0 min-w-0 scroll-mt-2 rounded-xl border border-gray-200 p-3 md:min-h-[260px] md:p-4 dark:border-gray-700">
          {agent && plan ? (
            <Details key={agent.id} agent={agent} plan={plan} url={url} launched={launched} onLaunch={() => launch(plan)} onCopy={copy} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-2 py-8 text-center text-sm text-gray-500 md:py-10 dark:text-gray-400">
              <I.Bot className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p>
                Pick your agent <span className="md:hidden">above</span>
                <span className="hidden md:inline">on the left</span>.
              </p>
              <p className="max-w-xs text-xs">Cursor, VS Code and Goose install with one click; the others take a single command or a pasted snippet.</p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
