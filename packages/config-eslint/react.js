import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from './index.js';

/** React / Next.js configuration. Relaxes file size for route components, keeps type safety. */
export const reactConfig = tseslint.config(...baseConfig, {
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
  },
  rules: {
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    /*
     * Off for Next apps, and only for Next apps.
     *
     * `typedRoutes` generates the `Route` union into .next/types, and that union is not the same
     * in dev as in a production build: while the dev server is running it contains concrete paths
     * that the build only knows as dynamic segments (`/personal/current` vs `/personal/[product]`),
     * and query-string variants it can never know at all. The rule reads whichever table happens
     * to be on disk, calls the necessary `as Route` assertions redundant, and `--fix` deletes
     * them — after which the production build fails on every one. The rule cannot be sound about
     * a type that changes underneath it.
     */
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
  },
});

export default reactConfig;
