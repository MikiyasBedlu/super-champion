import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone', // small Docker image: only what the app needs to run
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // ESLint is not installed by default; skip it during the build.
  eslint: { ignoreDuringBuilds: true },
  // If a type error ever blocks a deploy, flip this to true to ship, then fix it with `npm run typecheck`.
  typescript: { ignoreBuildErrors: false },
};

export default config;
