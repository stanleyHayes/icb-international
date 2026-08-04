import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * Named distinctly from the customer app on purpose: a staff member with both
 * installed must never be one home-screen tap away from confusing them.
 *
 * Icons point at the file-based metadata routes rather than `public/`, so there is one source of
 * truth for the mark: `icon.svg` scales to any size, and `apple-icon` is the PNG iOS insists on.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ICB Operations Console',
    short_name: 'ICB Console',
    description: 'ICB back-office operations console.',
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
