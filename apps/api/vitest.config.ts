import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Integration tests boot a real Nest app against MongoDB; they need room.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: false,
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.module.ts',
        'src/main.ts',
        'src/**/*.schema.ts',
        // CLI entrypoints — same class as main.ts (process bootstrap, not unit-testable).
        'src/**/*.cli.ts',
        // Seed/reset tooling — drives a live database end-to-end; covered by the
        // integration layer (QA-03) against real Mongo, not by mocked unit tests.
        'src/simulation/seed/**',
        'src/modules/products/catalogue.seeder.ts',
        // Chaos/scenario runners — simulation ops tooling exercised via the
        // simulation control room (ADM-16) and E2E, not unit-testable at a port boundary.
        'src/simulation/scenarios/**',
      ],
      // The unit-coverage gate of agent_plan.md §10. Enforced by `pnpm test:cov`
      // (the default `pnpm test` runs without coverage and is unaffected).
      thresholds: {
        lines: 85,
        branches: 80,
      },
    },
  },
});
