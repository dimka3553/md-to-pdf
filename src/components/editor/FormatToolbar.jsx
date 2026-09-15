'use client';

import { useEffect, useRef, useState } from 'react';
import { undo, redo } from '@codemirror/commands';
import * as I from '../icons';
import { IconButton, cx } from '../ui';
import * as cmd from '@/lib/client/editorCommands';
import { useElementWidth } from '@/lib/client/hooks';

// Below this width the secondary actions collapse into an "Insert" menu instead of overflowing.
const FULL_TOOLBAR_WIDTH = 720;

function Divider() {
  return <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />;
}

function Menu({ label, icon, children, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
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
  return (
    <div ref={ref} className="relative">
      <IconButton label={label} active={open} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {icon}
      </IconButton>
      {open && (
        <div role="menu" className={cx('pop-in absolute top-full z-50 mt-1 min-w-[190px] rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900', align === 'right' ? 'right-0' : 'left-0')} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children, shortcut, icon }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
      {icon && <span className="text-gray-400">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="font-mono text-[10px] text-gray-400">{shortcut}</span>}
    </button>
  );
}

function MenuHeading({ children }) {
  return <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{children}</div>;
}

const CODE_LANGS = ['', 'javascript', 'typescript', 'python', 'bash', 'json', 'sql', 'mermaid'];
const CALLOUTS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
const langLabel = (lang) => (lang === '' ? 'Plain code block' : lang === 'mermaid' ? 'Mermaid diagram' : lang);
const calloutLabel = (k) => k.charAt(0) + k.slice(1).toLowerCase();

export default function FormatToolbar({ viewRef, onInsertImage, isMac }) {
  const run = (fn) => () => {
    const view = viewRef.current;
    if (view) fn(view);
  };
  const mod = isMac ? '⌘' : 'Ctrl';
  const [ref, width] = useElementWidth();
  // Until measured, assume wide so the server-rendered markup matches the first client render.
  const collapsed = width > 0 && width < FULL_TOOLBAR_WIDTH;

  return (
    <div ref={ref} className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-gray-200 bg-white px-2 [scrollbar-width:none] dark:border-gray-800 dark:bg-gray-900 [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Formatting">
      <IconButton label={`Undo (${mod}+Z)`} onClick={run(undo)}><I.Undo /></IconButton>
      <IconButton label={`Redo (${mod}+Shift+Z)`} onClick={run(redo)}><I.Redo /></IconButton>
      <Divider />
      <Menu label="Heading" icon={<I.Heading />}>
        <MenuItem onClick={run((v) => cmd.setHeading(v, 1))} shortcut={`${mod}⌥1`}><span className="text-base font-bold">Heading 1</span></MenuItem>
        <MenuItem onClick={run((v) => cmd.setHeading(v, 2))} shortcut={`${mod}⌥2`}><span className="text-[15px] font-bold">Heading 2</span></MenuItem>
        <MenuItem onClick={run((v) => cmd.setHeading(v, 3))} shortcut={`${mod}⌥3`}><span className="font-semibold">Heading 3</span></MenuItem>
        <MenuItem onClick={run((v) => cmd.setHeading(v, 4))}>Heading 4</MenuItem>
        <MenuItem onClick={run((v) => cmd.setHeading(v, 0))} shortcut={`${mod}⌥0`}>Paragraph</MenuItem>
      </Menu>
      <IconButton label={`Bold (${mod}+B)`} onClick={run((v) => cmd.toggleInline(v, '**'))}><I.Bold /></IconButton>
      <IconButton label={`Italic (${mod}+I)`} onClick={run((v) => cmd.toggleInline(v, '*'))}><I.Italic /></IconButton>
      {!collapsed && <IconButton label={`Strikethrough (${mod}+Shift+X)`} onClick={run((v) => cmd.toggleInline(v, '~~'))}><I.Strike /></IconButton>}
      <IconButton label={`Inline code (${mod}+E)`} onClick={run((v) => cmd.toggleInline(v, '`', '`', 'code'))}><I.Code /></IconButton>
      <Divider />
      <IconButton label={`Bulleted list (${mod}+Shift+8)`} onClick={run((v) => cmd.toggleLinePrefix(v, 'bullet'))}><I.ListBullet /></IconButton>
      <IconButton label={`Numbered list (${mod}+Shift+7)`} onClick={run((v) => cmd.toggleLinePrefix(v, 'ordered'))}><I.ListOrdered /></IconButton>
      {!collapsed && <IconButton label={`Task list (${mod}+Shift+9)`} onClick={run((v) => cmd.toggleLinePrefix(v, 'task'))}><I.ListCheck /></IconButton>}
      {!collapsed && <IconButton label="Quote" onClick={run((v) => cmd.toggleLinePrefix(v, 'quote'))}><I.Quote /></IconButton>}
      <Divider />
      <IconButton label={`Link (${mod}+K)`} onClick={run((v) => cmd.insertLink(v))}><I.Link /></IconButton>
      <IconButton label="Insert image" onClick={onInsertImage}><I.Image /></IconButton>

      {collapsed ? (
        <Menu label="Insert" icon={<I.Plus />} align="right">
          <MenuHeading>Text</MenuHeading>
          <MenuItem icon={<I.Strike />} onClick={run((v) => cmd.toggleInline(v, '~~'))} shortcut={`${mod}⇧X`}>Strikethrough</MenuItem>
          <MenuItem icon={<I.ListCheck />} onClick={run((v) => cmd.toggleLinePrefix(v, 'task'))} shortcut={`${mod}⇧9`}>Task list</MenuItem>
          <MenuItem icon={<I.Quote />} onClick={run((v) => cmd.toggleLinePrefix(v, 'quote'))} shortcut={`${mod}⇧.`}>Quote</MenuItem>
          <MenuHeading>Blocks</MenuHeading>
          <MenuItem icon={<I.Table />} onClick={run((v) => cmd.insertTable(v))}>Table</MenuItem>
          <MenuItem icon={<I.CodeBlock />} onClick={run((v) => cmd.insertCodeBlock(v, ''))}>Code block</MenuItem>
          <MenuItem icon={<I.CodeBlock />} onClick={run((v) => cmd.insertCodeBlock(v, 'mermaid'))}>Mermaid diagram</MenuItem>
          <MenuItem icon={<I.Info />} onClick={run((v) => cmd.insertCallout(v, 'NOTE'))}>Callout</MenuItem>
          <MenuItem icon={<span className="text-[11px] font-bold leading-none">x<sup>1</sup></span>} onClick={run((v) => cmd.insertFootnote(v))}>Footnote</MenuItem>
          <MenuItem icon={<I.Minus />} onClick={run((v) => cmd.insertHorizontalRule(v))}>Horizontal rule</MenuItem>
          <MenuItem icon={<I.PageBreak />} onClick={run((v) => cmd.insertPageBreak(v))}>Page break</MenuItem>
        </Menu>
      ) : (
        <>
          <IconButton label="Table" onClick={run((v) => cmd.insertTable(v))}><I.Table /></IconButton>
          <Menu label="Code block" icon={<I.CodeBlock />}>
            {CODE_LANGS.map((lang) => (
              <MenuItem key={lang || 'plain'} onClick={run((v) => cmd.insertCodeBlock(v, lang))}>{langLabel(lang)}</MenuItem>
            ))}
          </Menu>
          <Divider />
          <Menu label="Callout" icon={<I.Info />}>
            {CALLOUTS.map((k) => (
              <MenuItem key={k} onClick={run((v) => cmd.insertCallout(v, k))}>{calloutLabel(k)}</MenuItem>
            ))}
          </Menu>
          <IconButton label="Footnote" onClick={run((v) => cmd.insertFootnote(v))}><span className="text-[11px] font-bold leading-none">x<sup>1</sup></span></IconButton>
          <IconButton label="Horizontal rule" onClick={run((v) => cmd.insertHorizontalRule(v))}><I.Minus /></IconButton>
          <IconButton label="Page break" onClick={run((v) => cmd.insertPageBreak(v))}><I.PageBreak /></IconButton>
        </>
      )}
    </div>
  );
}
