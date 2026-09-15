'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useState persisted to localStorage. Reads lazily on mount so SSR output is
 * deterministic; `hydrated` flips true once the stored value has been applied.
 */
export function usePersistentState(key, initialValue, { serialize = JSON.stringify, deserialize = JSON.parse } = {}) {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const skipWrite = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(deserialize(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialize(value));
      } catch (err) {
        console.warn(`[storage] Could not persist "${key}":`, err?.message);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [key, value, hydrated, serialize]);

  return [value, setValue, hydrated];
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Observe an element's content box width. */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Global keyboard shortcuts (Mod = ⌘ on macOS, Ctrl elsewhere). */
export function useShortcuts(map) {
  const mapRef = useRef(map);
  mapRef.current = map;
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = `${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`;
      const handler = mapRef.current[key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  return isMac;
}

export function useCallbackRef(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}
