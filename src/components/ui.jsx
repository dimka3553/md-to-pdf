'use client';

import { useEffect, useRef } from 'react';
import { X } from './icons';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors select-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700',
  ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3',
  lg: 'h-10 px-4',
};

export function Button({ variant = 'secondary', size = 'md', className, ...props }) {
  return <button type="button" className={cx(buttonBase, variants[variant], sizes[size], className)} {...props} />;
}

export function IconButton({ label, active, className, size = 'md', children, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Segmented({ value, onChange, options, size = 'md', className }) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-md bg-gray-100 p-0.5 dark:bg-gray-800', className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-[5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm',
              selected ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {o.icon}
            {o.label && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-sm text-gray-800 dark:text-gray-200">{label}</span>
        {description && <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
          checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span className={cx('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
    </label>
  );
}

export function Field({ label, hint, children, inline }) {
  return (
    <label className={cx('block', inline && 'flex items-center justify-between gap-3')}>
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export function Input(props) {
  return <input className={cx(inputClass, props.className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(inputClass, 'appearance-none bg-[length:14px] bg-[right_8px_center] bg-no-repeat pr-7', className)} style={{ backgroundImage: chevronBg }} {...props}>
      {children}
    </select>
  );
}

const chevronBg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Section({ title, icon, children, defaultOpen = true, action }) {
  return (
    <details open={defaultOpen} className="group border-b border-gray-100 dark:border-gray-800">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide text-gray-700 uppercase select-none hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden">
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1">{title}</span>
        {action}
        <svg className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </summary>
      <div className="space-y-3 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}

export function Dialog({ open, onClose, title, description, children, footer, width = 'max-w-lg', bodyClassName }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    ref.current?.querySelector('input, textarea, button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fade-in fixed inset-0 z-[100] flex items-end justify-center overflow-hidden bg-gray-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 dark:bg-black/60"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'pop-in flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl dark:border-gray-700 dark:bg-gray-900',
          width,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            {description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 sm:line-clamp-none dark:text-gray-400">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="shrink-0">
            <X />
          </IconButton>
        </div>
        <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Kbd({ children }) {
  return <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">{children}</kbd>;
}
