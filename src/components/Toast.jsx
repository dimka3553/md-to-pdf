'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, X } from './icons';
import { cx } from './ui';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (toast) => {
      const id = ++idRef.current;
      const item = { id, kind: 'info', duration: 4000, ...toast };
      setToasts((t) => [...t.slice(-3), item]);
      if (item.duration > 0) setTimeout(() => dismiss(id), item.duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      info: (message, opts) => push({ kind: 'info', message, ...opts }),
      success: (message, opts) => push({ kind: 'success', message, ...opts }),
      error: (message, opts) => push({ kind: 'error', message, duration: 7000, ...opts }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[200] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cx(
              'toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm shadow-lg backdrop-blur',
              t.kind === 'error' && 'border-red-200 bg-red-50/95 text-red-900 dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-100',
              t.kind === 'success' && 'border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-100',
              t.kind === 'info' && 'border-gray-200 bg-white/95 text-gray-800 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === 'error' ? <AlertTriangle className="h-4 w-4" /> : t.kind === 'success' ? <Check className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="leading-snug">{t.message}</p>
              {t.action && (
                <button type="button" onClick={() => { t.action.onClick(); dismiss(t.id); }} className="mt-1.5 text-xs font-semibold underline underline-offset-2">
                  {t.action.label}
                </button>
              )}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
