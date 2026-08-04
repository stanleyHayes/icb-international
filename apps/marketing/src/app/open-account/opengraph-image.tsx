import { ogImage } from '@/lib/seo/og-image';

export const alt = 'Open an ICB account in under ten minutes.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return ogImage(
    'Open an account in ten minutes.',
    'A current account in the currency you choose, a virtual card immediately, identity checked in the app.',
  );
}
