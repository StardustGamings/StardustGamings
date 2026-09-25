import type { NextConfig } from 'next';

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
};

export default nextConfig;
