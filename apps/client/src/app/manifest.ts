import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * `standalone` so an installed dashboard opens without browser chrome: a customer
 * checking a balance on a phone should not be looking at an address bar.
 *
 * Icons point at the file-based metadata routes rather than `public/`, so there is one source of
 * truth for the mark: `icon.svg` scales to any size, and `apple-icon` is the PNG iOS insists on.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ICB Online Banking',
    short_name: 'ICB',
    description: 'Manage your ICB accounts, cards, payments and lending.',
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
