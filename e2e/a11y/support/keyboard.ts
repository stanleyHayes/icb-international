import { expect, type Page } from 'playwright/test';

/**
 * Keyboard-traversal primitives for the key flows: skip links, tab order, focus
 * visibility (heuristic: any of outline / box-shadow / border changes on focus), and
 * trap detection.
 */

export interface TabStop {
  readonly tag: string;
  readonly label: string;
  /** Stable per-element identity within the page, so trap detection ignores look-alikes. */
  readonly uid: number;
}

async function describeActive(page: Page): Promise<TabStop> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __a11yIds?: WeakMap<Element, number>;
      __a11yNext?: number;
    };
    w.__a11yIds ??= new WeakMap();
    w.__a11yNext ??= 0;
    const el = document.activeElement;
    if (!el) {
      return { tag: 'none', label: '', uid: -1 };
    }
    let uid = w.__a11yIds.get(el);
    if (uid === undefined) {
      uid = w.__a11yNext;
      w.__a11yNext += 1;
      w.__a11yIds.set(el, uid);
    }
    const label =
      el.getAttribute('aria-label') ??
      el.getAttribute('name') ??
      el.getAttribute('href') ??
      (el.textContent ?? '').trim().slice(0, 60);
    return { tag: el.tagName.toLowerCase(), label, uid };
  });
}

/** Press Tab `count` times, returning the focus trail. */
export async function tabTrail(page: Page, count: number): Promise<TabStop[]> {
  const trail: TabStop[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press('Tab');
    trail.push(await describeActive(page));
  }
  return trail;
}

/**
 * Focus dumped on <body> mid-flow = broken. Tabbing past the last focusable element
 * wraps to the top of the document, which is normal — only flag a body stop when focus
 * afterwards reaches an element never visited before (genuinely lost mid-flow).
 */
export function expectNoFocusLoss(trail: readonly TabStop[]): void {
  let maxSeen = -1;
  const lost: TabStop[] = [];
  for (let i = 0; i < trail.length; i += 1) {
    const stop = trail[i];
    if (stop.tag === 'body' || stop.tag === 'none') {
      const continuesToNew = trail.slice(i + 1).some((later) => later.uid > maxSeen);
      if (continuesToNew) {
        lost.push(stop);
      }
      continue;
    }
    maxSeen = Math.max(maxSeen, stop.uid);
  }
  expect(lost, `focus was lost to <body> during traversal: ${JSON.stringify(trail)}`).toEqual([]);
}

/** Every Tab must move focus somewhere; the same element twice in a row suggests a trap. */
export function expectFocusProgression(trail: readonly TabStop[]): void {
  for (let i = 1; i < trail.length; i += 1) {
    const stuck = trail[i].uid >= 0 && trail[i].uid === trail[i - 1].uid;
    expect(stuck, `focus appears trapped on ${JSON.stringify(trail[i])}`).toBe(false);
  }
}

const FOCUS_PROPS = ['outlineColor', 'outlineWidth', 'boxShadow', 'borderColor'] as const;

/** Heuristic WCAG 2.4.7 check: does focusing this element change its visible style? */
export async function expectVisibleFocus(page: Page, selector: string): Promise<void> {
  const diff = await page.evaluate(
    ({ selector: sel, props }) => {
      const el = document.querySelector(sel);
      if (!(el instanceof HTMLElement)) {
        return { found: false, changed: [] as string[] };
      }
      const before = props.map((p) => getComputedStyle(el)[p] as string);
      el.focus();
      const after = props.map((p) => getComputedStyle(el)[p] as string);
      el.blur();
      const changed = props.filter((_, i) => before[i] !== after[i]);
      return { found: true, changed };
    },
    { selector, props: [...FOCUS_PROPS] },
  );
  expect(diff.found, `no element matches ${selector}`).toBe(true);
  expect(
    diff.changed.length > 0,
    `${selector} shows no visible change on focus (checked ${FOCUS_PROPS.join(', ')})`,
  ).toBe(true);
}

/** Assert the skip link exists, takes focus early in the tab order, and lands on main. */
export async function expectSkipLink(page: Page, href: string): Promise<void> {
  const skip = page.locator(`a[href="${href}"]`).first();
  await expect(skip, `skip link ${href} missing`).toBeAttached();
  await page.keyboard.press('Tab');
  await expect(skip, 'skip link is not the first tab stop').toBeFocused();
  await page.keyboard.press('Enter');
  const id = href.slice(1);
  const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
  expect(focusedId, `skip link should move focus to #${id}`).toBe(id);
}
