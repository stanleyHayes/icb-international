import { expect, test } from 'playwright/test';

import {
  expectFocusProgression,
  expectNoFocusLoss,
  expectVisibleFocus,
  tabTrail,
} from './support/keyboard';
import { readAvailability, underA11yConfig } from './support/state';

/**
 * Keyboard traversal, client app: the sign-in flow and the authenticated shell.
 * Runs with the demo-customer storage state; /login still renders when signed in.
 */

const availability = readAvailability();
test.skip(!underA11yConfig(), 'run via pnpm test:a11y (e2e/a11y/playwright.config.ts)');
test.skip(
  !(availability.api && availability.apps['client'] === true),
  'client app or API not reachable',
);

test('login form tabs email → password → reveal → submit in DOM order', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').focus();

  const trail = await tabTrail(page, 4);
  expectNoFocusLoss(trail);
  expect(trail[0].label, 'after email comes the forgot-password link').toBe('/forgot-password');
  expect(trail[1].label, 'then the password field').toBe('password');
  expect(trail[2].label, 'then the reveal toggle').toBe('Show password');
  expect(trail[3].label, 'then the submit button').toBe('Sign in');
});

test('login form controls show a visible focus indicator', async ({ page }) => {
  await page.goto('/login');
  await expectVisibleFocus(page, 'input[name="email"]');
  await expectVisibleFocus(page, 'input[name="password"]');
  await expectVisibleFocus(page, 'button[type="submit"]');
});

test('dashboard shell landmarks and nav are exposed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeAttached();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeAttached();
});

test('dashboard tab order walks the shell without losing focus', async ({ page }) => {
  await page.goto('/');
  const trail = await tabTrail(page, 15);
  expectNoFocusLoss(trail);
  expectFocusProgression(trail);
});

test('transfer form: amount flow is fully keyboard reachable', async ({ page }) => {
  await page.goto('/transfer/new');
  const trail = await tabTrail(page, 25);
  expectNoFocusLoss(trail);
  expectFocusProgression(trail);
  const tags = new Set(trail.map((stop) => stop.tag));
  expect(tags.has('input') || tags.has('select') || tags.has('button')).toBe(true);
});

test('new-beneficiary form fields take keyboard focus in order', async ({ page }) => {
  await page.goto('/beneficiaries/new');
  const trail = await tabTrail(page, 20);
  expectNoFocusLoss(trail);
  expect(trail.some((stop) => stop.tag === 'input')).toBe(true);
});
