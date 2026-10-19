import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'hearth.theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** Light ↔ dark (from system, flips whatever is showing now). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readStored = (): ThemePreference => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
};

const systemPrefersDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Sets `data-theme` on <html>. The inline script in index.html applies the stored value before
 * paint; this provider keeps it in sync with the person's profile preference and the OS setting.
 */
export function ThemeProvider({
  children,
  preference: external,
  onPreferenceChange,
}: {
  children: ReactNode;
  /** The profile preference from /me, when known. */
  preference?: ThemePreference;
  onPreferenceChange?: (pref: ThemePreference) => void;
}) {
  const [preference, setPref] = useState<ThemePreference>(() => external ?? readStored());
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Adopt the profile preference when it arrives or changes on another device.
  useEffect(() => {
    if (external) setPref(external);
  }, [external]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* storage unavailable — the theme still applies for this session */
    }
  }, [resolved, preference]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPref(pref);
      onPreferenceChange?.(pref);
    },
    [onPreferenceChange],
  );
  const toggle = useCallback(() => setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference]);

  const value = useMemo(() => ({ preference, resolved, setPreference, toggle }), [preference, resolved, setPreference, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}
