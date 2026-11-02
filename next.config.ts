import type { NextConfig } from 'next';
import { version } from './package.json';

/**
 * Stardeck ships as a fully static, offline-capable client app. `output: 'export'`
 * produces plain HTML/JS/CSS in `out/` that can be hosted anywhere, installed as a
 * PWA, or wrapped by Capacitor for Android/iOS without a Node server.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  devIndicators: false,
  // `SOURCE_MAPS=1 npm run build` for profiling a production build; off for normal builds.
  productionBrowserSourceMaps: process.env.SOURCE_MAPS === '1',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    // The pre-rendered pages show the trend drop that was live when they were built (see src/trends/loader.ts).
    NEXT_PUBLIC_BUILD_TIME: String(Date.now()),
  },
};

export default nextConfig;
