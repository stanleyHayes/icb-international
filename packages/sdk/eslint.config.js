import { baseConfig } from '@icb/config-eslint';

export default [
  ...baseConfig,
  {
    // The endpoint factories return a structural type that is already named, one line below each
    // of them, as `ReturnType<typeof createXApi>`. Annotating the function with that alias would
    // be circular, and spelling the shape out by hand would be a second copy of the client that
    // silently drifts from the first. Inference is the single source of truth here.
    files: ['src/endpoints/*.ts', 'src/client.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];
