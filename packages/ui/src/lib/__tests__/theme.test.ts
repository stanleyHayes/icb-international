import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  isThemePreference,
  parseStoredTheme,
  resolveTheme,
  themeScriptSource,
} from '../theme';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_ATTRIBUTE,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
} from '../theme.constants';

describe('isThemePreference', () => {
  it('accepts the three preferences', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isThemePreference('solarized')).toBe(false);
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(42)).toBe(false);
  });
});

describe('parseStoredTheme', () => {
  it('returns a stored explicit choice', () => {
    expect(parseStoredTheme('dark')).toBe('dark');
    expect(parseStoredTheme('light')).toBe('light');
  });

  it('falls back to the default on missing or corrupted storage', () => {
    expect(parseStoredTheme(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseStoredTheme('blue')).toBe(DEFAULT_THEME_PREFERENCE);
  });
});

describe('resolveTheme', () => {
  it('passes explicit choices through', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('resolves system from the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

interface ScriptResult {
  attributes: Map<string, string>;
  style: Record<string, string>;
  mediaQuery: string | null;
}

/** Evaluate the real boot script against a minimal DOM, exactly as a browser would. */
function runBootScript(options: { stored: string | null; systemDark: boolean }): ScriptResult {
  const attributes = new Map<string, string>();
  const style: Record<string, string> = {};
  let mediaQuery: string | null = null;
  const sandbox = {
    localStorage: {
      getItem: (key: string) => {
        if (key !== THEME_STORAGE_KEY) {
          throw new Error(`unexpected storage key: ${key}`);
        }
        if (options.stored === 'throw') {
          throw new Error('storage denied');
        }
        return options.stored;
      },
    },
    window: {
      matchMedia: (query: string) => {
        mediaQuery = query;
        return { matches: options.systemDark };
      },
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        style,
      },
    },
  };
  runInNewContext(themeScriptSource(), sandbox);
  return { attributes, style, mediaQuery };
}

describe('themeScriptSource', () => {
  it('applies a stored explicit theme regardless of the OS', () => {
    const result = runBootScript({ stored: 'light', systemDark: true });
    expect(result.attributes.get(THEME_ATTRIBUTE)).toBe('light');
    expect(result.style['colorScheme']).toBe('light');
  });

  it('prefers stored dark over a light OS', () => {
    const result = runBootScript({ stored: 'dark', systemDark: false });
    expect(result.attributes.get(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('falls back to prefers-color-scheme when nothing is stored', () => {
    expect(runBootScript({ stored: null, systemDark: true }).attributes.get(THEME_ATTRIBUTE)).toBe(
      'dark',
    );
    expect(runBootScript({ stored: null, systemDark: false }).attributes.get(THEME_ATTRIBUTE)).toBe(
      'light',
    );
  });

  it('ignores a corrupted stored value and uses the OS', () => {
    const result = runBootScript({ stored: 'solarized', systemDark: true });
    expect(result.attributes.get(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('queries the shared media query constant', () => {
    expect(runBootScript({ stored: null, systemDark: false }).mediaQuery).toBe(THEME_MEDIA_QUERY);
  });

  it('never throws, even when storage is unavailable', () => {
    expect(() => runBootScript({ stored: 'throw', systemDark: false })).not.toThrow();
  });
});
