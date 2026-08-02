import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MissingThemeProviderError } from '../../lib/theme.errors';
import { THEME_ATTRIBUTE, THEME_MEDIA_QUERY, THEME_STORAGE_KEY } from '../../lib/theme.constants';
import { ThemeProvider, useTheme } from '../theme-provider';
import { ThemeScript } from '../theme-script';

describe('ThemeScript', () => {
  it('renders a blocking script built from the shared constants', () => {
    const html = renderToStaticMarkup(<ThemeScript />);
    expect(html).toMatch(/^<script id="icb-theme-init">/);
    expect(html).toContain(THEME_STORAGE_KEY);
    expect(html).toContain(THEME_ATTRIBUTE);
    expect(html).toContain(THEME_MEDIA_QUERY);
  });
});

describe('ThemeProvider', () => {
  it('renders children on the server without touching browser APIs', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <p>Accounts</p>
      </ThemeProvider>,
    );
    expect(html).toContain('Accounts');
  });
});

describe('useTheme', () => {
  it('throws a typed error outside the provider', () => {
    function Bare() {
      useTheme();
      return null;
    }
    expect(() => renderToStaticMarkup(<Bare />)).toThrow(MissingThemeProviderError);
  });
});
