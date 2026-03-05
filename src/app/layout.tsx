import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Welokl — Your Neighbourhood, Delivered',
  description: 'Order from any local shop nearby. Food, grocery, pharmacy & more — delivered or pick up yourself.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Welokl' },
}

export const viewport: Viewport = {
  themeColor: '#ff3008',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Welokl" />

        {/*
          ┌─────────────────────────────────────────────────────────┐
          │  ANTI-FLASH THEME SCRIPT                                │
          │  Runs synchronously before any paint.                   │
          │  Reads localStorage → applies html.dark class instantly │
          │  so the user never sees a white flash in dark mode.     │
          └─────────────────────────────────────────────────────────┘
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var t = localStorage.getItem('welokl_theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = t === 'dark' || (!t && prefersDark) || (t === 'system' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
            `.trim()
          }}
        />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  });
}
          `.trim()
        }} />
      </body>
    </html>
  )
}