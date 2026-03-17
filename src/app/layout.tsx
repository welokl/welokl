// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Syne } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
})

export const viewport: Viewport = {
  themeColor: '#FF3008',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Welokl — Anything nearby, delivered',
  description: 'Hyperlocal delivery from local shops, restaurants and pharmacies near you.',
  keywords: ['hyperlocal', 'delivery', 'local shops', 'grocery', 'food', 'pharmacy'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Welokl',
  },
  openGraph: {
    title: 'Welokl — Anything nearby, delivered',
    description: 'Your neighbourhood, delivered in under 30 min.',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Welokl',
    description: 'Hyperlocal delivery from local shops near you.',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={syne.variable}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="bg-surface-50 text-surface-900 font-sans antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2500,
            className: 'font-sans text-sm',
            style: {
              background: '#1a1a1a',
              color: '#f2f2f2',
              borderRadius: '14px',
              fontSize: '14px',
              padding: '12px 18px',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#FF3008', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}