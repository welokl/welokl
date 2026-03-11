'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

const ROLE_DEST: Record<string, string> = {
  customer: '/dashboard/customer', shopkeeper: '/dashboard/business',
  business: '/dashboard/business', delivery: '/dashboard/delivery', admin: '/dashboard/admin',
}

const CATS = [
  { icon:'🍔', label:'Food'       },
  { icon:'🛒', label:'Grocery'    },
  { icon:'💊', label:'Pharmacy'   },
  { icon:'🥐', label:'Bakery'     },
  { icon:'✂️', label:'Salon'      },
  { icon:'🍦', label:'Desserts'   },
  { icon:'🐾', label:'Pet shop'   },
  { icon:'📦', label:'General'    },
]

const STEPS = [
  { n:'01', icon:'📍', title:'Share location',    desc:'We show every open shop within your colony — not a dark kitchen 15 km away.' },
  { n:'02', icon:'🛒', title:'Pick what you need', desc:'Food, grocery, medicine, bakery — browse live menus with real stock.' },
  { n:'03', icon:'🛵', title:'Rider picks it up',  desc:'A local rider accepts in seconds. Track them live on the map.' },
  { n:'04', icon:'🎉', title:'At your door',        desc:'Under 30 minutes. Pay UPI or cash. No surprises.' },
]

export default function LandingPage() {
  const [user, setUser]     = useState<any>(undefined) // undefined = loading
  const [role, setRole]     = useState('')
  const [stats, setStats]   = useState({ shops: 0, orders: 0, riders: 0 })
  const [catIdx, setCatIdx] = useState(0)
  const catTimer            = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    async function init() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const u = session?.user ?? null
      if (u) {
        let r = u.user_metadata?.role || ''
        if (!r) {
          const { data: p } = await sb.from('users').select('role').eq('id', u.id).single()
          r = p?.role || 'customer'
        }
        // Redirect immediately — signed-in users go to their home
        window.location.replace(ROLE_DEST[r] || '/dashboard/customer')
        return
      }
      setUser(null)
      // Load live stats for guests
      const [{ count: s }, { count: ri }, { count: o }] = await Promise.all([
        sb.from('shops').select('*', { count:'exact', head:true }).eq('is_active', true),
        sb.from('users').select('*', { count:'exact', head:true }).eq('role', 'delivery'),
        sb.from('orders').select('*', { count:'exact', head:true }).eq('status', 'delivered'),
      ])
      setStats({ shops: s||0, riders: ri||0, orders: o||0 })
    }
    init()
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_, s) => {
      if (!s?.user) setUser(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    catTimer.current = setInterval(() => setCatIdx(i => (i+1) % CATS.length), 2000)
    return () => { if (catTimer.current) clearInterval(catTimer.current) }
  }, [])

  // Full-screen loading while checking auth — prevents flash
  if (user === undefined) return (
    <div style={{ minHeight:'100vh', background:'var(--lp-bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ width:44, height:44, borderRadius:13, background:'#FF3008', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:22, color:'#fff', marginBottom:16, boxShadow:'0 4px 20px rgba(255,48,8,.35)' }}>W</div>
      <div style={{ width:36, height:3, borderRadius:999, background:'var(--lp-border)', overflow:'hidden' }}>
        <div style={{ height:'100%', background:'#FF3008', borderRadius:999, animation:'lpLoad 1.2s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes lpLoad{0%{width:0;margin-left:0}50%{width:100%;margin-left:0}100%{width:0;margin-left:100%}}`}</style>
    </div>
  )

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", background:'var(--lp-bg)', color:'var(--lp-text)', minHeight:'100vh', overflowX:'hidden' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap');

        /* Animations */
        @keyframes lpFloat  { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
        @keyframes lpFloat2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes lpPulse  { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes lpFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lpSlideIn{ from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes lpTicker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes lpSpin   { to{transform:rotate(360deg)} }
        @keyframes lpLoad   { 0%{width:0;margin-left:0} 50%{width:100%;margin-left:0} 100%{width:0;margin-left:100%} }
        @keyframes lpGlow   { 0%,100%{box-shadow:0 0 20px rgba(255,48,8,.3)} 50%{box-shadow:0 0 40px rgba(255,48,8,.6)} }

        .lp-fu0{animation:lpFadeUp .55s .0s both}
        .lp-fu1{animation:lpFadeUp .55s .1s both}
        .lp-fu2{animation:lpFadeUp .55s .2s both}
        .lp-fu3{animation:lpFadeUp .55s .3s both}
        .lp-fu4{animation:lpFadeUp .55s .4s both}
        .lp-si {animation:lpFadeUp .6s .15s both}

        .lp-float-a { animation:lpFloat  5s ease-in-out infinite }
        .lp-float-b { animation:lpFloat2 6s ease-in-out infinite }

        /* Nav */
        .lp-nav-link { font-size:14px;font-weight:600;color:var(--lp-text3);text-decoration:none;transition:color .15s;padding:6px 4px }
        .lp-nav-link:hover { color:var(--lp-red) }

        /* Buttons */
        .lp-btn-red {
          display:inline-flex;align-items:center;gap:8px;
          padding:14px 24px;border-radius:14px;
          background:var(--lp-red);color:#fff;
          font-weight:800;font-size:15px;text-decoration:none;
          font-family:inherit;border:none;cursor:pointer;
          transition:transform .15s,box-shadow .15s;
          box-shadow:0 4px 20px rgba(255,48,8,.35);
          white-space:nowrap;
        }
        .lp-btn-red:hover { transform:translateY(-2px);box-shadow:0 8px 28px rgba(255,48,8,.45) }
        .lp-btn-red:active { transform:scale(.97) }
        .lp-btn-outline {
          display:inline-flex;align-items:center;gap:8px;
          padding:14px 24px;border-radius:14px;
          background:var(--lp-card);color:var(--lp-text);
          font-weight:800;font-size:15px;text-decoration:none;
          border:2px solid var(--lp-border);font-family:inherit;cursor:pointer;
          transition:transform .15s,border-color .15s;white-space:nowrap;
        }
        .lp-btn-outline:hover { transform:translateY(-2px);border-color:var(--lp-red) }

        /* Cat pills */
        .lp-cat-pill {
          flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;
          padding:12px 14px;border-radius:16px;cursor:pointer;
          transition:all .2s;border:1.5px solid var(--lp-border);
          min-width:68px;background:var(--lp-card);
          -webkit-tap-highlight-color:transparent;
        }
        .lp-cat-pill.on { background:var(--lp-red);border-color:var(--lp-red) }
        .lp-cat-pill:not(.on):hover { border-color:var(--lp-amber);transform:translateY(-2px) }

        /* Step cards */
        .lp-step {
          background:var(--lp-card);border:1.5px solid var(--lp-border);
          border-radius:20px;padding:24px;transition:transform .2s,box-shadow .2s;
        }
        .lp-step:hover { transform:translateY(-4px);box-shadow:var(--lp-shadow-lg) }

        /* "For" cards */
        .lp-for-card { border-radius:24px;padding:28px;transition:transform .2s,box-shadow .2s }
        .lp-for-card:hover { transform:translateY(-4px);box-shadow:var(--lp-shadow-lg) }

        /* Stat num */
        .lp-stat-n { font-family:"Syne",sans-serif;font-weight:800;font-size:clamp(2rem,5vw,3rem);color:var(--lp-red);letter-spacing:-.04em;line-height:1 }

        /* Ticker */
        .lp-ticker-wrap { overflow:hidden;width:100% }
        .lp-ticker-inner { display:flex;width:max-content;animation:lpTicker 22s linear infinite }
        .lp-ticker-inner:hover { animation-play-state:paused }

        /* Mobile hero card */
        .lp-hero-card {
          background:var(--lp-card);border:1.5px solid var(--lp-border);
          border-radius:18px;padding:14px 16px;box-shadow:var(--lp-shadow-lg);
        }

        /* Hide/show helpers */
        @media(max-width:640px) { .lp-desktop{display:none!important} }
        @media(min-width:641px) { .lp-mobile{display:none!important} }

        /* Grid helpers */
        @media(max-width:720px) {
          .lp-grid-2   { grid-template-columns:1fr!important }
          .lp-grid-3   { grid-template-columns:1fr!important }
          .lp-grid-4   { grid-template-columns:1fr 1fr!important }
          .lp-grid-steps{ grid-template-columns:1fr 1fr!important }
          .lp-hero-grid { grid-template-columns:1fr!important }
          .lp-hero-btns { flex-direction:column!important }
          .lp-hero-btns .lp-btn-red, .lp-hero-btns .lp-btn-outline { width:100%;justify-content:center }
        }
        @media(max-width:460px) {
          .lp-grid-4    { grid-template-columns:1fr 1fr!important }
          .lp-grid-steps{ grid-template-columns:1fr!important }
          .lp-stats-grid{ grid-template-columns:1fr 1fr!important }
        }

        /* Mobile stat borders */
        @media(max-width:460px) {
          .lp-stat-border-r { border-right:none!important;border-bottom:1px solid var(--lp-border) }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'var(--lp-nav-bg)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', borderBottom:'1px solid var(--lp-border)' }}>
        <div style={{ maxWidth:1120, margin:'0 auto', padding:'0 16px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'var(--lp-red)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, color:'#fff', boxShadow:'0 3px 10px rgba(255,48,8,.35)' }}>W</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:19, color:'var(--lp-text)', letterSpacing:'-.03em' }}>welokl</span>
          </Link>

          <div className="lp-desktop" style={{ display:'flex', alignItems:'center', gap:28 }}>
            <a href="#how"     className="lp-nav-link">How it works</a>
            <a href="#for"     className="lp-nav-link">For you</a>
            <a href="#mission" className="lp-nav-link">Mission</a>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <ThemeToggle />
            <Link href="/auth/login"  className="lp-nav-link lp-desktop" style={{ padding:'8px 10px' }}>Log in</Link>
            <Link href="/auth/signup" className="lp-btn-red" style={{ padding:'9px 18px', fontSize:13 }}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────── */}
      <section style={{ padding:'clamp(32px,6vw,96px) 16px clamp(28px,5vw,80px)', position:'relative', overflow:'hidden', background:'var(--lp-bg)' }}>
        {/* Blobs */}
        <div style={{ position:'absolute', top:-80, right:-60, width:480, height:480, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,140,0,.13) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-40, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,48,8,.08) 0%,transparent 70%)', pointerEvents:'none' }} />
        {/* Dot grid */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(var(--lp-border) 1.5px,transparent 1.5px)', backgroundSize:'26px 26px', opacity:.5, pointerEvents:'none' }} />

        <div className="lp-hero-grid" style={{ maxWidth:1120, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 320px', gap:48, alignItems:'center', position:'relative' }}>

          {/* Copy */}
          <div>
            <div className="lp-fu0" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,140,0,.1)', border:'1px solid rgba(255,140,0,.3)', borderRadius:999, padding:'6px 14px', marginBottom:20, fontSize:12, fontWeight:700, color:'#B05A00' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#FF8C00', display:'inline-block', animation:'lpPulse 1.8s infinite' }} />
              Live near you — Jaipur &amp; expanding
            </div>

            <h1 className="lp-fu1" style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(2.4rem,6vw,4rem)', fontWeight:800, lineHeight:1.06, letterSpacing:'-.04em', color:'var(--lp-text)', marginBottom:18 }}>
              Your neighbourhood<br />
              <span style={{ color:'var(--lp-red)', position:'relative', display:'inline-block' }}>
                delivered fresh
                <svg style={{ position:'absolute', bottom:-4, left:0, width:'100%', height:7 }} viewBox="0 0 300 7" preserveAspectRatio="none">
                  <path d="M0,5 Q75,1 150,5 Q225,9 300,3" stroke="#FF8C00" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".7" />
                </svg>
              </span>
            </h1>

            <p className="lp-fu2" style={{ fontSize:'clamp(14px,2vw,16px)', color:'var(--lp-text3)', lineHeight:1.8, marginBottom:28, maxWidth:480 }}>
              Food, grocery, pharmacy, bakery — real shops from your street. Real riders. Real-time tracking. Under 30 minutes, every time.
            </p>

            <div className="lp-fu3 lp-hero-btns" style={{ display:'flex', gap:12, alignItems:'center', marginBottom:28, flexWrap:'wrap' }}>
              <Link href="/auth/signup" className="lp-btn-red">Order from nearby shops 🛵</Link>
              <Link href="/auth/signup?role=business" className="lp-btn-outline">List your shop 🏪</Link>
            </div>

            <div className="lp-fu4" style={{ display:'flex', flexWrap:'wrap', gap:14 }}>
              {['No minimum order','UPI & Cash','Live tracking','Real local shops'].map(t => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--lp-text2)', fontWeight:600 }}>
                  <span style={{ width:16, height:16, borderRadius:'50%', background:'rgba(255,48,8,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--lp-red)', fontWeight:900, flexShrink:0 }}>✓</span>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Floating cards — desktop only */}
          <div className="lp-desktop lp-si" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="lp-hero-card lp-float-a">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,140,0,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🏪</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:13, color:'var(--lp-text)' }}>Sharma Kirana</div>
                  <div style={{ fontSize:11, color:'var(--lp-text3)' }}>0.4 km · Open now</div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span style={{ background:'rgba(26,122,74,.1)', color:'#1A7A4A', fontWeight:700, padding:'3px 8px', borderRadius:8 }}>⭐ 4.8</span>
                <span style={{ background:'rgba(255,48,8,.08)', color:'var(--lp-red)', fontWeight:700, padding:'3px 8px', borderRadius:8 }}>20–25 min</span>
              </div>
            </div>

            <div className="lp-float-b" style={{ background:'linear-gradient(135deg,#FF3008,#FF6B35)', borderRadius:18, padding:'14px 16px', boxShadow:'0 6px 24px rgba(255,48,8,.35)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.7)', marginBottom:5 }}>LIVE ORDER 🛵</div>
              <div style={{ fontWeight:800, fontSize:14, color:'#fff', marginBottom:10 }}>Rider 2 min away</div>
              <div style={{ height:5, background:'rgba(255,255,255,.25)', borderRadius:999 }}>
                <div style={{ height:'100%', width:'85%', background:'#fff', borderRadius:999 }} />
              </div>
            </div>

            <div className="lp-hero-card lp-float-a" style={{ borderColor:'rgba(26,122,74,.2)' }}>
              <div style={{ fontWeight:800, fontSize:20, color:'#1A7A4A', marginBottom:2 }}>FREE 🎉</div>
              <div style={{ fontSize:12, color:'var(--lp-text3)', fontWeight:600 }}>Delivery on orders over ₹299</div>
            </div>
          </div>

          {/* Mobile — single social proof card instead */}
          <div className="lp-mobile lp-fu4" style={{ background:'linear-gradient(135deg,#FF3008,#FF6B35)', borderRadius:20, padding:'18px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 8px 28px rgba(255,48,8,.35)' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.75)', marginBottom:5, letterSpacing:'.04em' }}>LIVE ORDER</div>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff', marginBottom:8 }}>Rider 2 min away 🛵</div>
              <div style={{ height:5, background:'rgba(255,255,255,.25)', borderRadius:999, width:140 }}>
                <div style={{ height:'100%', width:'85%', background:'#fff', borderRadius:999 }} />
              </div>
            </div>
            <span style={{ fontSize:48, lineHeight:1 }}>🛵</span>
          </div>
        </div>
      </section>

      {/* ── CATEGORY STRIP ──────────────────────── */}
      <div style={{ background:'var(--lp-bg2)', borderTop:'1px solid var(--lp-border)', borderBottom:'1px solid var(--lp-border)', padding:'18px 16px' }}>
        <div style={{ maxWidth:1120, margin:'0 auto' }}>
          <p style={{ fontSize:11, fontWeight:800, color:'var(--lp-text3)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:12 }}>Browse by category</p>
          <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
            {CATS.map((c,i) => (
              <div key={c.label} className={`lp-cat-pill${i===catIdx?' on':''}`} onClick={() => setCatIdx(i)}>
                <span style={{ fontSize:22 }}>{c.icon}</span>
                <span style={{ fontSize:11, fontWeight:700, color:i===catIdx?'#fff':'var(--lp-text2)', whiteSpace:'nowrap' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS ───────────────────────────────── */}
      <div style={{ background:'var(--lp-bg3)', borderBottom:'1px solid var(--lp-border)' }}>
        <div className="lp-stats-grid" style={{ maxWidth:1120, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', padding:'0 16px' }}>
          {[
            { val: stats.shops>0  ? `${stats.shops}+`  : '12+',  label:'Local shops', icon:'🏪' },
            { val: stats.orders>0 ? `${stats.orders}+` : '200+', label:'Delivered',    icon:'📦' },
            { val: stats.riders>0 ? `${stats.riders}+` : '8+',   label:'Riders',       icon:'🛵' },
            { val: '<30',                                          label:'Min delivery', icon:'⚡' },
          ].map((s,i) => (
            <div key={s.label} className={i<3?'lp-stat-border-r':''} style={{ textAlign:'center', padding:'22px 12px', borderRight: i<3 ? '1px solid var(--lp-border)' : 'none' }}>
              <div style={{ fontSize:20, marginBottom:5 }}>{s.icon}</div>
              <div className="lp-stat-n">{s.val}</div>
              <div style={{ fontSize:12, color:'var(--lp-text3)', fontWeight:600, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TICKER ──────────────────────────────── */}
      <div style={{ background:'var(--lp-red)', padding:'11px 0', overflow:'hidden' }}>
        <div className="lp-ticker-wrap">
          <div className="lp-ticker-inner">
            {[...Array(2)].flatMap(() => [
              { icon:'⚡', t:'Under 30 min' },
              { icon:'📍', t:'Hyperlocal only' },
              { icon:'💰', t:'Fair prices' },
              { icon:'🤝', t:'Riders paid well' },
              { icon:'🏪', t:'Real local shops' },
              { icon:'💳', t:'UPI & Cash' },
            ]).map((p,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, paddingRight:44, whiteSpace:'nowrap' }}>
                <span style={{ fontSize:15 }}>{p.icon}</span>
                <span style={{ fontWeight:800, fontSize:13, color:'#fff' }}>{p.t}</span>
                <span style={{ color:'rgba(255,255,255,.35)', fontSize:16, paddingLeft:10 }}>·</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────── */}
      <section id="how" style={{ padding:'clamp(52px,7vw,90px) 16px', background:'var(--lp-bg)' }}>
        <div style={{ maxWidth:1120, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <p style={{ fontSize:11, fontWeight:800, color:'var(--lp-red)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:10 }}>How it works</p>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.8rem,4vw,2.8rem)', letterSpacing:'-.04em', color:'var(--lp-text)' }}>
              From craving to door in 4 steps
            </h2>
          </div>

          <div className="lp-grid-steps" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {STEPS.map((s,i) => (
              <div key={s.n} className="lp-step">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:34, color:i===0?'var(--lp-red)':'var(--lp-border)', letterSpacing:'-.04em', lineHeight:1 }}>{s.n}</span>
                  <span style={{ fontSize:28 }}>{s.icon}</span>
                </div>
                <h3 style={{ fontWeight:800, fontSize:15, color:'var(--lp-text)', marginBottom:8, letterSpacing:'-.01em' }}>{s.title}</h3>
                <p style={{ fontSize:13, color:'var(--lp-text3)', lineHeight:1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign:'center', marginTop:36 }}>
            <Link href="/auth/signup" className="lp-btn-red">Start ordering free →</Link>
          </div>
        </div>
      </section>

      {/* ── WHY WELOKL ──────────────────────── */}
      <section style={{ padding:'clamp(48px,6vw,80px) 16px', background:'var(--lp-bg2)', borderTop:'1px solid var(--lp-border)' }}>
        <div className="lp-grid-2" style={{ maxWidth:1120, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:52, alignItems:'center' }}>
          <div>
            <p style={{ fontSize:11, fontWeight:800, color:'var(--lp-red)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:12 }}>Why Welokl</p>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.7rem,3.5vw,2.5rem)', letterSpacing:'-.04em', color:'var(--lp-text)', lineHeight:1.15, marginBottom:18 }}>
              Big apps ignore<br />your street.<br /><span style={{ color:'var(--lp-red)' }}>We don't.</span>
            </h2>
            <p style={{ fontSize:14, color:'var(--lp-text3)', lineHeight:1.8, marginBottom:24 }}>
              National apps use dark kitchens 15 km away. Your local kirana, pharmacy, corner bakery — invisible to them. Welokl makes every shop in your locality discoverable and deliverable.
            </p>
            <Link href="/stores" className="lp-btn-outline" style={{ fontSize:14 }}>Explore local shops →</Link>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { bad:'🏭 Dark kitchens 15 km away',     good:'🏪 Your street-corner shop'  },
              { bad:'😰 No local pharmacy delivery',    good:'💊 Medicine in 20 minutes'   },
              { bad:'📉 Shops losing to big apps',      good:'📈 Shops keep most revenue'  },
              { bad:'😔 Riders underpaid',               good:'🤑 Riders earn fairly here'  },
            ].map((row,i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', borderRadius:12, padding:'10px 13px', fontSize:13, color:'#B03030', fontWeight:600 }}>{row.bad}</div>
                <div style={{ background:'rgba(26,122,74,.07)', border:'1px solid rgba(26,122,74,.2)', borderRadius:12, padding:'10px 13px', fontSize:13, color:'#1A7A4A', fontWeight:700 }}>{row.good}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR EVERYONE ────────────────────── */}
      <section id="for" style={{ padding:'clamp(52px,7vw,90px) 16px', background:'var(--lp-bg)' }}>
        <div style={{ maxWidth:1120, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <p style={{ fontSize:11, fontWeight:800, color:'var(--lp-red)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:10 }}>Who it's for</p>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.8rem,4vw,2.8rem)', letterSpacing:'-.04em', color:'var(--lp-text)' }}>
              Built for the whole neighbourhood
            </h2>
          </div>

          <div className="lp-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18 }}>
            {/* Customers */}
            <div className="lp-for-card" style={{ background:'linear-gradient(145deg,var(--lp-bg2),var(--lp-bg3))', border:'1.5px solid rgba(255,140,0,.2)' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>🛍️</div>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:'var(--lp-text)', marginBottom:8 }}>Customers</h3>
              <p style={{ fontSize:13, color:'var(--lp-text3)', lineHeight:1.75, marginBottom:18 }}>Every kind of local shop at your fingertips. Delivered in under 30 minutes.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:20 }}>
                {['Order any local shop','Live rider tracking','Pickup or delivery','UPI & Cash accepted'].map(f => (
                  <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--lp-text2)', fontWeight:600 }}>
                    <span style={{ width:17, height:17, borderRadius:'50%', background:'rgba(255,48,8,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'var(--lp-red)', fontWeight:900, flexShrink:0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" className="lp-btn-red" style={{ display:'block', textAlign:'center' }}>Order now — free →</Link>
            </div>

            {/* Shop owners */}
            <div className="lp-for-card" style={{ background:'linear-gradient(145deg,#F8F4FF,#EDE8FF)', border:'1.5px solid rgba(120,80,220,.15)' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>🏪</div>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:'var(--lp-text)', marginBottom:8 }}>Shop Owners</h3>
              <p style={{ fontSize:13, color:'var(--lp-text3)', lineHeight:1.75, marginBottom:18 }}>List free. Lowest commission. Your orders, your dashboard, your revenue.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:20 }}>
                {['Free listing — zero setup','Low commission on sales','Orders dashboard','Accept pickup & delivery'].map(f => (
                  <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--lp-text2)', fontWeight:600 }}>
                    <span style={{ width:17, height:17, borderRadius:'50%', background:'rgba(120,80,220,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#7850DC', fontWeight:900, flexShrink:0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=business" style={{ display:'block', textAlign:'center', padding:'14px 0', borderRadius:14, background:'#7850DC', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none', boxShadow:'0 4px 16px rgba(120,80,220,.35)' }}>
                Register shop →
              </Link>
            </div>

            {/* Riders */}
            <div className="lp-for-card" style={{ background:'linear-gradient(145deg,#F0FFF6,#DCFFE8)', border:'1.5px solid rgba(26,122,74,.15)' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>🛵</div>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:'var(--lp-text)', marginBottom:8 }}>Delivery Riders</h3>
              <p style={{ fontSize:13, color:'var(--lp-text3)', lineHeight:1.75, marginBottom:18 }}>Earn solid income locally. Short trips. Instant wallet credit. Your hours.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:20 }}>
                {['Competitive pay per trip','Instant wallet credit','Your own hours','Short local distances only'].map(f => (
                  <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--lp-text2)', fontWeight:600 }}>
                    <span style={{ width:17, height:17, borderRadius:'50%', background:'rgba(26,122,74,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#1A7A4A', fontWeight:900, flexShrink:0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=delivery" style={{ display:'block', textAlign:'center', padding:'14px 0', borderRadius:14, background:'#1A7A4A', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none', boxShadow:'0 4px 16px rgba(26,122,74,.35)' }}>
                Start earning today →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION ─────────────────────────── */}
      <section id="mission" style={{ padding:'clamp(52px,7vw,90px) 16px', background:'var(--lp-bg2)', borderTop:'1px solid var(--lp-border)' }}>
        <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
          <p style={{ fontSize:11, fontWeight:800, color:'var(--lp-red)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:16 }}>Our Mission</p>
          <blockquote style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.4rem,3.5vw,2.1rem)', lineHeight:1.25, letterSpacing:'-.03em', marginBottom:20, color:'var(--lp-text)', fontStyle:'normal' }}>
            "Make local commerce thrive — so the shop at the end of your street stays open."
          </blockquote>
          <p style={{ fontSize:14, color:'var(--lp-text3)', lineHeight:1.8, maxWidth:500, margin:'0 auto 36px' }}>
            Every order keeps a local shopkeeper in business, puts fair wages in a rider's pocket, and gets fresh goods to a neighbour's door.
          </p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexWrap:'wrap' }}>
            {[{ icon:'🌱', t:'Community first', s:'No dark kitchens ever' },{ icon:'⚡', t:'Under 30 min', s:'Guaranteed or notified' },{ icon:'🤝', t:'Fair for all', s:'Shops & riders paid well' }].map(v => (
              <div key={v.t} style={{ display:'flex', alignItems:'center', gap:11, background:'var(--lp-card)', border:'1.5px solid var(--lp-border)', borderRadius:16, padding:'14px 18px' }}>
                <span style={{ fontSize:22 }}>{v.icon}</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontWeight:800, fontSize:13, color:'var(--lp-text)' }}>{v.t}</div>
                  <div style={{ fontSize:11, color:'var(--lp-text3)', fontWeight:600, marginTop:2 }}>{v.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ──────────────────────── */}
      <section style={{ padding:'clamp(52px,7vw,90px) 16px', background:'linear-gradient(135deg,#FF3008 0%,#FF6B00 100%)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-50, right:-50, width:380, height:380, borderRadius:'50%', background:'rgba(255,255,255,.06)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-30, width:280, height:280, borderRadius:'50%', background:'rgba(0,0,0,.08)', pointerEvents:'none' }} />
        <div style={{ maxWidth:600, margin:'0 auto', textAlign:'center', position:'relative' }}>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.9rem,5vw,3rem)', letterSpacing:'-.04em', color:'#fff', marginBottom:14, lineHeight:1.1 }}>
            Your neighbourhood is waiting
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.78)', marginBottom:32, fontWeight:500 }}>Free to join. No minimum order. Local shops open right now.</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/auth/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 32px', borderRadius:14, background:'#fff', color:'#FF3008', fontWeight:900, fontSize:15, textDecoration:'none', boxShadow:'0 4px 20px rgba(0,0,0,.15)', transition:'transform .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform='translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform='translateY(0)' }}>
              Create free account →
            </Link>
            <Link href="/auth/login" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 32px', borderRadius:14, background:'rgba(255,255,255,.15)', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none', border:'1.5px solid rgba(255,255,255,.3)', transition:'transform .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,.22)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,.15)' }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────── */}
      <footer style={{ background:'var(--lp-bg2)', borderTop:'1px solid var(--lp-border)', padding:'24px 16px' }}>
        <div style={{ maxWidth:1120, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'var(--lp-red)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, color:'#fff' }}>W</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:'var(--lp-text)', letterSpacing:'-.02em' }}>welokl</span>
          </div>
          <p style={{ fontSize:12, color:'var(--lp-text3)', fontWeight:600 }}>Your neighbourhood on your phone · © {new Date().getFullYear()} Welokl</p>
          <div style={{ display:'flex', gap:20, fontSize:12 }}>
            <a href="#" style={{ textDecoration:'none', color:'var(--lp-text3)', fontWeight:600 }}>Privacy</a>
            <a href="#" style={{ textDecoration:'none', color:'var(--lp-text3)', fontWeight:600 }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}