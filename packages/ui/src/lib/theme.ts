import {
  DEFAULT_THEME_PREFERENCE,
  THEME_ATTRIBUTE,
  THEME_MEDIA_QUERY,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './theme.constants';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Normalise whatever localStorage held (missing, stale, or corrupted) into a valid preference. */
export function parseStoredTheme(raw: string | null): ThemePreference {
  return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE;
}

/** Collapse a preference into the concrete theme the DOM should carry. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Source of the blocking inline script rendered by `ThemeScript`.
 *
 * It runs before first paint, reads the stored preference (falling back to the OS), and stamps
 * `data-theme` + `color-scheme` onto `<html>` — so a dark-mode user never sees a light flash.
 * Built from the shared constants, the script can never disagree with the provider about the
 * storage key or attribute. Any failure (private-mode storage, old browser) degrades to the
 * stylesheet default rather than breaking page load.
 */
export function themeScriptSource(): string {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const attr = JSON.stringify(THEME_ATTRIBUTE);
  const query = JSON.stringify(THEME_MEDIA_QUERY);
  return (
    `(function(){try{` +
    `var s=localStorage.getItem(${key});` +
    `var d=s==='light'||s==='dark'?s:window.matchMedia(${query}).matches?'dark':'light';` +
    `var e=document.documentElement;` +
    `e.setAttribute(${attr},d);` +
    `e.style.colorScheme=d;` +
    `}catch(_){}})();`
  );
}
