// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Syne, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import CartProvider from '@/components/CartProvider'
import InstallPrompt from '@/components/InstallPrompt'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['700', '800'],
  display: 'swap',
  preload: true,
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  preload: true,
})

export const viewport: Viewport = {
  themeColor: '#FF3008',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Dwarpar — Anything nearby, delivered',
  description: 'Hyperlocal delivery from local shops, restaurants and pharmacies near you.',
  keywords: ['hyperlocal', 'delivery', 'local shops', 'grocery', 'food', 'pharmacy'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dwarpar',
  },
  openGraph: {
    title: 'Dwarpar — Anything nearby, delivered',
    description: 'Your neighbourhood, delivered in under 30 min.',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dwarpar',
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
    <html lang="en" className={`${syne.variable} ${jakarta.variable}`}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <meta name="color-scheme" content="light dark" />
        {/* Preconnect to Supabase — eliminates cold DNS+TLS cost on first DB call */}
        <link rel="preconnect" href={`https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}`} />
        <link rel="dns-prefetch" href={`https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}`} />
      </head>
      <body className="bg-surface-50 text-surface-900 font-sans antialiased">
        <CartProvider>
          {children}
          <InstallPrompt />
        </CartProvider>
      </body>
    </html>
  )
}