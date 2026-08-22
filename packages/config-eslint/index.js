import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ICB base ESLint configuration.
 *
 * Encodes the quality bar from agent_plan.md §1 so that a violation fails CI rather than
 * surviving review. Every threshold here is deliberate — raise one only with an ADR.
 */
export const baseConfig = tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node, ...globals.es2023 },
      parserOptions: { projectService: true },
    },
    rules: {
      // ---- Size and shape (agent_plan.md §1) --------------------------------
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4],
      'max-depth': ['error', 3],
      complexity: ['error', 10],

      // ---- Type safety -------------------------------------------------------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // ---- Correctness -------------------------------------------------------
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': ['error', { props: true }],
      'prefer-const': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a const object + union type instead of an enum (tree-shaking, contracts).',
        },
      ],

      // ---- SonarQube parity ---------------------------------------------------
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 4 }],
      'sonarjs/no-nested-template-literals': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/no-commented-code': 'error',
      'sonarjs/todo-tag': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**', '**/*.factory.ts', '**/seed/**'],
    rules: {
      // Crashes on the TypeScript 6 AST (eslint-plugin-sonarjs#S2699). Assertion presence is
      // already guaranteed by the coverage gate, so the rule earns nothing here.
      'sonarjs/assertions-in-tests': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-identical-functions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Fixture builders return large inferred mock shapes. Spelling those out is churn that
      // rots on the next field change, and a test helper is not a published module boundary.
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  prettier,
);

export default baseConfig;
