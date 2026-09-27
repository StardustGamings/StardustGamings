import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '@/components/shell/AppProviders';
import { AppShell } from '@/components/shell/AppShell';
import { THEME_INIT_SCRIPT } from '@/settings/resolve';
import { startupImages } from './splash';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Stardeck — Create. Swipe. Flex.', template: '%s · Stardeck' },
  description:
    'Stardeck is a free, local-first design studio for carousels, stories, covers, thumbnails and collages. No watermarks, no paywall, works offline.',
  applicationName: 'Stardeck',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'Stardeck', statusBarStyle: 'black-translucent', startupImage: startupImages },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A11',
};

const PRELOAD_FONTS = [
  '/fonts/bricolage-grotesque/bricolage-grotesque-latin-wght-normal.woff2',
  '/fonts/manrope/manrope-latin-wght-normal.woff2',
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-motion="full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {PRELOAD_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
