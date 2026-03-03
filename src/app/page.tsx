'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const categories = [
  { icon: '🍔', name: 'Food', color: '#fff3ef', border: '#ffccbc' },
  { icon: '🛒', name: 'Grocery', color: '#e8f5e9', border: '#a5d6a7' },
  { icon: '💊', name: 'Pharmacy', color: '#e3f2fd', border: '#90caf9' },
  { icon: '📱', name: 'Electronics', color: '#ede7f6', border: '#ce93d8' },
  { icon: '💇', name: 'Salon', color: '#fce4ec', border: '#f48fb1' },
  { icon: '📚', name: 'Stationery', color: '#fff8e1', border: '#ffe082' },
  { icon: '🔧', name: 'Hardware', color: '#efebe9', border: '#bcaaa4' },
  { icon: '🌸', name: 'Gifts', color: '#fce4ec', border: '#f48fb1' },
]

const ticker = ['🍕 Pizza in 20 mins', '💊 Medicines at midnight', '🛒 Groceries before work', '📱 Phone charger now', '🌸 Flowers for someone special']

export default function HomePage() {
  const [tickerIdx, setTickerIdx] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setTickerIdx(i => (i + 1) % ticker.length), 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base"
              style={{ background: 'linear-gradient(135deg, #ff5722, #e64a19)' }}>W</div>
            <span className="font-black text-xl" style={{ color: 'var(--ink)', fontFamily: 'Nunito, sans-serif' }}>welokl</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="btn-ghost text-sm hidden sm:flex">Login</Link>
            <Link href="/auth/signup" className="btn-primary text-sm px-5 py-2">Get started →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: 'var(--ink)', minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
        {/* Animated gradient blobs */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(255,87,34,0.25) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'pulse 6s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '10%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(255,138,101,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />

        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

        <div className="relative max-w-6xl mx-auto px-4 py-20 page-enter">
          <div className="max-w-2xl">
            {/* Ticker */}
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00e676' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Live near you:</span>
              <span className="font-bold" style={{ color: 'white', fontSize: '13px', transition: 'all 0.3s' }}>
                {mounted ? ticker[tickerIdx] : ticker[0]}
              </span>
            </div>

            <h1 className="font-black leading-none mb-6" style={{
              fontSize: 'clamp(48px, 8vw, 88px)',
              fontFamily: 'Nunito, sans-serif',
              color: 'white',
              letterSpacing: '-0.03em'
            }}>
              Every shop.<br />
              <span style={{ color: 'var(--brand)' }}>Your door.</span>
            </h1>

            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '18px', lineHeight: '1.7', maxWidth: '480px', marginBottom: '40px' }}>
              Food, grocery, pharmacy, electronics, salon — every local shop around you, on one app. Delivered or picked up.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/stores" className="btn-primary" style={{ fontSize: '16px', padding: '14px 28px', borderRadius: '100px' }}>
                Browse nearby shops →
              </Link>
              <Link href="/auth/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'white', borderRadius: '100px', padding: '14px 24px',
                fontWeight: '700', fontSize: '15px', transition: 'all 0.2s'
              }}>
                Create free account
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mt-12">
              {[['500+', 'Local shops'], ['15 min', 'Avg delivery'], ['₹0', 'To join'], ['4.9★', 'Rating']].map(([n, l]) => (
                <div key={l}>
                  <div className="font-black text-2xl" style={{ color: 'var(--brand)', fontFamily: 'Nunito' }}>{n}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontWeight: '600' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <p className="font-bold text-sm uppercase tracking-widest mb-2" style={{ color: 'var(--brand)' }}>Browse by category</p>
        <h2 className="font-black text-3xl sm:text-4xl mb-8" style={{ color: 'var(--ink)', fontFamily: 'Nunito', letterSpacing: '-0.02em' }}>
          Everything nearby
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {categories.map(cat => (
            <Link key={cat.name} href={`/stores?category=${cat.name.toLowerCase()}`}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-150 active:scale-95 hover:scale-105 cursor-pointer"
                style={{ background: cat.color, borderColor: cat.border }}>
                <span style={{ fontSize: '28px' }}>{cat.icon}</span>
                <span className="font-bold text-xs" style={{ color: 'var(--ink)' }}>{cat.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 border-y" style={{ borderColor: 'var(--border)', background: 'white' }}>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="font-bold text-sm uppercase tracking-widest mb-2" style={{ color: 'var(--brand)' }}>Simple as 3 steps</p>
          <h2 className="font-black text-3xl sm:text-4xl mb-14" style={{ color: 'var(--ink)', fontFamily: 'Nunito', letterSpacing: '-0.02em' }}>
            How Welokl works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { icon: '📍', step: '01', title: 'Browse nearby', desc: 'See shops within your exact GPS radius. Filter by category, distance, or ratings.' },
              { icon: '🛍️', step: '02', title: 'Order anything', desc: 'Add items to cart. Pay by UPI or cash. Choose home delivery or self pickup.' },
              { icon: '🛵', step: '03', title: 'Track live', desc: 'Real-time tracking from shop to door. Know exactly where your order is.' },
            ].map(s => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 relative"
                  style={{ background: 'var(--brand-pale)' }}>
                  {s.icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center"
                    style={{ background: 'var(--brand)' }}>{s.step.replace('0','')}</span>
                </div>
                <h3 className="font-black text-lg mb-2" style={{ color: 'var(--ink)' }}>{s.title}</h3>
                <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: '1.7' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAYMENT BANNER */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-3xl p-10 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ff5722, #bf360c)' }}>
          <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div className="relative max-w-lg">
            <div className="text-4xl mb-4">💰</div>
            <h2 className="font-black text-3xl sm:text-4xl mb-4 text-white" style={{ fontFamily: 'Nunito', letterSpacing: '-0.02em' }}>Pay how you like</h2>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '16px' }}>
              No forced apps. Pay by UPI for instant confirmation, or good old cash on delivery.
            </p>
            <div className="flex flex-wrap gap-3">
              {[['📲', 'UPI Payment'], ['💵', 'Cash on Delivery'], ['🏃', 'Self Pickup']].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1.5px solid rgba(255,255,255,0.2)' }}>
                  {icon} {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARTNER CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="card p-8">
            <div className="text-4xl mb-4">🏪</div>
            <h3 className="font-black text-2xl mb-2" style={{ color: 'var(--ink)', fontFamily: 'Nunito' }}>Own a shop?</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: '1.7', marginBottom: '20px' }}>
              List on Welokl free. Get customers without marketing. We handle delivery, you focus on your craft.
            </p>
            <ul className="space-y-2 mb-6">
              {['Free to list, 15% only on sales', 'Real-time order dashboard', 'No delivery staff needed', 'Analytics & earnings tracker'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  <span style={{ color: 'var(--green)' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup?role=business" className="btn-primary block text-center" style={{ borderRadius: '100px' }}>
              Register your shop →
            </Link>
          </div>
          <div className="card p-8" style={{ background: 'var(--ink)' }}>
            <div className="text-4xl mb-4">🛵</div>
            <h3 className="font-black text-2xl mb-2 text-white" style={{ fontFamily: 'Nunito' }}>Earn on your schedule</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: '1.7', marginBottom: '20px' }}>
              Deliver for Welokl on your terms. ₹20 per delivery credited instantly. No targets, no pressure.
            </p>
            <ul className="space-y-2 mb-6">
              {['₹20 per delivery, instant credit', 'Work any hours you want', 'No minimum deliveries', 'Bonus for top ratings'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ color: 'var(--brand)' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup?role=delivery" className="btn-primary block text-center" style={{ borderRadius: '100px' }}>
              Become a delivery partner →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8" style={{ borderColor: 'var(--border)', background: 'white' }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: 'var(--brand)' }}>W</div>
            <span className="font-black" style={{ color: 'var(--ink)', fontFamily: 'Nunito' }}>welokl</span>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '12px' }}>Your neighbourhood, on your phone. © {new Date().getFullYear()}</p>
          <div className="flex gap-5">
            {['Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" style={{ color: 'var(--ink-soft)', fontSize: '12px', textDecoration: 'none' }}
                className="hover:text-gray-800">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
