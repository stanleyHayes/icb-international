import type { Metadata, Viewport } from 'next';
import { Outfit, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { SupportChat } from '@/features/chat/support-chat';

import './globals.css';

/**
 * Fonts are self-hosted by next/font at build time — no request to a font CDN at runtime, no
 * layout shift, and the brand face is guaranteed present rather than falling back.
 */
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

const BASE_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'ICB — International Commercial Bank',
    template: '%s · ICB',
  },
  description:
    'Banking built on a real double-entry core. Current accounts, savings, cards, lending and international payments — with every posting traceable to the cent.',
  openGraph: {
    type: 'website',
    siteName: 'ICB International Commercial Bank',
    title: 'ICB — International Commercial Bank',
    description: 'Banking, exactly. Every posting traceable to the cent.',
  },
  // Both declared explicitly. An `icons` object switches off Next's file-based detection,
  // so naming only the favicon left apple-icon.tsx served at /apple-icon but never linked —
  // and iOS ignores SVG apple-touch-icons, which is what this pointed at before.
  icons: { icon: '/favicon.svg', apple: '/apple-icon' },
  robots:
    process.env.NODE_ENV === 'production'
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#040f1c' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-[var(--icb-bg)] antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-[var(--icb-navy-700)] focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <SupportChat />
      </body>
    </html>
  );
}
