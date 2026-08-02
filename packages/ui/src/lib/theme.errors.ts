/** Thrown when `useTheme` runs outside a `ThemeProvider` — a wiring bug, not a runtime state. */
export class MissingThemeProviderError extends Error {
  constructor() {
    super('useTheme must be used within a <ThemeProvider>.');
    this.name = 'MissingThemeProviderError';
  }
}
