'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { computeIsOpen } from '@/lib/shopHours'

interface Shop {
  id: string; name: string; category_name: string; area: string
  rating: number | null; avg_delivery_time: number; is_open: boolean
  image_url: string | null; offer_text: string | null; delivery_enabled: boolean
  opening_time?: string | null; closing_time?: string | null; manually_closed?: boolean | null
}
interface Stats { shops: number; orders: number }

// ── Icon library ───────────────────────────────────────────────────────
const IcoArrow = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 20 20" fill="none" width={size} height={size}>
    <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoCart = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="1.8"/>
    <path d="M16 10a4 4 0 01-8 0" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoPill = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8"/>
    <path d="M12 8v8M8 12h8" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
)
const IcoFood = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoHome = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="9 22 9 12 15 12 15 22" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoSearch = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="1.8"/>
    <path d="m21 21-4.35-4.35" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoBox = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={color} strokeWidth="1.8"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke={color} strokeWidth="1.8"/>
    <line x1="12" y1="22.08" x2="12" y2="12" stroke={color} strokeWidth="1.8"/>
  </svg>
)
const IcoCheckCircle = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15"/>
    <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.8"/>
    <path d="M8 12l3 3 5-5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoBike = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <circle cx="5.5" cy="17.5" r="3.5" stroke={color} strokeWidth="1.8"/>
    <circle cx="18.5" cy="17.5" r="3.5" stroke={color} strokeWidth="1.8"/>
    <path d="M8 17.5l3.5-7H15l3.5 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.5 17.5l4-8 2 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 6h2.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoPin = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
    <circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth="1.8"/>
  </svg>
)
const IcoShop = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M3 9l3-7h12l3 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="2" y="9" width="20" height="12" rx="1" stroke={color} strokeWidth="1.8"/>
    <path d="M9 21V13h6v8" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoBell = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoWallet = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <rect x="1" y="5" width="22" height="14" rx="2" stroke={color} strokeWidth="1.8"/>
    <path d="M1 10h22" stroke={color} strokeWidth="1.8"/>
    <circle cx="17" cy="15" r="1.5" fill={color}/>
  </svg>
)
const IcoMobile = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <rect x="5" y="2" width="14" height="20" rx="2" stroke={color} strokeWidth="1.8"/>
    <path d="M12 17h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)
const IcoChart = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <line x1="18" y1="20" x2="18" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="12" y1="20" x2="12" y2="4"  stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="6"  y1="20" x2="6"  y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IcoStar = ({ size = 12, filled = true }: { size?: number; filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

// ── Navbar ─────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="font-display font-extrabold text-2xl" style={{ color: scrolled ? '#111' : '#fff' }}>Welokl</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/auth/login"
            className={`text-sm font-bold px-4 py-2 rounded-xl transition-colors ${scrolled ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
            Login
          </Link>
          <Link href="/auth/signup"
            className={`text-sm font-extrabold px-5 py-2.5 rounded-xl transition-all ${scrolled ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white text-gray-900 hover:bg-white/90'}`}>
            Get started
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ── Live badge ───────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <div className="flex flex-col items-center lg:items-start gap-2 mb-8">
      <div className="inline-flex items-center gap-2 bg-green-500/20 backdrop-blur border border-green-500/40 rounded-full px-4 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-bold text-green-300 tracking-widest uppercase">We&apos;re live!</span>
      </div>
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────
function Hero() {
  const mockShops = [
    { name: 'Fresh Basket', cat: 'Grocery',  time: '18 min', open: true,  icon: <IcoCart  size={16} color="#16a34a" />, bg: 'bg-green-50',  border: 'border-green-100' },
    { name: 'MediPlus',     cat: 'Pharmacy', time: '12 min', open: true,  icon: <IcoPill  size={16} color="#4f46e5" />, bg: 'bg-blue-50',   border: 'border-blue-100'  },
    { name: 'Bite House',   cat: 'Food',     time: '25 min', open: false, icon: <IcoFood  size={16} color="#ea580c" />, bg: 'bg-orange-50', border: 'border-orange-100' },
  ]
  return (
    <section className="relative min-h-[100svh] bg-gray-950 flex flex-col items-center justify-center overflow-hidden px-5 pt-20 pb-16">
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      {/* Glow blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(255,48,8,0.18) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left">
            <LiveBadge />

            <h1 className="font-display font-extrabold text-[clamp(2.8rem,8vw,5.5rem)] text-white leading-[1.0] tracking-tight mb-6">
              Order from<br />
              <span className="text-brand-500">any shop</span><br />
              near you.
            </h1>

            <p className="text-lg text-white/50 font-medium max-w-lg mx-auto lg:mx-0 mb-10 leading-relaxed">
              Groceries, food, medicines, flowers — anything from local shops, delivered in minutes. Not hours.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center lg:justify-start">
              <Link href="/auth/signup"
                className="group flex items-center gap-3 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-base px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5 w-full sm:w-auto justify-center">
                Order Now
                <span className="group-hover:translate-x-1 transition-transform"><IcoArrow /></span>
              </Link>
              <Link href="/auth/signup?type=business"
                className="flex items-center gap-3 bg-white/8 hover:bg-white/12 backdrop-blur border border-white/12 text-white font-extrabold text-base px-8 py-4 rounded-2xl transition-all w-full sm:w-auto justify-center">
                Join as Shop
              </Link>
            </div>

            <div className="flex items-center gap-5 mt-8 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {['#f59e0b','#3b82f6','#10b981','#8b5cf6'].map((c, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-gray-950" style={{ background: c }} />
                ))}
              </div>
              <p className="text-xs text-white/40 font-medium">500+ happy customers this month</p>
            </div>
          </div>

          {/* Right: phone mockup */}
          <div className="relative flex-shrink-0 w-72">
            <div className="bg-gray-800 rounded-[3rem] p-3 shadow-2xl border border-white/10">
              <div className="bg-white rounded-[2.4rem] overflow-hidden">
                {/* Status bar */}
                <div className="bg-brand-500 px-5 pt-4 pb-3 flex items-center justify-between">
                  <span className="text-white/80 text-[10px] font-bold">9:41</span>
                  <span className="font-extrabold text-xs text-white">Welokl</span>
                  <div className="flex gap-1 items-center">
                    <div className="w-3 h-1.5 bg-white/60 rounded-sm" />
                    <div className="w-3 h-1.5 bg-white/60 rounded-sm" />
                  </div>
                </div>
                {/* Search bar */}
                <div className="px-4 py-3 bg-brand-500">
                  <div className="bg-white rounded-xl px-3 py-2 flex items-center gap-2">
                    <IcoSearch size={12} color="#bbb" />
                    <span className="text-xs text-gray-400">Search shops near you…</span>
                  </div>
                </div>
                {/* Shop cards */}
                <div className="bg-gray-50 p-3 space-y-2.5">
                  <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider px-1 mb-1">Nearby shops</div>
                  {mockShops.map((s, i) => (
                    <div key={i} className={`flex items-center gap-2.5 ${s.bg} border ${s.border} rounded-xl p-2.5`}>
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">{s.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-[11px] text-gray-900 truncate">{s.name}</div>
                        <div className="text-[10px] text-gray-400">{s.cat}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.open ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-[10px] font-bold text-gray-600">{s.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Bottom nav */}
                <div className="bg-white border-t border-gray-100 px-6 py-2.5 flex justify-around items-center">
                  {[
                    { icon: <IcoHome   size={18} color="#FF3008" />, active: true  },
                    { icon: <IcoSearch size={18} color="#ccc"    />, active: false },
                    { icon: <IcoCart   size={18} color="#ccc"    />, active: false },
                    { icon: <IcoBox    size={18} color="#ccc"    />, active: false },
                  ].map((n, i) => (
                    <div key={i} className={n.active ? 'opacity-100' : 'opacity-40'}>{n.icon}</div>
                  ))}
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute -bottom-4 -left-8 bg-white rounded-2xl shadow-xl px-4 py-2.5 border border-gray-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IcoCheckCircle size={20} />
              </div>
              <div>
                <div className="text-[11px] font-extrabold text-gray-900">Order placed!</div>
                <div className="text-[10px] text-gray-400">Arriving in 20 min</div>
              </div>
            </div>
            <div className="absolute -top-4 -right-6 bg-white rounded-2xl shadow-xl px-4 py-2.5 border border-gray-100 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IcoBike size={16} color="#4f46e5" />
              </div>
              <div>
                <div className="text-[11px] font-extrabold text-gray-900">Rider assigned</div>
                <div className="text-[10px] text-gray-400">Tracking live</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}

// ── Stats band ─────────────────────────────────────────────────────────
function Stats({ shops, orders }: { shops: number; orders: number }) {
  return (
    <section className="bg-white border-b border-gray-100 py-12">
      <div className="max-w-4xl mx-auto px-5">
        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          {[
            { value: shops  > 0 ? `${shops}+`  : '50+',  label: 'Local shops',      sub: 'and growing every week' },
            { value: orders > 0 ? `${orders}+` : '500+', label: 'Orders delivered', sub: 'and counting'           },
            { value: '< 30 min',                           label: 'Avg delivery',     sub: 'most under 20 min'      },
          ].map((s, i) => (
            <div key={i} className="px-4 sm:px-8">
              <div className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900">{s.value}</div>
              <div className="text-sm font-bold text-gray-800 mt-1">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5 hidden sm:block">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── How It Works ───────────────────────────────────────────────────────
function HowItWorks() {
  const customerSteps = [
    { n: '01', icon: <IcoPin  size={28} color="#FF3008" />, title: 'Set your location',    body: 'Share location or enter your area. We show only shops that can actually reach you.' },
    { n: '02', icon: <IcoCart size={28} color="#FF3008" />, title: 'Browse & add to cart', body: 'Pick items, choose delivery or pickup, pay with wallet or cash. Done in 2 minutes.' },
    { n: '03', icon: <IcoBike size={28} color="#FF3008" />, title: 'Track live delivery',  body: 'A local rider picks up your order. Watch them on the map. Get it at your door.' },
  ]
  const shopSteps = [
    { n: '01', icon: <IcoShop   size={28} color="#ea580c" />, title: 'Register your shop', body: 'Add your shop details, menu, and photos. We verify and go live within 24–48 hours.' },
    { n: '02', icon: <IcoBell   size={28} color="#ea580c" />, title: 'Get order alerts',   body: 'Every new order triggers an instant alert. Accept, prepare, and mark as ready.' },
    { n: '03', icon: <IcoWallet size={28} color="#ea580c" />, title: 'Track your money',   body: 'Real-time revenue, order history, and payout tracking. All in one dashboard.' },
  ]
  return (
    <section className="py-24 bg-white px-5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-extrabold text-brand-500 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-gray-900 leading-[1.1] tracking-tight">
            Craving to doorstep<br className="hidden sm:block" /> in 3 steps
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 mb-20">
          {customerSteps.map(s => (
            <div key={s.n} className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-3xl p-7 border border-gray-100 hover:border-gray-200">
              <div className="font-display font-extrabold text-5xl text-gray-100 mb-4 leading-none">{s.n}</div>
              <div className="mb-4">{s.icon}</div>
              <h3 className="font-extrabold text-lg text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">For shop owners</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {shopSteps.map(s => (
            <div key={s.n} className="bg-orange-50 hover:bg-orange-100/70 transition-colors rounded-3xl p-7 border border-orange-100">
              <div className="font-display font-extrabold text-5xl text-orange-100 mb-4 leading-none">{s.n}</div>
              <div className="mb-4">{s.icon}</div>
              <h3 className="font-extrabold text-lg text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Problem vs Solution ────────────────────────────────────────────────
function ProblemSolution() {
  return (
    <section className="py-24 bg-gray-950 px-5 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-white leading-[1.1] mb-5">
            Ordering via WhatsApp?<br />We feel you.
          </h2>
          <p className="text-white/40 text-base max-w-md mx-auto">Local shops are the best — but ordering from them shouldn't feel like a chore.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-white/5 border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg viewBox="0 0 10 10" fill="none" width={8} height={8}><path d="M2 2l6 6M8 2L2 8" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </div>
              <span className="text-xs font-extrabold text-red-400 uppercase tracking-widest">Before Welokl</span>
            </div>
            <div className="space-y-4">
              {[
                'Call the shop. It rings out. Call again.',
                'WhatsApp the order. Wait 20 minutes for a reply.',
                'Wrong item delivered. No proof, no refund.',
                'Pay cash. No receipt. No record.',
                "Shop is closed. You didn't know.",
                'No tracking. Endless "5 more minutes, bhai".',
              ].map((p, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg viewBox="0 0 8 8" fill="none" width={6} height={6}><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </div>
                  <span className="text-white/50 text-sm leading-relaxed">{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl p-8 border border-brand-500/20" style={{ background: 'rgba(255,48,8,0.05)' }}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg viewBox="0 0 10 10" fill="none" width={8} height={8}><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-xs font-extrabold text-green-400 uppercase tracking-widest">With Welokl</span>
            </div>
            <div className="space-y-4">
              {[
                'Shop always online. Order at 2am if you want.',
                'Browse menu, place order in under 2 minutes.',
                'Wrong item? Raise a flag. We handle it.',
                'Wallet payments. Full history, forever.',
                'See open/closed before you even tap.',
                'Live rider tracking on map. Know to the minute.',
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg viewBox="0 0 8 8" fill="none" width={6} height={6}><path d="M1 4l2 2 4-4" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span className="text-white/80 text-sm leading-relaxed font-medium">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── For Shop Owners ────────────────────────────────────────────────────
function ForShopOwners() {
  const benefits = [
    { icon: <IcoMobile  size={22} color="#FF3008" />, title: 'Online in 10 min',   body: 'No tech skills needed. Add your shop and go live fast.' },
    { icon: <IcoBox     size={22} color="#FF3008" />, title: 'Order management',   body: 'Accept, prepare, dispatch. Simple, clean flow.' },
    { icon: <IcoWallet  size={22} color="#FF3008" />, title: 'Payment tracking',   body: 'Wallet, UPI, cash — every rupee visible in one place.' },
    { icon: <IcoChart   size={22} color="#FF3008" />, title: 'Daily analytics',    body: 'Revenue, busy hours, top items. Know your numbers.' },
    { icon: <IcoBell    size={22} color="#FF3008" />, title: 'Instant alerts',     body: 'New order? Push + sound notification immediately.' },
    { icon: <IcoBike    size={22} color="#FF3008" />, title: 'We handle delivery', body: 'Riders come to you. You focus on your products.' },
  ]
  return (
    <section className="py-24 bg-white px-5">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs font-extrabold text-brand-500 uppercase tracking-widest mb-4">Built for shop owners</p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-gray-900 leading-[1.1] mb-6">
              Your shop, fully<br />digital. Zero<br />
              <span className="text-brand-500">chaos.</span>
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-sm">
              Stop managing orders on WhatsApp and Excel. Get on Welokl — handle everything from one screen while we send you customers.
            </p>
            <Link href="/auth/signup?type=business"
              className="group inline-flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-sm px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5">
              Start selling — it's free
              <span className="group-hover:translate-x-0.5 transition-transform"><IcoArrow size={14} /></span>
            </Link>
            <p className="text-xs text-gray-400 mt-3">No monthly fee. We take a small commission per order.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {benefits.map((b, i) => (
              <div key={i} className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl p-5 border border-gray-100 hover:border-gray-200">
                <div className="mb-3">{b.icon}</div>
                <div className="font-extrabold text-sm text-gray-900 mb-1">{b.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{b.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Featured Shops ─────────────────────────────────────────────────────
function FeaturedShops({ shops }: { shops: Shop[] }) {
  if (!shops.length) return null
  return (
    <section className="py-20 bg-gray-50 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-extrabold text-brand-500 uppercase tracking-widest mb-2">Explore</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900">Shops near you</h2>
          </div>
          <Link href="/stores" className="hidden sm:flex items-center gap-1.5 text-sm font-extrabold text-gray-500 hover:text-gray-900 transition-colors">
            View all <IcoArrow size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {shops.map(shop => (
            <Link key={shop.id} href={`/stores/${shop.id}`}
              className="group bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden">
              <div className="h-28 bg-gradient-to-br from-brand-400 to-orange-500 relative overflow-hidden">
                {shop.image_url
                  ? <Image src={shop.image_url} alt={shop.name} fill sizes="(max-width:640px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center opacity-20">
                      <IcoShop size={44} color="#fff" />
                    </div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className={`absolute bottom-2 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${computeIsOpen(shop) ? 'bg-green-500 text-white' : 'bg-black/60 text-white/60'}`}>
                  <span className={`w-1 h-1 rounded-full ${computeIsOpen(shop) ? 'bg-white' : 'bg-white/40'}`} />
                  {computeIsOpen(shop) ? 'Open' : 'Closed'}
                </div>
              </div>
              <div className="p-3.5">
                <div className="font-extrabold text-gray-900 text-sm mb-0.5 truncate">{shop.name}</div>
                <div className="text-xs text-gray-400 mb-2.5 truncate">{shop.category_name} · {shop.area}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                    <IcoStar size={11} /> {(shop.rating ?? 0).toFixed(1)}
                  </span>
                  {shop.delivery_enabled && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <IcoBike size={11} color="#aaa" /> {shop.avg_delivery_time} min
                    </span>
                  )}
                  {shop.offer_text && (
                    <span className="text-xs font-bold text-brand-500 truncate">{shop.offer_text}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8 sm:hidden">
          <Link href="/stores"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700 bg-white border border-gray-200 px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors">
            View all shops <IcoArrow size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Testimonials ───────────────────────────────────────────────────────
function Testimonials() {
  const reviews = [
    { name: 'Priya M.',         role: 'Customer · Pune',      text: 'Used to call 3 shops before anyone picked up. Now I just tap and groceries show up in 20 minutes. No calls, no confusion.' },
    { name: "Rajan's Grocery",  role: 'Shop owner · Mumbai',  text: 'Orders went from 15 a day to 60+. I stopped missing calls. The dashboard shows everything — I just prepare and the rider comes.' },
    { name: 'Sneha K.',         role: 'Customer · Bangalore', text: 'The live map is the best part. I know exactly when it\'s coming. No more "haan bhai, 5 minute mein".' },
    { name: 'MediCare Pharma',  role: 'Pharmacy · Delhi',     text: 'Listed our medicines and customers started ordering same day. Approval was fast. Revenue doubled in 2 months.' },
  ]
  return (
    <section className="py-20 bg-white px-5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-extrabold text-brand-500 uppercase tracking-widest mb-3">Social proof</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900">Real people. Real results.</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {reviews.map((r, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => <IcoStar key={j} size={13} />)}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">"{r.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-orange-400 flex-shrink-0" />
                <div>
                  <div className="font-extrabold text-sm text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="relative py-28 px-5 overflow-hidden bg-brand-500">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none" style={{ background: 'rgba(0,0,0,0.08)' }} />
      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-white leading-[1.05] tracking-tight mb-6">
          Your neighbourhood,<br />on demand.
        </h2>
        <p className="text-white/65 text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Stop waiting on calls. Join thousands of customers already ordering from local shops every day.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup"
            className="bg-white text-brand-500 hover:bg-gray-50 font-extrabold text-base px-10 py-4 rounded-2xl transition-all hover:-translate-y-0.5 shadow-xl shadow-black/10 w-full sm:w-auto">
            Order Now — Free
          </Link>
          <Link href="/auth/signup?type=business"
            className="bg-white/10 hover:bg-white/18 border border-white/20 text-white font-extrabold text-base px-10 py-4 rounded-2xl transition-all w-full sm:w-auto">
            List Your Shop
          </Link>
        </div>
        <p className="text-white/40 text-xs mt-6">No credit card. No monthly fee. Start in 10 minutes.</p>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-950 py-16 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-12 justify-between mb-12">
          <div className="max-w-xs">
            <div className="font-display font-extrabold text-2xl text-white mb-3">Welokl</div>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">Hyperlocal delivery — connecting local shops with nearby customers. Fast, reliable, fair.</p>
            <p className="text-xs text-gray-600">support@welokl.com</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <div className="font-bold text-white mb-4 text-xs uppercase tracking-widest">Customers</div>
              <div className="space-y-3">
                <Link href="/stores"       className="block text-gray-500 hover:text-white transition-colors text-sm">Browse shops</Link>
                <Link href="/auth/signup"  className="block text-gray-500 hover:text-white transition-colors text-sm">Sign up</Link>
                <Link href="/auth/login"   className="block text-gray-500 hover:text-white transition-colors text-sm">Login</Link>
              </div>
            </div>
            <div>
              <div className="font-bold text-white mb-4 text-xs uppercase tracking-widest">Shop owners</div>
              <div className="space-y-3">
                <Link href="/auth/signup?type=business" className="block text-gray-500 hover:text-white transition-colors text-sm">Join free</Link>
                <Link href="/auth/login"                className="block text-gray-500 hover:text-white transition-colors text-sm">Shop login</Link>
              </div>
            </div>
            <div>
              <div className="font-bold text-white mb-4 text-xs uppercase tracking-widest">Riders</div>
              <div className="space-y-3">
                <Link href="/auth/signup" className="block text-gray-500 hover:text-white transition-colors text-sm">Become a rider</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-gray-600 text-xs">© 2026 Welokl. All rights reserved.</p>
          <p className="text-gray-600 text-xs">Built for local India</p>
        </div>
      </div>
    </footer>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
const LANDING_CACHE_KEY = 'welokl_landing_v1'
const LANDING_TTL_MS    = 10 * 60 * 1000 // 10 minutes

const ROLE_HOME: Record<string, string> = {
  customer: '/dashboard/customer', business: '/dashboard/business',
  shopkeeper: '/dashboard/business', delivery: '/dashboard/delivery',
  delivery_partner: '/dashboard/delivery', admin: '/dashboard/admin',
  management: '/dashboard/management',
}

export default function LandingPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<Stats>({ shops: 0, orders: 0 })

  // If user already has a session (e.g. after Google OAuth lands here instead of
  // the dashboard, or they manually navigate to /), send them straight to their dashboard.
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const role = session.user.user_metadata?.role as string | undefined
      if (role && ROLE_HOME[role]) { window.location.replace(ROLE_HOME[role]); return }
      // Role not in metadata — query users table (Google OAuth users)
      sb.from('users').select('role').eq('id', session.user.id).single().then(({ data }) => {
        const r = data?.role || 'customer'
        window.location.replace(ROLE_HOME[r] ?? '/dashboard/customer')
      })
    })
  }, [])

  useEffect(() => {
    // Serve from cache immediately — no loading flash for return visitors
    try {
      const raw = localStorage.getItem(LANDING_CACHE_KEY)
      if (raw) {
        const { ts, shops: cs, stats: ct } = JSON.parse(raw)
        if (Date.now() - ts < LANDING_TTL_MS) {
          setShops(cs || []); setStats(ct || { shops: 0, orders: 0 })
        }
      }
    } catch {}

    const sb = createClient()
    Promise.all([
      sb.from('shops').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('verification_status', 'approved'),
      sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      sb.from('shops')
        .select('id,name,category_name,area,rating,avg_delivery_time,is_open,image_url,offer_text,delivery_enabled,opening_time,closing_time,manually_closed')
        .eq('is_active', true).eq('verification_status', 'approved')
        .order('rating', { ascending: false, nullsFirst: false }).limit(6),
    ]).then(([{ count: sc }, { count: oc }, { data }]) => {
      const newStats = { shops: sc ?? 0, orders: oc ?? 0 }
      const newShops = (data as Shop[]) || []
      setStats(newStats); setShops(newShops)
      try { localStorage.setItem(LANDING_CACHE_KEY, JSON.stringify({ ts: Date.now(), shops: newShops, stats: newStats })) } catch {}
    })
  }, [])

  return (
    <main className="font-sans antialiased">
      <Navbar />
      <Hero />
      <Stats shops={stats.shops} orders={stats.orders} />
      <HowItWorks />
      <ProblemSolution />
      <ForShopOwners />
      <FeaturedShops shops={shops} />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </main>
  )
}
