'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

const ROLE_HOME: Record<string, string> = {
  customer: '/dashboard/customer', shopkeeper: '/dashboard/business',
  business: '/dashboard/business', delivery: '/dashboard/delivery', admin: '/dashboard/admin',
}

const CATEGORIES = [
  { icon: '🍱', label: 'Food' }, { icon: '🛒', label: 'Grocery' },
  { icon: '💊', label: 'Pharmacy' }, { icon: '✂️', label: 'Salon' },
  { icon: '🥐', label: 'Bakery' }, { icon: '🍦', label: 'Desserts' },
  { icon: '🐾', label: 'Pet shop' }, { icon: '📦', label: 'General' },
]

const PROMISES = [
  { icon: '⚡', title: 'Under 30 min', sub: 'Or we notify you instantly' },
  { icon: '📍', title: 'Your street', sub: 'Real neighbourhood shops' },
  { icon: '💰', title: 'Fair prices', sub: 'No surge, no dark kitchens' },
  { icon: '🤝', title: 'Riders paid well', sub: 'Local jobs, fair wages' },
]

const STEPS = [
  { n: '01', icon: '📍', title: 'Share your location', desc: 'We surface every open shop within your colony — not a dark kitchen 15 km away.' },
  { n: '02', icon: '🛒', title: 'Pick what you need', desc: 'Food, groceries, medicine, bakery — browse live menus with real stock.' },
  { n: '03', icon: '🛵', title: 'Rider picks it up', desc: 'A local rider accepts in seconds. You track them live on a map.' },
  { n: '04', icon: '🎉', title: 'At your door', desc: 'Under 30 minutes. Pay on delivery or UPI. No surprises.' },
]

export default function LandingPage() {
  const [user, setUser]   = useState<any>(undefined)
  const [role, setRole]   = useState('')
  const [stats, setStats] = useState({ shops: 0, riders: 0, orders: 0 })
  const [catIdx, setCatIdx] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function init() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        let r = u.user_metadata?.role || ''
        if (!r) { const { data: p } = await sb.from('users').select('role').eq('id', u.id).single(); r = p?.role || 'customer' }
        setRole(r)
      }
      const [{ count: s }, { count: ri }, { count: o }] = await Promise.all([
        sb.from('shops').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('users').select('*', { count: 'exact', head: true }).eq('role', 'delivery'),
        sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      ])
      setStats({ shops: s || 0, riders: ri || 0, orders: o || 0 })
    }
    init()
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_, s) => {
      setUser(s?.user ?? null)
      if (!s?.user) setRole('')
    })
    return () => subscription.unsubscribe()
  }, [])

  // Rotate category highlight
  useEffect(() => {
    tickRef.current = setInterval(() => setCatIdx(i => (i + 1) % CATEGORIES.length), 1800)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const dashHref = ROLE_HOME[role] || '/dashboard/customer'

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'var(--lp-bg)', color: 'var(--lp-text)', minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes floatA { 0%,100%{transform:translateY(0px) rotate(-1deg)} 50%{transform:translateY(-12px) rotate(1deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0px) rotate(2deg)} 50%{transform:translateY(-8px) rotate(-1deg)} }
        @keyframes floatC { 0%,100%{transform:translateY(-4px)} 50%{transform:translateY(6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
        @keyframes shimmer { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes tickerX { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .fu0{animation:fadeUp .55s .05s both} .fu1{animation:fadeUp .55s .15s both}
        .fu2{animation:fadeUp .55s .25s both} .fu3{animation:fadeUp .55s .35s both}
        .fu4{animation:fadeUp .55s .45s both} .si{animation:scaleIn .5s both}
        .float-a{animation:floatA 5s ease-in-out infinite}
        .float-b{animation:floatB 6s ease-in-out infinite}
        .float-c{animation:floatC 4s ease-in-out infinite}
        .ticker-wrap{overflow:hidden;width:100%}
        .ticker-inner{display:flex;width:max-content;animation:tickerX 22s linear infinite}
        .ticker-inner:hover{animation-play-state:paused}
        .lp-nav-a{font-size:14px;font-weight:600;color:var(--lp-text3);text-decoration:none;transition:color .15s}
        .lp-nav-a:hover{color:var(--lp-red)}
        .lp-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:14px;background:var(--lp-red);color:#fff;font-weight:800;font-size:15px;text-decoration:none;font-family:inherit;border:none;cursor:pointer;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 20px rgba(255,48,8,.35)}
        .lp-btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(255,48,8,.45)}
        .lp-btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:14px;background:var(--lp-card);color:var(--lp-text);font-weight:800;font-size:15px;text-decoration:none;font-family:inherit;border:1.5px solid var(--lp-border);cursor:pointer;transition:transform .15s,border-color .15s}
        .lp-btn-secondary:hover{transform:translateY(-2px);border-color:var(--lp-red)}
        .step-card{background:var(--lp-card);border:1.5px solid var(--lp-border);border-radius:20px;padding:28px;transition:transform .2s,box-shadow .2s;cursor:default}
        .step-card:hover{transform:translateY(-4px);box-shadow:var(--lp-shadow-lg)}
        .lp-for-card{border-radius:24px;padding:32px;transition:transform .2s,box-shadow .2s}
        .lp-for-card:hover{transform:translateY(-5px);box-shadow:var(--lp-shadow-lg)}
        .cat-pill{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border-radius:16px;cursor:pointer;transition:all .2s;border:1.5px solid transparent;min-width:70px}
        .cat-pill.active{background:var(--lp-red);border-color:var(--lp-red)}
        .cat-pill:not(.active){background:var(--lp-card);border-color:var(--lp-border)}
        .cat-pill:not(.active):hover{border-color:var(--lp-amber);transform:translateY(-2px)}
        .stat-num{font-family:"Syne",sans-serif;font-weight:800;font-size:clamp(2rem,4vw,3rem);color:var(--lp-red);letter-spacing:-.04em}
        @media(max-width:768px){
          .hide-m{display:none!important}
          .lp-grid-2{grid-template-columns:1fr!important}
          .lp-grid-3{grid-template-columns:1fr 1fr!important}
          .lp-grid-4{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:480px){
          .lp-grid-3{grid-template-columns:1fr!important}
          .lp-grid-4{grid-template-columns:1fr 1fr!important}
        }
      `}</style>


      {/* ── NAV ──────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--lp-nav-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--lp-border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--lp-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, color: '#fff', boxShadow: '0 3px 10px rgba(255,48,8,.35)' }}>W</div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--lp-text)', letterSpacing: '-.03em' }}>welokl</span>
          </Link>

          <div className="hide-m" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#how" className="lp-nav-a">How it works</a>
            <a href="#for" className="lp-nav-a">For you</a>
            <a href="#mission" className="lp-nav-a">Mission</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            {user === undefined ? (
              <div style={{ width: 100, height: 36, borderRadius: 10, background: 'var(--lp-border)', animation: 'shimmer 1.4s infinite' }} />
            ) : user ? (
              <Link href={dashHref} className="lp-btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>Dashboard →</Link>
            ) : (
              <>
                <Link href="/auth/login" className="lp-nav-a hide-m" style={{ padding: '8px 12px' }}>Log in</Link>
                <Link href="/auth/signup" className="lp-btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>Get started free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,9vw,110px) 24px clamp(50px,7vw,90px)', position: 'relative', overflow: 'hidden', background: 'var(--lp-bg)' }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -60, right: -40, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,140,0,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,48,8,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--lp-border) 1.5px, transparent 1.5px)', backgroundSize: '28px 28px', opacity: .6, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center', position: 'relative' }}>
          {/* Left — copy */}
          <div style={{ maxWidth: 620 }}>
            <div className="fu0" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,140,0,.1)', border: '1px solid rgba(255,140,0,.3)', borderRadius: 999, padding: '7px 16px', marginBottom: 26, fontSize: 13, fontWeight: 700, color: '#B05A00' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF8C00', display: 'inline-block', animation: 'shimmer 1.8s infinite' }} />
              Hyperlocal delivery — now live near you
            </div>

            <h1 className="fu1" style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2.6rem,5.5vw,4.2rem)', fontWeight: 800, lineHeight: 1.06, letterSpacing: '-.04em', color: 'var(--lp-text)', marginBottom: 22 }}>
              Your neighbourhood<br />
              <span style={{ color: 'var(--lp-red)', position: 'relative' }}>
                delivered fresh
                <svg style={{ position: 'absolute', bottom: -6, left: 0, width: '100%', height: 8, overflow: 'visible' }} viewBox="0 0 300 8" preserveAspectRatio="none">
                  <path d="M0,6 Q75,1 150,5 Q225,9 300,4" stroke="#FF8C00" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" />
                </svg>
              </span>
            </h1>

            <p className="fu2" style={{ fontSize: 'clamp(15px,2.2vw,17px)', color: 'var(--lp-text3)', lineHeight: 1.8, marginBottom: 34, maxWidth: 500 }}>
              Food, grocery, pharmacy, bakery — real shops from your street. Real riders. Real-time tracking. Under 30 minutes, every time.
            </p>

            <div className="fu3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 36 }}>
              {user ? (
                <Link href={dashHref} className="lp-btn-primary">Go to my dashboard →</Link>
              ) : (
                <>
                  <Link href="/auth/signup" className="lp-btn-primary">Order from nearby shops 🛵</Link>
                  <Link href="/auth/signup?role=business" className="lp-btn-secondary">List your shop 🏪</Link>
                </>
              )}
            </div>

            <div className="fu4" style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {['No minimum order', 'UPI & Cash accepted', 'Live rider tracking', 'Real local shops only'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--lp-text2)', fontWeight: 600 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,48,8,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--lp-red)', fontWeight: 900, flexShrink: 0 }}>✓</span>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating cards (hidden on mobile) */}
          <div className="hide-m si" style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 230 }}>
            {/* Shop card */}
            <div className="float-a" style={{ background: 'var(--lp-card)', border: '1.5px solid var(--lp-border)', borderRadius: 18, padding: '16px 18px', boxShadow: 'var(--lp-shadow-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏪</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--lp-text)' }}>Sharma Kirana</div>
                  <div style={{ fontSize: 11, color: 'var(--lp-text3)' }}>0.4 km away · Open now</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ background: 'rgba(26,122,74,.1)', color: '#1A7A4A', fontWeight: 700, padding: '3px 8px', borderRadius: 8 }}>⭐ 4.8</span>
                <span style={{ background: 'rgba(255,48,8,.08)', color: 'var(--lp-red)', fontWeight: 700, padding: '3px 8px', borderRadius: 8 }}>20-25 min</span>
              </div>
            </div>
            {/* Live order card */}
            <div className="float-b" style={{ background: 'linear-gradient(135deg, #FF3008, #FF6B35)', border: 'none', borderRadius: 18, padding: '16px 18px', boxShadow: '0 6px 24px rgba(255,48,8,.35)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>LIVE ORDER</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 10 }}>Rider 2 min away 🛵</div>
              <div style={{ height: 5, background: 'rgba(255,255,255,.25)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '85%', background: '#fff', borderRadius: 999, transition: 'width .3s' }} />
              </div>
            </div>
            {/* Savings badge */}
            <div className="float-c" style={{ background: 'var(--lp-card)', border: '1.5px solid rgba(26,122,74,.2)', borderRadius: 18, padding: '14px 18px', boxShadow: 'var(--lp-shadow)' }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: '#1A7A4A', marginBottom: 2 }}>FREE 🎉</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', fontWeight: 600 }}>Delivery on orders over ₹299</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY STRIP ───────────────────────── */}
      <div style={{ background: 'var(--lp-bg2)', borderTop: '1px solid var(--lp-border)', borderBottom: '1px solid var(--lp-border)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--lp-text3)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>Browse by category</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {CATEGORIES.map((c, i) => (
              <div key={c.label} className={`cat-pill${i === catIdx ? ' active' : ''}`} onClick={() => setCatIdx(i)}>
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: i === catIdx ? '#fff' : 'var(--lp-text2)', whiteSpace: 'nowrap' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS ────────────────────────────────── */}
      <div style={{ background: 'var(--lp-bg3)', borderBottom: '1px solid var(--lp-border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '0 24px' }} className="lp-grid-4">
          {[
            { val: stats.shops  > 0 ? `${stats.shops}+`  : '12+', label: 'Local shops live', icon: '🏪' },
            { val: stats.orders > 0 ? `${stats.orders}+` : '200+', label: 'Orders delivered', icon: '📦' },
            { val: stats.riders > 0 ? `${stats.riders}+` : '8+', label: 'Delivery riders', icon: '🛵' },
            { val: '< 30', label: 'Min avg delivery', icon: '⚡' },
          ].map((s, i) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '28px 16px', borderRight: i < 3 ? '1px solid var(--lp-border)' : 'none' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div className="stat-num">{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROMISE TICKER ───────────────────────── */}
      <div style={{ background: 'var(--lp-red)', padding: '12px 0', overflow: 'hidden' }}>
        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...PROMISES, ...PROMISES].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 48, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>{p.title}</span>
                <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>{p.sub}</span>
                <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 18, paddingLeft: 12 }}>·</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────── */}
      <section id="how" style={{ padding: 'clamp(64px,8vw,100px) 24px', background: 'var(--lp-bg)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--lp-red)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', letterSpacing: '-.04em', color: 'var(--lp-text)' }}>
              From craving to door in 4 steps
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="lp-grid-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 36, color: i === 0 ? 'var(--lp-red)' : 'var(--lp-border)', letterSpacing: '-.04em', lineHeight: 1 }}>{s.n}</span>
                  <span style={{ fontSize: 30 }}>{s.icon}</span>
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--lp-text)', marginBottom: 10, letterSpacing: '-.01em' }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--lp-text3)', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href={user ? dashHref : '/auth/signup'} className="lp-btn-primary">
              {user ? 'Go to my dashboard →' : 'Start ordering for free →'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM / DIFFERENCE ─────────────── */}
      <section style={{ padding: 'clamp(56px,7vw,88px) 24px', background: 'var(--lp-bg2)', borderTop: '1px solid var(--lp-border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }} className="lp-grid-2">
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--lp-red)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>Why Welokl</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,3.2vw,2.6rem)', letterSpacing: '-.04em', color: 'var(--lp-text)', lineHeight: 1.15, marginBottom: 20 }}>
              Big apps ignore<br />your street.<br /><span style={{ color: 'var(--lp-red)' }}>We don't.</span>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--lp-text3)', lineHeight: 1.8, marginBottom: 28 }}>
              National apps use dark kitchens 15 km away. Your local kirana, pharmacy, corner bakery — invisible to them. Welokl makes every shop in your locality discoverable and deliverable.
            </p>
            <Link href={user ? dashHref : '/stores'} className="lp-btn-secondary" style={{ fontSize: 14 }}>Explore local shops →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { bad: '🏭 Dark kitchens 15 km away', good: '🏪 Your street-corner shop' },
              { bad: '😰 No local pharmacy delivery', good: '💊 Medicine in 20 minutes' },
              { bad: '📉 Shops losing to big apps', good: '📈 Shops keep most of revenue' },
              { bad: '😔 Riders underpaid', good: '🤑 Riders earn fairly here' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#B03030', fontWeight: 600 }}>{row.bad}</div>
                <div style={{ background: 'rgba(26,122,74,.07)', border: '1px solid rgba(26,122,74,.2)', borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#1A7A4A', fontWeight: 700 }}>{row.good}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR EVERYONE ─────────────────────────── */}
      <section id="for" style={{ padding: 'clamp(64px,8vw,100px) 24px', background: 'var(--lp-bg)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--lp-red)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>Who it's for</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', letterSpacing: '-.04em', color: 'var(--lp-text)' }}>
              Built for the whole neighbourhood
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }} className="lp-grid-3">
            {/* Customers */}
            <div className="lp-for-card" style={{ background: 'linear-gradient(145deg, #FFF8F0, #FFF0DC)', border: '1.5px solid rgba(255,140,0,.2)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--lp-text)', marginBottom: 10, letterSpacing: '-.02em' }}>Customers</h3>
              <p style={{ fontSize: 14, color: 'var(--lp-text3)', lineHeight: 1.75, marginBottom: 20 }}>Every kind of local shop at your fingertips. Delivered hot, fresh or cold in under 30 minutes.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {['Order any local shop', 'Live rider tracking', 'Pickup or delivery', 'UPI & Cash accepted'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--lp-text2)', fontWeight: 600 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,48,8,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--lp-red)', fontWeight: 900, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href={user && role === 'customer' ? dashHref : '/auth/signup'} className="lp-btn-primary" style={{ display: 'block', textAlign: 'center' }}>
                {user && role === 'customer' ? 'Go to my orders →' : 'Order now — it\'s free →'}
              </Link>
            </div>

            {/* Shop owners */}
            <div className="lp-for-card" style={{ background: 'linear-gradient(145deg, #F8F4FF, #EDE8FF)', border: '1.5px solid rgba(120,80,220,.15)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--lp-text)', marginBottom: 10, letterSpacing: '-.02em' }}>Shop Owners</h3>
              <p style={{ fontSize: 14, color: 'var(--lp-text3)', lineHeight: 1.75, marginBottom: 20 }}>List your shop free. We bring local customers to you. Keep most of every sale with the lowest commission around.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {['Free listing — zero setup', 'Low commission on sales', 'Dashboard to manage orders', 'Accept pickup & delivery'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--lp-text2)', fontWeight: 600 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(120,80,220,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#7850DC', fontWeight: 900, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href={user && (role === 'shopkeeper' || role === 'business') ? dashHref : '/auth/signup?role=business'} style={{ display: 'block', textAlign: 'center', padding: '14px 0', borderRadius: 14, background: '#7850DC', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', transition: 'transform .15s, box-shadow .15s', boxShadow: '0 4px 16px rgba(120,80,220,.35)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)' }}>
                {user && (role === 'shopkeeper' || role === 'business') ? 'Go to my shop →' : 'Register your shop →'}
              </Link>
            </div>

            {/* Riders */}
            <div className="lp-for-card" style={{ background: 'linear-gradient(145deg, #F0FFF6, #DCFFE8)', border: '1.5px solid rgba(26,122,74,.15)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--lp-text)', marginBottom: 10, letterSpacing: '-.02em' }}>Delivery Riders</h3>
              <p style={{ fontSize: 14, color: 'var(--lp-text3)', lineHeight: 1.75, marginBottom: 20 }}>Earn solid income in your own neighbourhood. Short local trips. Instant wallet credit. Work whenever you want.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {['Competitive pay per trip', 'Instant wallet credit', 'Your own hours', 'Short local distances only'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--lp-text2)', fontWeight: 600 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(26,122,74,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#1A7A4A', fontWeight: 900, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href={user && role === 'delivery' ? dashHref : '/auth/signup?role=delivery'} style={{ display: 'block', textAlign: 'center', padding: '14px 0', borderRadius: 14, background: '#1A7A4A', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', transition: 'transform .15s, box-shadow .15s', boxShadow: '0 4px 16px rgba(26,122,74,.35)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)' }}>
                {user && role === 'delivery' ? 'Go to my deliveries →' : 'Start earning today →'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────── */}
      <section id="mission" style={{ padding: 'clamp(64px,8vw,100px) 24px', background: 'var(--lp-bg2)', borderTop: '1px solid var(--lp-border)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--lp-red)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 20 }}>Our Mission</p>
          <blockquote style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.5rem,3.5vw,2.3rem)', lineHeight: 1.25, letterSpacing: '-.03em', marginBottom: 24, color: 'var(--lp-text)', fontStyle: 'normal' }}>
            "Make local commerce thrive in the age of apps — so the shop at the end of your street stays open."
          </blockquote>
          <p style={{ fontSize: 15, color: 'var(--lp-text3)', lineHeight: 1.8, maxWidth: 540, margin: '0 auto 40px' }}>
            Every order on Welokl keeps a local shopkeeper in business, puts fair wages in a rider's pocket, and gets fresh goods to a neighbour's door. Hyperlocal, honest, built to last.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            {[{ icon: '🌱', title: 'Community first', sub: 'No dark kitchens ever' }, { icon: '⚡', title: 'Under 30 minutes', sub: 'Guaranteed or notified' }, { icon: '🤝', title: 'Fair for everyone', sub: 'Shops & riders paid well' }].map(v => (
              <div key={v.title} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--lp-card)', border: '1.5px solid var(--lp-border)', borderRadius: 16, padding: '16px 20px', minWidth: 180 }}>
                <span style={{ fontSize: 24 }}>{v.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--lp-text)' }}>{v.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--lp-text3)', fontWeight: 600, marginTop: 2 }}>{v.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────── */}
      {!user && (
        <section style={{ padding: 'clamp(64px,8vw,100px) 24px', background: 'linear-gradient(135deg, #FF3008 0%, #FF6B00 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -40, width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,0,0,.08)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 660, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem,4.5vw,3.2rem)', letterSpacing: '-.04em', color: '#fff', marginBottom: 16, lineHeight: 1.1 }}>
              Your neighbourhood is waiting
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.75)', marginBottom: 36, fontWeight: 500 }}>Free to join. No minimum order. Local shops open right now.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/auth/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 36px', borderRadius: 14, background: '#fff', color: '#FF3008', fontWeight: 900, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.15)', transition: 'transform .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)' }}>
                Create free account →
              </Link>
              <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 36px', borderRadius: 14, background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,.3)', transition: 'transform .15s, background .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.22)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.15)' }}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ───────────────────────────────── */}
      <footer style={{ background: 'var(--lp-bg2)', borderTop: '1px solid var(--lp-border)', padding: '30px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--lp-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>W</div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: 'var(--lp-text)', letterSpacing: '-.02em' }}>welokl</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--lp-text3)', fontWeight: 600 }}>Your neighbourhood, on your phone — © {new Date().getFullYear()} Welokl</p>
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            <a href="#" style={{ textDecoration: 'none', color: 'var(--lp-text3)', fontWeight: 600 }}>Privacy</a>
            <a href="#" style={{ textDecoration: 'none', color: 'var(--lp-text3)', fontWeight: 600 }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}