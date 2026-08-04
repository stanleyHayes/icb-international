import { expect, test } from 'playwright/test';

import {
  expectFocusProgression,
  expectNoFocusLoss,
  expectVisibleFocus,
  tabTrail,
} from './support/keyboard';
import { readAvailability, underA11yConfig } from './support/state';

/**
 * Keyboard traversal, admin console: staff sign-in and the console shell. Runs with the
 * enrolled-staff storage state; /login still renders when signed in.
 */

const availability = readAvailability();
test.skip(!underA11yConfig(), 'run via pnpm test:a11y (e2e/a11y/playwright.config.ts)');
test.skip(
  !(availability.api && availability.apps['admin'] === true),
  'admin app or API not reachable',
);

test('staff login form tabs email → password → reveal → submit', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').focus();

  const trail = await tabTrail(page, 4);
  expectNoFocusLoss(trail);
  expect(trail[0].label).toBe('/forgot-password');
  expect(trail[1].label).toBe('password');
  expect(trail[2].label).toBe('Show password');
  expect(trail[3].label).toBe('Sign in');
});

test('staff login controls show a visible focus indicator', async ({ page }) => {
  await page.goto('/login');
  await expectVisibleFocus(page, 'input[name="email"]');
  await expectVisibleFocus(page, 'button[type="submit"]');
});

test('console shell exposes navigation landmark and traverses cleanly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeAttached();
  await expect(page.getByRole('navigation', { name: 'Console' })).toBeAttached();

  const trail = await tabTrail(page, 15);
  expectNoFocusLoss(trail);
  expectFocusProgression(trail);
});

test('data-heavy route (audit explorer) stays keyboard operable', async ({ page }) => {
  const response = await page.goto('/audit');
  test.skip(response?.status() === 404, 'audit route not available');
  const trail = await tabTrail(page, 20);
  expectNoFocusLoss(trail);
});
