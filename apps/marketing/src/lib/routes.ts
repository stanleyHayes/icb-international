import type { Route } from 'next';

/**
 * Narrow a concrete product URL to `Route`.
 *
 * Product pages are served by `[product]` dynamic segments, so `typedRoutes` publishes
 * `/personal/[product]` — never `/personal/current`. Every concrete href in the catalogue and
 * the footer therefore needs asserting.
 *
 * It lives behind a function rather than as inline `as Route` on each entry for a specific
 * reason: while the dev server is running, the generated route table briefly contains the
 * concrete paths, which makes `@typescript-eslint/no-unnecessary-type-assertion` flag every
 * inline assertion as redundant. `eslint --fix` then deletes all of them, and the next
 * production build fails on the lot. A call is not an assertion the rule can see, so this
 * survives both route tables and the fixer.
 */
export const productRoute = (href: string): Route => href as Route;
