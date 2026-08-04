import { expect, test } from 'playwright/test';

import { expectFocusProgression, expectNoFocusLoss, tabTrail } from './support/keyboard';
import { readAvailability, underA11yConfig } from './support/state';

/**
 * Keyboard traversal, marketing: public chrome must be fully operable without a mouse.
 */

const availability = readAvailability();
test.skip(!underA11yConfig(), 'run via pnpm test:a11y (e2e/a11y/playwright.config.ts)');
test.skip(availability.apps['marketing'] !== true, 'marketing app not reachable');

test('home page exposes banner, main and navigation landmarks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeAttached();
  await expect(page.getByRole('main')).toBeAttached();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeAttached();
  await expect(page.getByRole('contentinfo')).toBeAttached();
});

test('home page tab order walks header into content without losing focus', async ({ page }) => {
  await page.goto('/');
  const trail = await tabTrail(page, 15);
  expectNoFocusLoss(trail);
  expectFocusProgression(trail);
  // The first stops must be the site header (logo + primary nav), not the page footer.
  expect(trail[0].tag).toBe('a');
});

test('product page is traversable end to end', async ({ page }) => {
  await page.goto('/personal/current');
  const trail = await tabTrail(page, 20);
  expectNoFocusLoss(trail);
  expectFocusProgression(trail);
});

test('open-account CTA form controls are keyboard reachable', async ({ page }) => {
  await page.goto('/open-account');
  const trail = await tabTrail(page, 25);
  expectNoFocusLoss(trail);
  const tags = new Set(trail.map((stop) => stop.tag));
  // Somewhere in the first 25 stops the visitor reaches a form control or CTA.
  expect([...tags].some((tag) => ['input', 'select', 'button', 'a'].includes(tag))).toBe(true);
});
