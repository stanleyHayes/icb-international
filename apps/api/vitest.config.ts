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
      exclude: ['src/**/*.spec.ts', 'src/**/*.module.ts', 'src/main.ts', 'src/**/*.schema.ts'],
    },
  },
});
