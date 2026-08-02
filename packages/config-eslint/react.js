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
  },
});

export default reactConfig;
