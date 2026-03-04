'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; min_order_amount: number; area: string; image_url: string | null
}
interface Product {
  id: string; name: string; price: number; original_price: number | null
  image_url: string | null; shop_id: string; shop_name?: string; shop_area?: string
}

const CATEGORIES = [
  { icon: '🍔', name: 'Food', color: '#ff4500' },
  { icon: '🛒', name: 'Grocery', color: '#00e676' },
  { icon: '💊', name: 'Pharmacy', color: '#448aff' },
  { icon: '📱', name: 'Electronics', color: '#aa00ff' },
  { icon: '💇', name: 'Salon', color: '#ff4081' },
  { icon: '🌸', name: 'Gifts', color: '#ffab00' },
  { icon: '🔧', name: 'Hardware', color: '#78716c' },
  { icon: '🐾', name: 'Pets', color: '#fb923c' },
]

const TICKER = [
  '🍕 Pizza delivered in 18 min nearby',
  '🥛 Milk at your door in 9 min',
  '💊 Medicine at midnight — we deliver',
  '🌹 Flowers for her anniversary',
  '🍦 Ice cream at 2am — yes really',
  '📱 Charger before the meeting',
]

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [allShops, setAllShops] = useState<Shop[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tickerIdx, setTickerIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setUser(session?.user))

    createClient().from('shops')
      .select('*').eq('is_active', true)
      .order('is_open', { ascending: false })
      .order('rating', { ascending: false })
      .limit(20)
      .then(({ data }) => { setAllShops(data || []); setLoaded(true) })

    createClient().from('products')
      .select('id,name,price,original_price,image_url,shop_id,shops(name,area)')
      .eq('is_available', true).limit(20)
      .then(({ data }) => setProducts((data || []).map((p: any) => ({
        ...p, shop_name: p.shops?.name, shop_area: p.shops?.area
      }))))

    const t = setInterval(() => setTickerIdx(i => (i + 1) % TICKER.length), 3200)
    return () => clearInterval(t)
  }, [])

  const openShops = allShops.filter(s => s.is_open)
  const closedShops = allShops.filter(s => !s.is_open)

  const filteredShops = activeCategory
    ? allShops.filter(s => s.category_name?.toLowerCase().includes(activeCategory.toLowerCase()))
    : allShops

  const featuredShops = filteredShops.slice(0, 8)
  const moreByCategory = activeCategory ? [] : [
    { label: 'Food & Restaurants', icon: '🍔', color: '#ff4500', shops: allShops.filter(s => s.category_name?.toLowerCase().includes('food')).slice(0, 4) },
    { label: 'Grocery & Essentials', icon: '🛒', color: '#00e676', shops: allShops.filter(s => s.category_name?.toLowerCase().includes('grocer')).slice(0, 4) },
    { label: 'Health & Pharmacy', icon: '💊', color: '#448aff', shops: allShops.filter(s => s.category_name?.toLowerCase().includes('pharma')).slice(0, 4) },
  ].filter(c => c.shops.length > 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── STICKY NAV ─── */}
      <nav className="sticky top-0 z-50 glass" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white"
              style={{ background: 'var(--brand)', boxShadow: '0 0 14px var(--brand-glow)' }}>W</div>
            <span className="font-black text-lg hidden sm:block" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>welokl</span>
          </Link>

          {/* ── SECTION 1: SEARCH ── */}
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: 'var(--text-3)' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search && (window.location.href = `/search?q=${encodeURIComponent(search)}`)}
              placeholder="Search shops, dishes, products..."
              className="input-field pl-9 py-2 text-sm w-full" style={{ borderRadius: 12 }} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-3)' }}>✕</button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <Link href="/dashboard/customer" className="text-sm font-bold px-3 py-1.5 rounded-xl"
                style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>My Orders</Link>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm font-semibold hidden sm:block" style={{ color: 'var(--text-2)' }}>Login</Link>
                <Link href="/auth/signup" className="btn-primary text-sm py-1.5 px-4">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── HERO BANNER ─── */}
      <section style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 500, height: 500, background: 'var(--brand)', borderRadius: '50%', opacity: 0.05, filter: 'blur(100px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '20%', width: 300, height: 300, background: '#ff8c00', borderRadius: '50%', opacity: 0.04, filter: 'blur(70px)', pointerEvents: 'none' }} />

        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14 relative">
          {/* Live ticker pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-2)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--green)', boxShadow: '0 0 6px #00e676', animation: 'pulse 2s infinite' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{TICKER[tickerIdx]}</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="fade-up" style={{
                fontSize: 'clamp(2rem, 4.5vw, 3.8rem)', fontWeight: 900,
                lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: '1rem'
              }}>
                Your neighbourhood,<br />
                <span className="gradient-text">at your fingertips.</span>
              </h1>
              <p className="fade-up-1 text-base mb-7" style={{ color: 'var(--text-2)', lineHeight: 1.75, maxWidth: 420 }}>
                Every real shop near you — food, grocery, pharmacy, salon — on one app. Real riders. Real fast.
              </p>
              <div className="fade-up-2 flex gap-3 flex-wrap">
                <Link href="/stores" className="btn-primary text-sm px-6 py-3">Order now →</Link>
                <Link href="/location?return=/stores" className="btn-secondary text-sm px-5 py-3 flex items-center gap-2">
                  <span>📍</span> Set my location
                </Link>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🏪', value: loaded ? allShops.length : '—', label: 'Local shops' },
                { icon: '🟢', value: loaded ? openShops.length : '—', label: 'Open now' },
                { icon: '⚡', value: '< 30', label: 'Min delivery' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="font-black text-2xl gradient-text leading-none">{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{s.label}</div>
                </div>
              ))}
              <div className="card p-4 col-span-3 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm">Partner with Welokl</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Shop owner or delivery rider?</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/auth/signup?role=business" className="text-xs font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}>🏪 List shop</Link>
                  <Link href="/auth/signup?role=delivery" className="text-xs font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: 'var(--bg-4)', color: 'var(--text-2)' }}>🛵 Ride</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">

        {/* ─── SECTION 1: CATEGORY PILLS ─── */}
        <section className="py-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setActiveCategory(null)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold transition-all"
              style={!activeCategory
                ? { background: 'var(--brand)', color: 'white', boxShadow: '0 0 16px var(--brand-glow)' }
                : { background: 'var(--bg-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              ✦ All
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat.name} onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold transition-all whitespace-nowrap"
                style={activeCategory === cat.name
                  ? { background: cat.color + '20', color: cat.color, border: `1px solid ${cat.color}50`, boxShadow: `0 0 12px ${cat.color}30` }
                  : { background: 'var(--bg-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* ─── SECTION 2: FEATURED OPEN SHOPS ─── */}
        <section className="pb-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-xl" style={{ letterSpacing: '-0.03em' }}>
                {activeCategory ? `${activeCategory} shops` : '🟢 Open now'}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
                {filteredShops.filter(s => s.is_open).length} shops open · tap to order
              </p>
            </div>
            <Link href="/stores" className="text-sm font-bold" style={{ color: 'var(--brand)' }}>See all →</Link>
          </div>

          {!loaded ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-52 shimmer" />)}
            </div>
          ) : featuredShops.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3">🏪</div>
              <p className="font-bold" style={{ color: 'var(--text-2)' }}>No shops in this category yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {featuredShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} delay={i * 40} />)}
            </div>
          )}
        </section>

        {/* ─── SECTION 3: TRENDING PRODUCTS ─── */}
        {products.length > 0 && (
          <section className="pb-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-black text-xl" style={{ letterSpacing: '-0.03em' }}>Trending right now</h2>
                  <span className="badge badge-brand">🔥 Hot picks</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Products people are ordering this moment</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3">
              {products.map((p, i) => <ProductCard key={p.id} product={p} delay={i * 25} />)}
            </div>
          </section>
        )}

        {/* ─── SECTION 4: MORE SHOPS BY CATEGORY ─── */}
        {!activeCategory && moreByCategory.map(cat => cat.shops.length > 0 && (
          <section key={cat.label} className="pb-10" style={{ borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <h2 className="font-black text-lg" style={{ letterSpacing: '-0.02em' }}>{cat.label}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{cat.shops.length} shops nearby</p>
                </div>
              </div>
              <button onClick={() => setActiveCategory(cat.label.split(' ')[0])}
                className="text-sm font-bold" style={{ color: cat.color }}>See all →</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cat.shops.map((shop, i) => <ShopCard key={shop.id} shop={shop} delay={i * 50} />)}
            </div>
          </section>
        ))}

      </div>

      {/* ─── BOTTOM CTA ─── */}
      <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)' }} className="py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-black text-2xl text-center mb-2" style={{ letterSpacing: '-0.03em' }}>
            Why <span className="gradient-text">welokl</span>?
          </h2>
          <p className="text-center text-sm mb-10" style={{ color: 'var(--text-3)' }}>Built for your neighbourhood. Not a warehouse.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '⚡', title: 'Under 30 minutes', desc: 'Real riders who know your streets. Most orders arrive before you\'re even hungry.' },
              { icon: '🏪', title: 'Real local shops', desc: 'Not a dark kitchen. Your actual neighbourhood shop — supporting real people.' },
              { icon: '💰', title: 'No hidden fees', desc: 'What you see is what you pay. UPI or cash. No surprises at checkout.' },
            ].map(f => (
              <div key={f.title} className="card p-6 relative overflow-hidden">
                <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.04, lineHeight: 1 }}>{f.icon}</div>
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-black text-base mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <Link href="/auth/signup?role=business" className="card p-6 block group hover:border-orange-500/30 transition-all" style={{ background: 'var(--bg-2)' }}>
              <div className="text-3xl mb-3">🏪</div>
              <h3 className="font-black text-lg mb-1">Own a shop?</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>List free. We bring customers, you serve them.</p>
              <span className="text-sm font-black" style={{ color: 'var(--brand)' }}>Register your shop →</span>
            </Link>
            <Link href="/auth/signup?role=delivery" className="card p-6 block group hover:border-orange-500/30 transition-all relative overflow-hidden" style={{ background: 'var(--bg-2)' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: 'var(--brand)', borderRadius: '50%', opacity: 0.06, filter: 'blur(40px)' }} />
              <div className="text-3xl mb-3">🛵</div>
              <h3 className="font-black text-lg mb-1">Earn with your bike</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>₹20 per delivery. Accept orders on your terms.</p>
              <span className="text-sm font-black" style={{ color: 'var(--brand)' }}>Become a rider →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }} className="py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: 'var(--brand)' }}>W</div>
            <span className="font-black" style={{ letterSpacing: '-0.02em' }}>welokl</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Your neighbourhood on your phone. © {new Date().getFullYear()}</p>
          <div className="flex gap-5 text-xs" style={{ color: 'var(--text-3)' }}>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── SHOP CARD ──
function ShopCard({ shop, delay }: { shop: Shop; delay: number }) {
  const catIcon: Record<string, string> = {
    food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
    salon: '💇', hardware: '🔧', pet: '🐾', flower: '🌸', default: '🏪'
  }
  const key = Object.keys(catIcon).find(k => shop.category_name?.toLowerCase().includes(k)) || 'default'

  return (
    <Link href={`/stores/${shop.id}`}>
      <div className="card-hover cursor-pointer overflow-hidden fade-up" style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
        {/* Image */}
        <div className="h-28 relative flex items-center justify-center overflow-hidden" style={{ background: 'var(--bg-3)' }}>
          {shop.image_url
            ? <img src={shop.image_url} alt={shop.name} className="w-full h-full object-cover" />
            : <span className="text-4xl" style={{ opacity: 0.4 }}>{catIcon[key]}</span>
          }
          {/* Gradient overlay on image */}
          {shop.image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />}

          <div className="absolute top-2 left-2">
            <span className={`badge text-xs ${shop.is_open ? 'badge-green' : ''}`}
              style={!shop.is_open ? { background: 'rgba(0,0,0,0.5)', color: 'var(--text-3)', border: '1px solid var(--border)' } : {}}>
              {shop.is_open ? '● Open' : '● Closed'}
            </span>
          </div>
          <div className="absolute top-2 right-2 text-xs font-black px-2 py-0.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.65)', color: '#ffab00', backdropFilter: 'blur(4px)' }}>
            ★ {shop.rating}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="font-black text-sm leading-tight line-clamp-1" style={{ letterSpacing: '-0.01em' }}>{shop.name}</p>
          {shop.description
            ? <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-3)' }}>{shop.description}</p>
            : <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-3)' }}>{shop.category_name} · {shop.area}</p>
          }
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>🛵 {shop.avg_delivery_time} min</span>
            {shop.min_order_amount > 0
              ? <span className="text-xs" style={{ color: 'var(--text-3)' }}>₹{shop.min_order_amount} min</span>
              : <span className="text-xs badge-green badge">Free delivery</span>
            }
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── PRODUCT CARD ──
function ProductCard({ product, delay }: { product: Product; delay: number }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null

  return (
    <Link href={`/stores/${product.shop_id}`}>
      <div className="flex-shrink-0 w-40 card-hover cursor-pointer overflow-hidden fade-up" style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
        <div className="h-28 flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-3)' }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            : <span className="text-4xl" style={{ opacity: 0.3 }}>🍽️</span>
          }
          {disc && (
            <div className="absolute top-2 left-2 text-xs font-black px-1.5 py-0.5 rounded-lg"
              style={{ background: 'var(--green)', color: '#000' }}>{disc}% off</div>
          )}
        </div>
        <div className="p-3">
          <p className="text-xs font-black line-clamp-1">{product.name}</p>
          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-3)' }}>
            {product.shop_name} {product.shop_area ? `· ${product.shop_area}` : ''}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="font-black text-sm gradient-text">₹{product.price}</span>
            {product.original_price && (
              <span className="text-xs line-through" style={{ color: 'var(--text-3)' }}>₹{product.original_price}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
