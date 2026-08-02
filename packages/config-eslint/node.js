import tseslint from 'typescript-eslint';

import { baseConfig } from './index.js';

/**
 * Node/NestJS configuration.
 *
 * Adds the `new Date()` ban required by agent_plan.md N8 — domain code must take time from
 * ClockService so that simulated time travel works everywhere.
 */
export const nodeConfig = tseslint.config(...baseConfig, {
  rules: {
    // NestJS supplies constructor dependencies by type; a 6-dependency service is not the same
    // smell as a 6-argument function, and there is no call site to simplify.
    'max-params': ['error', 6],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSEnumDeclaration',
        message: 'Use a const object + union type instead of an enum (tree-shaking, contracts).',
      },
      {
        selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
        message:
          'Use ClockService.now() — a zero-argument Date reads the host clock and breaks time simulation (N8). Constructing from a clock-derived value is fine.',
      },
      {
        selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
        message: 'Use ClockService.now() — Date.now() breaks time simulation (N8).',
      },
      {
        selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
        message: 'Use RandomService — Math.random() breaks deterministic seeding.',
      },
    ],
  },
});

export default nodeConfig;
