import { BrandSplash } from '@icb/ui';

/**
 * Route-level loading UI.
 *
 * Next renders this while a route segment streams. It draws the ICB mark rather than spinning a
 * generic indicator, so the wait is still the brand and not a gap in it.
 */
export default function Loading() {
  return <BrandSplash label="Loading your accounts" id="client" />;
}
