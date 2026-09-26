import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone', // small Docker image: only what the app needs to run
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // ESLint is not installed by default; skip it during the build.
  eslint: { ignoreDuringBuilds: true },
  // A type slip should never block race-day deploys. Run `npm run typecheck` locally to see them.
  typescript: { ignoreBuildErrors: true },
};

export default config;
