'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { parseStoredTheme, resolveTheme } from '../lib/theme';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_ATTRIBUTE,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme.constants';
import { MissingThemeProviderError } from '../lib/theme.errors';

interface ThemeContextValue {
  /** The stored preference, which may be `system`. */
  theme: ThemePreference;
  /** The concrete theme currently applied to `<html>`. */
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemePreference;
  storageKey?: string;
}

/**
 * Client-side theme state. Pairs with `<ThemeScript />`: the script sets the initial
 * `data-theme` before paint, the provider takes over afterwards — persisting choices and
 * tracking the OS while the preference is `system`.
 */
export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME_PREFERENCE,
  storageKey = THEME_STORAGE_KEY,
}: Readonly<ThemeProviderProps>) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    return parseStoredTheme(window.localStorage.getItem(storageKey));
  });
  const [systemDark, setSystemDark] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(THEME_MEDIA_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(THEME_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (preference: ThemePreference) => {
      setThemeState(preference);
      window.localStorage.setItem(storageKey, preference);
    },
    [storageKey],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context == null) {
    throw new MissingThemeProviderError();
  }
  return context;
}
