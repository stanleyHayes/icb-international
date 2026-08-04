import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * Installable so the public site behaves like the bank's app when a customer adds
 * it to a home screen — the same identity they will see after signing in.
 *
 * Icons point at the file-based metadata routes rather than `public/`, so there is one source of
 * truth for the mark: `icon.svg` scales to any size, and `apple-icon` is the PNG iOS insists on.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ICB International Commercial Bank',
    short_name: 'ICB',
    description: 'Current accounts, savings, cards, lending and international payments.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // The brand navy, matching the dark-theme `--icb-bg` the apps render against.
    background_color: '#040f1c',
    theme_color: '#040f1c',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
