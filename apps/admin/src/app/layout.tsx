import type { Metadata, Viewport } from 'next';
import { Outfit, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3102';

export const metadata: Metadata = {
  // Absolute URLs for the manifest and icon links. Without it Next warns and emits
  // relative ones, which break the moment a page is fetched from anywhere but the root.
  metadataBase: new URL(BASE_URL),
  title: { default: 'ICB Console', template: '%s · ICB Console' },
  description: 'ICB back-office operations console.',
  // Both declared explicitly. An `icons` object switches off Next's file-based detection,
  // so naming only the favicon left apple-icon.tsx served at /apple-icon but never linked —
  // and iOS ignores SVG apple-touch-icons, which is what this pointed at before.
  icons: { icon: '/favicon.svg', apple: '/apple-icon' },
  // A banking dashboard has nothing to gain from being indexed and much to lose.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0b2c4d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-[var(--icb-bg-subtle)] antialiased">{children}</body>
    </html>
  );
}
