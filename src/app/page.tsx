'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const categories = [
  { icon: '🍔', name: 'Food', desc: 'Restaurants & tiffins', color: 'bg-red-50 border-red-100', accent: 'text-red-500' },
  { icon: '🛒', name: 'Grocery', desc: 'Kirana & supermarkets', color: 'bg-green-50 border-green-100', accent: 'text-green-600' },
  { icon: '💊', name: 'Pharmacy', desc: 'Medicines & health', color: 'bg-blue-50 border-blue-100', accent: 'text-blue-600' },
  { icon: '📱', name: 'Electronics', desc: 'Gadgets & repairs', color: 'bg-purple-50 border-purple-100', accent: 'text-purple-600' },
  { icon: '💇', name: 'Salon', desc: 'At-home services', color: 'bg-pink-50 border-pink-100', accent: 'text-pink-600' },
  { icon: '📚', name: 'Stationery', desc: 'Books & supplies', color: 'bg-amber-50 border-amber-100', accent: 'text-amber-600' },
  { icon: '🔧', name: 'Hardware', desc: 'Tools & materials', color: 'bg-stone-50 border-stone-200', accent: 'text-stone-600' },
  { icon: '🌸', name: 'Gifts', desc: 'Flowers & surprises', color: 'bg-rose-50 border-rose-100', accent: 'text-rose-500' },
]

const stats = [
  { num: '500+', label: 'Local Shops' },
  { num: '15 min', label: 'Avg Delivery' },
  { num: '4.9★', label: 'App Rating' },
  { num: '0%', label: 'Surge Pricing' },
]

const howItWorks = [
  { step: '01', icon: '📍', title: 'Browse Nearby', desc: 'See every open shop within your area. Filter by category, distance, or rating.' },
  { step: '02', icon: '🛍️', title: 'Pick & Order', desc: 'Add items to cart. Choose home delivery or walk-in pickup. Pay by UPI or cash.' },
  { step: '03', icon: '🛵', title: 'Track Live', desc: 'Watch your order move in real time — from shop to your doorstep.' },
]

const testimonials = [
  { name: 'Priya Sharma', area: 'Bandra, Mumbai', text: 'I ordered medicines at 11pm and they arrived in 12 minutes. Absolute lifesaver.', rating: 5 },
  { name: 'Rohit Gupta', area: 'Andheri, Mumbai', text: 'My neighbourhood kirana is on Welokl now. Same shop, 10x more convenient.', rating: 5 },
  { name: 'Meera Iyer', area: 'Juhu, Mumbai', text: 'The salon service at home was unbelievable. They brought everything, did an amazing job.', rating: 5 },
]

const ticker = ['🍕 Pizza from Momo House', '💊 Medicines from MedPlus', '🛒 Groceries from Fresh Mart', '📱 Charger from TechZone', '💐 Flowers from Petal Co', '✂️ Haircut at home', '🎂 Cake from Bake Street']

export default function HomePage() {
  const [tickerIndex, setTickerIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const t = setInterval(() => setTickerIndex(i => (i + 1) % ticker.length), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#fafaf7]">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-sm">W</div>
            <span className="font-display font-bold text-xl text-ink">welokl</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link href="/stores" className="hover:text-ink transition-colors">Explore</Link>
            <Link href="#partners" className="hover:text-ink transition-colors">Partner with us</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="hidden sm:block text-sm font-semibold px-4 py-2 text-gray-600 hover:text-ink transition-colors">Login</Link>
            <Link href="/auth/signup" className="btn-primary text-sm py-2 px-5">Get Started →</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#0a0a0a] text-white">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        {/* Orange blob */}
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-500 rounded-full opacity-20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-orange-400 rounded-full opacity-10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="max-w-3xl">
            {/* Live ticker */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/70">Just ordered:</span>
              <span className={`font-medium transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                {ticker[tickerIndex]}
              </span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Your neighbourhood,<br />
              <span className="text-brand-500">delivered.</span>
            </h1>

            <p className="text-white/60 text-lg sm:text-xl max-w-xl mb-10 leading-relaxed">
              Every shop around you — food, grocery, pharmacy, salon, electronics — on one app. 
              Get it delivered in minutes or pick it up yourself.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link href="/stores" className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-7 py-4 rounded-2xl transition-all text-base active:scale-95 shadow-lg shadow-brand-500/30">
                Explore nearby shops →
              </Link>
              <Link href="/auth/signup" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-7 py-4 rounded-2xl transition-all text-base border border-white/20">
                Create free account
              </Link>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="font-display text-2xl font-bold text-brand-500">{s.num}</div>
                  <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="h-16 bg-[#fafaf7]" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </section>

      {/* ── CATEGORIES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-brand-500 text-sm font-semibold tracking-wider uppercase mb-1">Browse by category</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">Everything nearby</h2>
          </div>
          <Link href="/stores" className="hidden sm:block text-sm font-semibold text-brand-500 hover:text-brand-600">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map(cat => (
            <Link key={cat.name} href={`/stores?category=${cat.name.toLowerCase()}`}>
              <div className={`${cat.color} border rounded-2xl p-5 hover:scale-105 transition-transform duration-200 cursor-pointer group`}>
                <div className="text-3xl mb-3">{cat.icon}</div>
                <div className={`font-bold text-base ${cat.accent}`}>{cat.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{cat.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-white border-y border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold tracking-wider uppercase mb-2">Simple as 3 steps</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">How Welokl works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {howItWorks.map((step, i) => (
              <div key={step.step} className="text-center">
                <div className="relative inline-block mb-5">
                  <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-3xl">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-black">{i+1}</div>
                </div>
                <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAYMENT SECTION ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-gradient-to-br from-brand-500 to-orange-600 rounded-3xl p-10 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative max-w-lg">
            <div className="text-4xl mb-4">💰</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">Pay how you like</h2>
            <p className="text-white/80 mb-8 text-lg">No forced payment apps. Pay by UPI for instant confirmation, or cash on delivery — your choice, every time.</p>
            <div className="flex flex-wrap gap-3">
              <div className="bg-white/20 border border-white/30 rounded-xl px-5 py-3 flex items-center gap-2 font-semibold">
                <span className="text-2xl">📲</span> UPI Payment
              </div>
              <div className="bg-white/20 border border-white/30 rounded-xl px-5 py-3 flex items-center gap-2 font-semibold">
                <span className="text-2xl">💵</span> Cash on Delivery
              </div>
              <div className="bg-white/20 border border-white/30 rounded-xl px-5 py-3 flex items-center gap-2 font-semibold">
                <span className="text-2xl">🛍️</span> Self Pickup
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-[#0a0a0a] text-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold tracking-wider uppercase mb-2">People love it</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Real stories from real neighbours</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-brand-500">★</span>
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-white/40 text-xs">{t.area}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNER CTA ── */}
      <section id="partners" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Shop owner */}
          <div className="card p-8">
            <div className="text-4xl mb-4">🏪</div>
            <h3 className="font-display text-2xl font-bold mb-2">Own a shop?</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">List your store on Welokl for free. Get new customers in your area without any marketing spend. We handle the orders — you focus on your craft.</p>
            <ul className="space-y-2 text-sm text-gray-600 mb-7">
              {['Free to list, 15% only on sales', 'Own dashboard to manage orders', 'Real-time notifications', 'Grow without hiring delivery staff'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span> {f}</li>
              ))}
            </ul>
            <Link href="/auth/signup?role=business" className="btn-primary block text-center">Register your shop →</Link>
          </div>

          {/* Delivery partner */}
          <div className="card p-8 bg-[#0a0a0a] text-white">
            <div className="text-4xl mb-4">🛵</div>
            <h3 className="font-display text-2xl font-bold mb-2">Want to earn?</h3>
            <p className="text-white/50 text-sm mb-6 leading-relaxed">Deliver for Welokl on your schedule. Work when you want, earn per delivery. ₹20 credited to your wallet for every order you complete.</p>
            <ul className="space-y-2 text-sm text-white/60 mb-7">
              {['₹20 per delivery, instant wallet credit', 'Work any hours you choose', 'No targets, no pressure', 'Bonus for high ratings'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-brand-500">✓</span> {f}</li>
              ))}
            </ul>
            <Link href="/auth/signup?role=delivery" className="block text-center bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95">Become a delivery partner →</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-xs">W</div>
            <span className="font-display font-bold text-lg">welokl</span>
          </div>
          <p className="text-xs text-gray-400">Your neighbourhood, on your phone. © {new Date().getFullYear()} Welokl</p>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <Link href="#" className="hover:text-gray-600">Privacy</Link>
            <Link href="#" className="hover:text-gray-600">Terms</Link>
            <Link href="#" className="hover:text-gray-600">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
