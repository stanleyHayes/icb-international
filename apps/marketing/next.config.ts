import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Traces the exact modules the server needs, so the runtime image stays small.
  output: 'standalone',
  // The design system ships as TypeScript source so apps share one build pipeline and one
  // Tailwind scan; transpiling it here is what makes that work.
  transpilePackages: ['@icb/ui', '@icb/money', '@icb/contracts'],
  typedRoutes: true,
  poweredByHeader: false,
};

export default config;
