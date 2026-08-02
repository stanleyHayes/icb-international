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

export const metadata: Metadata = {
  title: { default: 'ICB Console', template: '%s · ICB Console' },
  description: 'ICB back-office operations console.',
  icons: { icon: '/favicon.svg', apple: '/icon.svg' },
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
    <html lang="en" className={`${outfit.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-[var(--icb-bg-subtle)] antialiased">{children}</body>
    </html>
  );
}
