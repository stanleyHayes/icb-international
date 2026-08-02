import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The Mongo harness needs a live replica set; it is exercised by QA-03's integration
      // suite, not by unit tests. Its pure parts (URI rewriting) are tested and live in core.
      exclude: ['src/index.ts', 'src/**/__tests__/**', 'src/mongo/**'],
      thresholds: { lines: 85, branches: 80, functions: 85, statements: 85 },
    },
  },
});
