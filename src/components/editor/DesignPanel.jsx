'use client';

import { useEffect, useRef, useState } from 'react';
import * as I from '../icons';
import { Button, Field, IconButton, Input, Section, Segmented, Select, Toggle, cx } from '../ui';
import { BACKGROUNDS, DEFAULT_SETTINGS, FONTS, FONT_SIZES, LOGO_POSITIONS, LOGO_SIZES, MARGINS, PAGE_BREAK_MODES, PAPER_SIZES, THEMES } from '@/lib/document/settings';
import { formatBytes, approxBytes } from '@/lib/client/images';

function ThemeSwatch({ id, theme, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      title={theme.description}
      className={cx(
        'group flex flex-col overflow-hidden rounded-lg border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
        selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',
      )}
    >
      <div className="relative h-14 w-full p-2" style={{ background: theme.background }}>
        <div className="h-2 w-2/3 rounded-sm" style={{ background: theme.heading }} />
        <div className="mt-1 h-1 w-full rounded-sm opacity-60" style={{ background: theme.text }} />
        <div className="mt-0.5 h-1 w-5/6 rounded-sm opacity-60" style={{ background: theme.text }} />
        <div className="absolute right-2 bottom-2 h-2.5 w-2.5 rounded-full" style={{ background: theme.accent }} />
        {selected && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
            <I.Check className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{theme.name}</div>
      </div>
    </button>
  );
}

function HexInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim().startsWith('#') ? draft.trim() : `#${draft.trim()}`;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onCommit(v.toUpperCase());
    else setDraft(value);
  };
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className="font-mono uppercase"
      spellCheck={false}
      aria-label="Accent colour hex"
    />
  );
}

function BackgroundSwatch({ id, name, selected, onSelect, accent }) {
  const preview = {
    none: {},
    soft: { background: `linear-gradient(180deg, ${accent}22, transparent 70%)` },
    gradient: { background: `radial-gradient(circle at 100% 0%, ${accent}44, transparent 60%), radial-gradient(circle at 0% 100%, ${accent}22, transparent 60%)` },
    dots: { backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)', backgroundSize: '6px 6px' },
    grid: { backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)', backgroundSize: '8px 8px' },
    lines: { backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px)', backgroundSize: '100% 7px' },
  }[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      title={name}
      className={cx('flex flex-col items-center gap-1 rounded-md border p-1 text-[10px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60', selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700')}
    >
      <span className="h-8 w-full rounded-sm bg-white" style={preview} />
      <span className="text-gray-600 dark:text-gray-400">{name}</span>
    </button>
  );
}

export default function DesignPanel({ settings, onChange, onLogoFile, onClose }) {
  const logoInput = useRef(null);
  const theme = THEMES[settings.theme];

  const set = (patch) => onChange({ ...settings, ...patch });
  const setNested = (key, patch) => onChange({ ...settings, [key]: { ...settings[key], ...patch } });

  return (
    <aside className="flex h-full w-full flex-col bg-white dark:bg-gray-900" aria-label="Design settings">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <I.Palette className="h-4 w-4 text-brand-600" />
          Design
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange({ ...DEFAULT_SETTINGS, logo: settings.logo })} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            Reset
          </button>
          {onClose && (
            <IconButton label="Close panel" size="sm" onClick={onClose}>
              <I.X />
            </IconButton>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Theme" icon={<I.Palette className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(THEMES).map(([id, t]) => (
              <ThemeSwatch key={id} id={id} theme={t} selected={settings.theme === id} onSelect={(v) => set({ theme: v })} />
            ))}
          </div>
          <Field label="Accent colour">
            <div className="flex items-center gap-2">
              <label className="relative h-9 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-gray-200 dark:border-gray-700" style={{ background: settings.accentColor || theme.accent }}>
                <input type="color" value={settings.accentColor || theme.accent} onChange={(e) => set({ accentColor: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Accent colour" />
              </label>
              <HexInput value={settings.accentColor || theme.accent} onCommit={(v) => set({ accentColor: v })} />
              {settings.accentColor && (
                <Button size="sm" variant="ghost" onClick={() => set({ accentColor: '' })}>
                  Reset
                </Button>
              )}
            </div>
          </Field>
        </Section>

        <Section title="Typography" icon={<I.Type className="h-3.5 w-3.5" />}>
          <Field label="Body font">
            <Select value={settings.font} onChange={(e) => set({ font: e.target.value })}>
              <option value="inherit">Theme default ({FONTS[theme.defaultFont].name})</option>
              <optgroup label="Sans-serif">
                {Object.entries(FONTS).filter(([, f]) => f.kind === 'sans').map(([id, f]) => <option key={id} value={id}>{f.name}</option>)}
              </optgroup>
              <optgroup label="Serif">
                {Object.entries(FONTS).filter(([, f]) => f.kind === 'serif').map(([id, f]) => <option key={id} value={id}>{f.name}</option>)}
              </optgroup>
            </Select>
          </Field>
          <Field label="Heading font">
            <Select value={settings.headingFont} onChange={(e) => set({ headingFont: e.target.value })}>
              <option value="inherit">Theme default</option>
              <option value="same">Same as body</option>
              {Object.entries(FONTS).map(([id, f]) => <option key={id} value={id}>{f.name}</option>)}
            </Select>
          </Field>
          <Field label="Text size">
            <Segmented size="sm" className="w-full" value={settings.fontSize} onChange={(v) => set({ fontSize: v })} options={Object.entries(FONT_SIZES).map(([id, s]) => ({ value: id, label: s.name, title: s.label }))} />
          </Field>
          <Toggle label="Justify paragraphs" checked={settings.justify} onChange={(v) => set({ justify: v })} />
        </Section>

        <Section title="Page" icon={<I.Ruler className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Paper">
              <Select value={settings.paperSize} onChange={(e) => set({ paperSize: e.target.value })}>
                {Object.entries(PAPER_SIZES).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Orientation">
              <Select value={settings.orientation} onChange={(e) => set({ orientation: e.target.value })}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </Select>
            </Field>
          </div>
          <Field label="Margins">
            <Segmented size="sm" className="w-full" value={settings.margins} onChange={(v) => set({ margins: v })} options={Object.entries(MARGINS).map(([id, m]) => ({ value: id, label: m.name }))} />
          </Field>
          <Field label="Background">
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(BACKGROUNDS).map(([id, b]) => (
                <BackgroundSwatch key={id} id={id} name={b.name} selected={settings.background === id} onSelect={(v) => set({ background: v })} accent={settings.accentColor || theme.accent} />
              ))}
            </div>
          </Field>
          <Field label="Page breaks" hint="Automatic keeps headings, short introductions and compact tables together. Use the toolbar’s Page break before a heading to start it on a fresh page.">
            <Select value={settings.pageBreaks} onChange={(e) => set({ pageBreaks: e.target.value })}>
              {Object.entries(PAGE_BREAK_MODES).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
            </Select>
          </Field>
        </Section>

        <Section title="Branding" icon={<I.Stamp className="h-3.5 w-3.5" />}>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = ''; }} />
          {settings.logo ? (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              <div className="checker flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md">
                <img src={settings.logo.dataUrl} alt="Logo" className="max-h-12 max-w-[72px] object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{settings.logo.name}</div>
                <div className="text-[11px] text-gray-500">{formatBytes(approxBytes(settings.logo.dataUrl))}</div>
                <div className="mt-1 flex gap-1">
                  <button type="button" onClick={() => logoInput.current?.click()} className="text-xs font-medium text-brand-600 hover:underline">Replace</button>
                  <span className="text-gray-300">·</span>
                  <button type="button" onClick={() => set({ logo: null })} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 px-3 py-5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-brand-900/10"
            >
              <I.Upload className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Upload a logo</span>
              <span className="text-[11px] text-gray-500">PNG, JPG, SVG or WebP · transparent PNG or SVG works best</span>
            </button>
          )}
          {settings.logo && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Placement">
                <Select value={settings.logo.position} onChange={(e) => set({ logo: { ...settings.logo, position: e.target.value } })}>
                  {Object.entries(LOGO_POSITIONS).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Size">
                <Select value={settings.logo.size} onChange={(e) => set({ logo: { ...settings.logo, size: e.target.value } })} disabled={settings.logo.position === 'page-header' || settings.logo.position === 'watermark'}>
                  {Object.entries(LOGO_SIZES).map(([id, s]) => <option key={id} value={id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </Section>

        <Section title="Header & footer" icon={<I.Layout className="h-3.5 w-3.5" />}>
          <Field label="Header text" hint="Use {title} to insert the document title.">
            <Input value={settings.header.text} onChange={(e) => setNested('header', { text: e.target.value })} placeholder="e.g. Acme Corp — {title}" />
          </Field>
          <Toggle label="Show date in header" checked={settings.header.showDate} onChange={(v) => setNested('header', { showDate: v })} />
          <Field label="Footer text">
            <Input value={settings.footer.text} onChange={(e) => setNested('footer', { text: e.target.value })} placeholder="e.g. Confidential" />
          </Field>
          <Toggle label="Page numbers" checked={settings.footer.pageNumbers} onChange={(v) => setNested('footer', { pageNumbers: v })} />
          {settings.footer.pageNumbers && (
            <Segmented size="sm" className="w-full" value={settings.footer.pageNumberStyle} onChange={(v) => setNested('footer', { pageNumberStyle: v })} options={[{ value: 'n-of-total', label: '1 / 12' }, { value: 'n', label: '1' }]} />
          )}
        </Section>

        <Section title="Structure" icon={<I.Book className="h-3.5 w-3.5" />}>
          <Toggle label="Cover page" description="A dedicated first page with the title." checked={settings.cover.enabled} onChange={(v) => setNested('cover', { enabled: v })} />
          {settings.cover.enabled && (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <Field label="Title" hint="Leave empty to use the first heading.">
                <Input value={settings.cover.title} onChange={(e) => setNested('cover', { title: e.target.value })} placeholder="Document title" />
              </Field>
              <Field label="Subtitle">
                <Input value={settings.cover.subtitle} onChange={(e) => setNested('cover', { subtitle: e.target.value })} placeholder="Optional subtitle" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Author">
                  <Input value={settings.cover.author} onChange={(e) => setNested('cover', { author: e.target.value })} placeholder="Name or team" />
                </Field>
                <Field label="Date">
                  <Input value={settings.cover.date} onChange={(e) => setNested('cover', { date: e.target.value })} placeholder="September 2026" />
                </Field>
              </div>
              {settings.logo && <Toggle label="Show logo on cover" checked={settings.cover.showLogo} onChange={(v) => setNested('cover', { showLogo: v })} />}
            </div>
          )}
          <Toggle label="Table of contents" description="Generated from H1–H3 headings." checked={settings.toc} onChange={(v) => set({ toc: v })} />
          <Toggle label="Number headings" description="1., 1.1, 1.1.1 …" checked={settings.headingNumbers} onChange={(v) => set({ headingNumbers: v })} />
        </Section>
      </div>
    </aside>
  );
}
