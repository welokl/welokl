// src/app/page.tsx
'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── SVG Icons ────────────────────────────────────────────────
const Logo = () => <svg viewBox="0 0 32 32" fill="none" width={32} height={32}><rect width={32} height={32} rx={9} fill="#FF3008"/><path d="M16 6C12.13 6 9 9.13 9 13c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="white"/></svg>
const IcoFood     = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><path d="M5 10h18v10a3 3 0 01-3 3H8a3 3 0 01-3-3V10z" stroke="currentColor" strokeWidth="1.8"/><path d="M9 10V8a2 2 0 012-2h6a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.8"/><path d="M10 15h8M10 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoGrocery  = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><path d="M4 6h3l3.5 12h10L23 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11.5" cy="22" r="1.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="19.5" cy="22" r="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>
const IcoMedicine = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><rect x="7" y="5" width="14" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M14 10v8M10 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IcoElectric = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><rect x="3" y="7" width="22" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="21" cy="14" r="1" fill="currentColor"/></svg>
const IcoSalon    = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="19" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M21 7L9 19M15 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoHardware = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><path d="M16 7l5 5-9 9-5-5 9-9zM7 20l-2 3M21 7l1-3 3-1-1 3-3 1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoPets     = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><ellipse cx="14" cy="17" rx="6" ry="5" stroke="currentColor" strokeWidth="1.8"/><circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="19" cy="9" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="22" cy="15" r="2" stroke="currentColor" strokeWidth="1.8"/></svg>
const IcoGifts    = ({ size=26 }:{size?:number}) => <svg viewBox="0 0 28 28" fill="none" width={size} height={size}><rect x="4" y="12" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M4 12h20v4H4zM14 12V25M14 12C14 9 11 7 9 8s-1 4 2 4h3zM14 12C14 9 17 7 19 8s1 4-2 4h-3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoArrow    = () => <svg viewBox="0 0 18 18" fill="none" width={15} height={15}><path d="M3.5 9h11M10 5l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoStar     = () => <svg viewBox="0 0 14 14" fill="currentColor" width={12} height={12}><path d="M7 1l1.6 3.3L12 4.9l-2.6 2.5.6 3.6L7 9.3l-3 1.7.6-3.6L2 4.9l3.4-.6L7 1z"/></svg>
const IcoClock    = () => <svg viewBox="0 0 16 16" fill="none" width={13} height={13}><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IcoCheck    = () => <svg viewBox="0 0 16 16" fill="none" width={13} height={13}><path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoSun      = () => <svg viewBox="0 0 20 20" fill="none" width={17} height={17}><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoMoon     = () => <svg viewBox="0 0 20 20" fill="none" width={17} height={17}><path d="M17 12.5A7 7 0 117.5 3a5.5 5.5 0 109.5 9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoMenu     = () => <svg viewBox="0 0 20 20" fill="none" width={20} height={20}><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoClose    = () => <svg viewBox="0 0 20 20" fill="none" width={20} height={20}><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoPin      = () => <svg viewBox="0 0 14 14" fill="currentColor" width={12} height={12}><path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>
const IcoBag      = () => <svg viewBox="0 0 16 16" fill="none" width={14} height={14}><path d="M3 5h10l-1 8H4L3 5z" stroke="currentColor" strokeWidth="1.5"/><path d="M6 5V4a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.5"/></svg>
const IcoShield   = () => <svg viewBox="0 0 20 20" fill="none" width={18} height={18}><path d="M10 2L4 5v6c0 4 2.7 7.7 6 9 3.3-1.3 6-5 6-9V5l-6-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoFlash    = () => <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M11 2L4 12h6l-1 6 7-10h-6l1-6z"/></svg>

const CATS = [
  { id:'food',        label:'Food',        Icon:IcoFood,     color:'#FF3008', bg:'rgba(255,48,8,.1)' },
  { id:'grocery',     label:'Grocery',     Icon:IcoGrocery,  color:'#16a34a', bg:'rgba(22,163,74,.1)' },
  { id:'pharmacy',    label:'Medicine',    Icon:IcoMedicine, color:'#2563eb', bg:'rgba(37,99,235,.1)' },
  { id:'electronics', label:'Electronics', Icon:IcoElectric, color:'#7c3aed', bg:'rgba(124,58,237,.1)' },
  { id:'salon',       label:'Salon',       Icon:IcoSalon,    color:'#db2777', bg:'rgba(219,39,119,.1)' },
  { id:'hardware',    label:'Hardware',    Icon:IcoHardware, color:'#d97706', bg:'rgba(217,119,6,.1)' },
  { id:'pets',        label:'Pets',        Icon:IcoPets,     color:'#ea580c', bg:'rgba(234,88,12,.1)' },
  { id:'gifts',       label:'Gifts',       Icon:IcoGifts,    color:'#0891b2', bg:'rgba(8,145,178,.1)' },
]
const CAT_MAP: Record<string,string> = { food:'#FF3008', grocery:'#16a34a', pharmacy:'#2563eb', electronics:'#7c3aed', salon:'#db2777', hardware:'#d97706', pets:'#ea580c', gifts:'#0891b2', default:'#FF3008' }

export default function LandingPage() {
  const [mounted,    setMounted]    = useState(false)
  const [dark,       setDark]       = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [stats,      setStats]      = useState({ shops:0, orders:0, rating:'4.8' })
  const [cityName,   setCityName]   = useState('')
  const [areaShops,  setAreaShops]  = useState(-1)
  const [locStatus,  setLocStatus]  = useState<'idle'|'loading'|'done'|'denied'>('idle')
  const [liveShops,  setLiveShops]  = useState<any[]>([])
  const [products,   setProducts]   = useState<any[]>([])
  const [heroShop,   setHeroShop]   = useState<any>(null)
  const [heroProds,  setHeroProds]  = useState<any[]>([])

  // ── Auth check — redirect logged-in users away from landing page ──
  // Runs before render. PWA opens at / → this bounces them to dashboard instantly.
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return  // not logged in, show landing page
      // Logged in — fetch role and redirect
      const role = session.user.user_metadata?.role || ''
      if (role) {
        const roleMap: Record<string,string> = {
          customer: '/dashboard/customer',
          business: '/dashboard/business',
          shopkeeper: '/dashboard/business',
          delivery: '/dashboard/delivery',
          delivery_partner: '/dashboard/delivery',
          admin: '/dashboard/admin',
        }
        window.location.replace(roleMap[role] || '/dashboard/customer')
        return
      }
      // No role in metadata — check DB
      sb.from('users').select('role').eq('id', session.user.id).single()
        .then(({ data }) => {
          const r = data?.role || 'customer'
          const roleMap: Record<string,string> = {
            customer:         '/dashboard/customer',
            business:         '/dashboard/business',
            shopkeeper:       '/dashboard/business',
            delivery:         '/dashboard/delivery',
            delivery_partner: '/dashboard/delivery',
            admin:            '/dashboard/admin',
          }
          window.location.replace(roleMap[r] || '/dashboard/customer')
        })
    })
  }, [])

  // ── Init theme (hydration-safe) ───────────────────────────
  useEffect(() => { setDark(window.matchMedia('(prefers-color-scheme: dark)').matches); setMounted(true) }, [])

  // ── Data + location ───────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive:true })
    const sb = createClient()

    Promise.all([
      sb.from('shops').select('*', { count:'exact', head:true }).eq('is_active', true),
      sb.from('orders').select('*', { count:'exact', head:true }),
      sb.from('shops').select('rating').eq('is_active', true),
    ]).then(([{ count:sc }, { count:oc }, { data:rd }]) => {
      const avg = rd?.length ? (rd.reduce((s:number,r:any)=>s+(r.rating||4.5),0)/rd.length).toFixed(1) : '4.8'
      setStats({ shops:sc??0, orders:oc??0, rating:avg })
    })

    sb.from('shops')
      .select('id, name, category_name, area, image_url, banner_url, rating, is_open, avg_delivery_time')
      .eq('is_active', true).order('rating', { ascending:false }).limit(6)
      .then(({ data }) => {
        if (data?.length) {
          setLiveShops(data)
          const first = data.find(s => s.is_open) || data[0]
          setHeroShop(first)
          if (first) sb.from('products').select('id, name, price, image_url, is_available')
            .eq('shop_id', first.id).eq('is_available', true).limit(3)
            .then(({ data:prods }) => { if (prods?.length) setHeroProds(prods) })
        }
      })

    sb.from('products')
      .select('id, name, price, original_price, image_url, shop_id, shop:shops(name, area)')
      .eq('is_available', true).not('image_url', 'is', null)
      .order('created_at', { ascending:false }).limit(8)
      .then(({ data }) => { if (data?.length) setProducts(data) })

    setLocStatus('loading')
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        setLocStatus('done')
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&zoom=10`, { headers:{'Accept-Language':'en'} })
          const d = await r.json()
          setCityName(d.address?.city || d.address?.town || d.address?.village || '')
        } catch {}
        const { data } = await sb.from('shops').select('id').eq('is_active', true).limit(20)
        setAreaShops(data?.length ?? 0)
      },
      () => {
        setLocStatus('denied')
        sb.from('shops').select('id').eq('is_active', true).limit(20).then(({ data }) => setAreaShops(data?.length ?? 0))
      },
      { timeout:8000, maximumAge:300000 }
    )
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Theme tokens ──────────────────────────────────────────
  const t = dark ? {
    bg:'#060606', bg2:'#0c0c0c', bg3:'#1a1a1a', card:'#111111',
    border:'rgba(255,255,255,.08)', text:'#f0f0f0', text2:'rgba(255,255,255,.5)', text3:'rgba(255,255,255,.22)',
    nav:'rgba(6,6,6,.88)', input:'rgba(255,255,255,.06)',
    bentoCard:'#111111', bentoBorder:'rgba(255,255,255,.08)', bentoShadow:'none',
    cardShadow:'none',
  } : {
    bg:'#fafaf9', bg2:'#f0efec', bg3:'#e5e4e0', card:'#ffffff',
    border:'rgba(0,0,0,.12)', text:'#0c0c0c', text2:'rgba(0,0,0,.52)', text3:'rgba(0,0,0,.24)',
    nav:'rgba(250,250,249,.92)', input:'rgba(0,0,0,.04)',
    bentoCard:'#ffffff', bentoBorder:'rgba(0,0,0,.12)', bentoShadow:'0 2px 12px rgba(0,0,0,.07)',
    cardShadow:'0 2px 20px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.05)',
  }

  const getCatColor = (cat:string) => { const k = Object.keys(CAT_MAP).find(k => cat?.toLowerCase().includes(k)); return k ? CAT_MAP[k] : CAT_MAP.default }

  // Prevent hydration mismatch — render neutral shell on server, real UI on client
  if (!mounted) {
    return (
      <div style={{ minHeight:'100vh', background:'#fafaf9', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" />
      </div>
    )
  }

  return (
    <div suppressHydrationWarning style={{ minHeight:'100vh', background:t.bg, color:t.text, fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        a{text-decoration:none;color:inherit;}
        button{cursor:pointer;font-family:inherit;border:none;background:none;}
        img{max-width:100%;display:block;}
        .syne{font-weight:900;}
        .tg{background:linear-gradient(135deg,#FF3008 0%,#ff6b3d 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

        .lift{transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s;}
        .lift:hover{transform:translateY(-5px);}
        .press:active{transform:scale(.96)!important;}
        .btn-p{transition:transform .18s,box-shadow .18s;}
        .btn-p:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(255,48,8,.42)!important;}
        .ghost{transition:all .2s;}
        .ghost:hover{border-color:#FF3008!important;color:#FF3008!important;}
        .iz:hover{transform:scale(1.05);}
        .iz{transition:transform .4s cubic-bezier(.22,1,.36,1);}

        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.75)}}
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        .float{animation:floatY 5s ease-in-out infinite;}
        .fu{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) both;}
        .pulse{animation:pulse 2.2s ease-in-out infinite;}
        .sk{background:linear-gradient(90deg,rgba(128,128,128,.06) 25%,rgba(128,128,128,.14) 50%,rgba(128,128,128,.06) 75%);background-size:600px 100%;animation:shimmer 1.6s infinite;}

        .hero-g{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center;}
        .stat-g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center;}
        .bento{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;}
        .b1{grid-column:1/6;grid-row:1/3;}
        .b2{grid-column:6/10;grid-row:1/2;}
        .b3{grid-column:10/13;grid-row:1/2;}
        .b4{grid-column:6/10;grid-row:2/3;}
        .b5{grid-column:10/13;grid-row:2/3;}
        .cat-g{display:grid;grid-template-columns:repeat(8,1fr);gap:14px;}
        .shops-g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
        .prod-g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
        .step-g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
        .part-g{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
        .foot-g{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;}

        @media(max-width:900px){
          .desk{display:none!important;}
          .hero-g{grid-template-columns:1fr!important;gap:24px!important;}
          .hero-right{display:none!important;}
          .stat-g{grid-template-columns:repeat(2,1fr)!important;}
          .bento{grid-template-columns:1fr 1fr!important;grid-template-rows:auto auto auto!important;gap:12px!important;}
          .b1{grid-column:1/-1!important;grid-row:auto!important;min-height:320px;}
          .b2,.b3{grid-column:span 1!important;grid-row:auto!important;min-height:220px;}
          .b4,.b5{grid-column:span 1!important;grid-row:auto!important;min-height:220px;}
          .cat-g{grid-template-columns:repeat(4,1fr)!important;gap:10px!important;}
          .shops-g{grid-template-columns:repeat(2,1fr)!important;gap:14px!important;}
          .prod-g{grid-template-columns:repeat(2,1fr)!important;gap:14px!important;}
          .step-g{grid-template-columns:1fr!important;}
          .part-g{grid-template-columns:1fr!important;}
          .foot-g{grid-template-columns:1fr 1fr!important;gap:24px!important;}
        }

        @media(max-width:520px){
          .hero-h1{font-size:36px!important;}
          .bento{grid-template-columns:1fr!important;grid-template-rows:auto!important;gap:12px!important;}
          .b1,.b2,.b3,.b4,.b5{grid-column:1/-1!important;grid-row:auto!important;min-height:200px!important;}
          .b1{min-height:300px!important;}
          .cat-g{grid-template-columns:repeat(4,1fr)!important;gap:8px!important;}
          .cl{font-size:10px!important;}
          .stat-g{grid-template-columns:repeat(2,1fr)!important;}
          .shops-g{grid-template-columns:1fr!important;}
          .prod-g{grid-template-columns:repeat(2,1fr)!important;gap:10px!important;}
          .foot-g{grid-template-columns:1fr!important;gap:20px!important;}
          .sec{padding-left:16px!important;padding-right:16px!important;}
        }

        @media(min-width:901px){.mob{display:none!important;}}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-thumb{background:rgba(128,128,128,.2);border-radius:3px;}
        /* ── Mission pillars ── */
        .pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        @media(max-width:900px){.pillars{grid-template-columns:repeat(3,1fr)!important;gap:14px!important;}}
        @media(max-width:520px){.pillars{grid-template-columns:1fr!important;}}

        /* ── Big platform bento ── */
        .pbento{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;}
        .pb1{grid-column:1/8;grid-row:1;min-height:340px;}
        .pb2{grid-column:8/13;grid-row:1;min-height:340px;}
        .pb3{grid-column:1/5;grid-row:2;min-height:220px;}
        .pb4{grid-column:5/9;grid-row:2;min-height:220px;}
        .pb5{grid-column:9/13;grid-row:2;min-height:220px;}
        @media(max-width:900px){
          .pb1,.pb2{grid-column:1/-1!important;min-height:280px!important;}
          .pb3,.pb4,.pb5{grid-column:span 6!important;min-height:200px!important;}
        }
        @media(max-width:520px){
          .pb3,.pb4,.pb5{grid-column:1/-1!important;}
        }

        /* ── marquee ── */
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .marquee-inner{display:flex;gap:32px;animation:marquee 22s linear infinite;width:max-content;}
        .marquee-inner:hover{animation-play-state:paused;}

      `}} />

      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, background:scrolled?t.nav:'transparent', backdropFilter:scrolled?'blur(24px) saturate(1.3)':'none', WebkitBackdropFilter:scrolled?'blur(24px) saturate(1.3)':'none', borderBottom:scrolled?`1px solid ${t.border}`:'1px solid transparent', transition:'all .35s' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
            <Logo />
            <span className="syne" style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.04em' }}>welokl</span>
          </Link>
          <div className="desk" style={{ display:'flex', alignItems:'center', gap:28 }}>
            {[['Browse shops','/stores'],['Partner','/become-partner'],['Login','/auth/login']].map(([l,h]) => (
              <Link key={l} href={h} style={{ fontSize:14, fontWeight:600, color:t.text2, transition:'color .15s' }} onMouseEnter={e=>e.currentTarget.style.color='#FF3008'} onMouseLeave={e=>e.currentTarget.style.color=t.text2}>{l}</Link>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setDark(!dark)} style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:t.text2, background:t.input, border:`1px solid ${t.border}`, transition:'all .2s' }}>
              {dark ? <IcoSun /> : <IcoMoon />}
            </button>
            <Link href="/auth/signup" className="btn-p press" style={{ padding:'9px 22px', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:14, borderRadius:11, boxShadow:'0 4px 18px rgba(255,48,8,.3)', display:'inline-flex', alignItems:'center', gap:6 }}>
              Get started <IcoArrow />
            </Link>
            <button className="mob" onClick={() => setMenuOpen(!menuOpen)} style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:t.text, background:t.input, border:`1px solid ${t.border}` }}>
              {menuOpen ? <IcoClose /> : <IcoMenu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="mob" style={{ background:t.card, borderTop:`1px solid ${t.border}`, padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:2 }}>
            {[['Browse shops','/stores'],['Partner with us','/become-partner'],['Sign in','/auth/login'],['Get started','/auth/signup']].map(([l,h]) => (
              <Link key={l} href={h} onClick={() => setMenuOpen(false)} style={{ padding:'12px 14px', fontSize:15, fontWeight:600, color:t.text, borderRadius:11 }}>{l}</Link>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ paddingTop:64, position:'relative', overflow:'hidden' }}>
        {/* Ambient blobs */}
        <div style={{ position:'absolute', top:'-10%', right:'-5%', width:'50vw', height:'50vw', maxWidth:700, maxHeight:700, borderRadius:'50%', background:dark?'radial-gradient(circle,rgba(255,48,8,.08),transparent 70%)':'radial-gradient(circle,rgba(255,48,8,.05),transparent 70%)', pointerEvents:'none' }} />
        <div className="hero-g sec" style={{ maxWidth:1200, margin:'0 auto', padding:'60px 20px 72px' }}>

          {/* Left copy */}
          <div className="fu">
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:dark?'rgba(255,48,8,.1)':'rgba(255,48,8,.06)', border:'1px solid rgba(255,48,8,.15)', borderRadius:999, padding:'6px 16px', marginBottom:28 }}>
              <span className="pulse" style={{ width:7, height:7, borderRadius:'50%', background:'#FF3008', display:'block', flexShrink:0 }} />
              <span style={{ fontSize:12.5, fontWeight:700, color:'#FF3008' }}>
                {locStatus === 'loading' ? 'Detecting your location...' :
                 locStatus === 'done' && cityName ? `Delivering in ${cityName}` :
                 stats.shops > 0 ? `${stats.shops} shops live now` : 'Hyperlocal delivery near you'}
              </span>
            </div>

            <h1 className="syne hero-h1" style={{ fontSize:'clamp(42px,5.5vw,68px)', fontWeight:800, lineHeight:.98, letterSpacing:'-0.05em', marginBottom:22 }}>
              Everything local,<br />
              <span className="tg">delivered</span><br />
              in 30 min.
            </h1>

            <p style={{ fontSize:17, color:t.text2, lineHeight:1.7, marginBottom:32, maxWidth:440 }}>
              Food, groceries, medicine and more — from real shops in your neighbourhood, delivered by verified local riders you can track live.
            </p>

            {locStatus === 'done' && areaShops === 0 && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:dark?'rgba(217,119,6,.08)':'#fffbeb', border:'1px solid rgba(217,119,6,.2)', borderRadius:13, padding:'10px 18px', marginBottom:22 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#d97706' }}>Not in {cityName||'your area'} yet — expanding soon.</span>
                <Link href="/auth/signup" style={{ fontSize:13, fontWeight:800, color:'#FF3008' }}>Get notified</Link>
              </div>
            )}
            {locStatus === 'done' && areaShops > 0 && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:dark?'rgba(22,163,74,.08)':'#f0fdf4', border:'1px solid rgba(22,163,74,.18)', borderRadius:13, padding:'10px 18px', marginBottom:22, color:'#16a34a' }}>
                <IcoCheck />
                <span style={{ fontSize:13, fontWeight:700 }}>{areaShops} shop{areaShops>1?'s':''} delivering in {cityName||'your area'} right now</span>
              </div>
            )}

            <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:40 }}>
              <Link href="/dashboard/customer" className="btn-p press" style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'15px 30px', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:15, borderRadius:14, boxShadow:'0 10px 30px rgba(255,48,8,.35)' }}>
                Order now <IcoArrow />
              </Link>
              <Link href="/stores" className="ghost press" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'15px 24px', background:'transparent', color:t.text, fontWeight:700, fontSize:15, borderRadius:14, border:`1.5px solid ${t.border}` }}>
                Browse shops
              </Link>
            </div>

            <div style={{ display:'flex', flexWrap:'wrap', gap:20 }}>
              {[
                { ico:<IcoStar />,  c:'#d97706', l:`${stats.rating} avg rating` },
                { ico:<IcoClock />, c:'#2563eb', l:'Under 30 min' },
                { ico:<IcoShield />,c:'#16a34a', l:'Verified riders' },
              ].map((b,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7, color:b.c }}>
                  {b.ico}<span style={{ fontSize:13, fontWeight:600, color:t.text2 }}>{b.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — hero card */}
          <div className="hero-right fu" style={{ position:'relative', height:520, display:'flex', alignItems:'center', justifyContent:'center', animationDelay:'.15s' }}>
            <div style={{ position:'absolute', width:380, height:380, borderRadius:'50%', background:dark?'radial-gradient(circle,rgba(255,48,8,.12),transparent 70%)':'radial-gradient(circle,rgba(255,48,8,.06),transparent 70%)', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} />

            {heroShop ? (
              <div className="float" style={{ width:300, background:t.card, borderRadius:26, overflow:'hidden', boxShadow:dark?'0 32px 80px rgba(0,0,0,.6)':'0 24px 64px rgba(0,0,0,.12)', border:`1px solid ${t.border}`, position:'relative', zIndex:2 }}>
                <div style={{ height:105, background:heroShop.banner_url?'none':`linear-gradient(135deg,${getCatColor(heroShop.category_name||'')}22,${getCatColor(heroShop.category_name||'')}44)`, position:'relative', overflow:'hidden' }}>
                  {heroShop.banner_url && <img src={heroShop.banner_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => (e.currentTarget.style.display='none')} />}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.3),transparent)' }} />
                  <div style={{ position:'absolute', bottom:-20, left:18, width:46, height:46, borderRadius:14, background:t.card, border:`3px solid ${t.card}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(0,0,0,.12)' }}>
                    {heroShop.image_url
                      ? <img src={heroShop.image_url} alt={heroShop.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => (e.currentTarget.style.display='none')} />
                      : <span style={{ color:getCatColor(heroShop.category_name||''), fontSize:20 }}><IcoGrocery size={22} /></span>
                    }
                  </div>
                  <div style={{ position:'absolute', top:10, right:12, display:'flex', alignItems:'center', gap:5, background:heroShop.is_open?'rgba(22,163,74,.9)':'rgba(100,100,100,.8)', borderRadius:999, padding:'4px 10px' }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', display:'block' }} />
                    <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{heroShop.is_open ? 'Open' : 'Closed'}</span>
                  </div>
                </div>
                <div style={{ padding:'26px 18px 18px' }}>
                  <p style={{ fontWeight:800, fontSize:15, color:t.text, marginBottom:3 }}>{heroShop.name}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:3, color:'#d97706', fontSize:12, fontWeight:700 }}><IcoStar /> {(heroShop.rating||4.5).toFixed(1)}</span>
                    <span style={{ color:t.text3 }}>·</span>
                    <span style={{ display:'flex', alignItems:'center', gap:3, color:t.text2, fontSize:12 }}><IcoClock /> {heroShop.avg_delivery_time||30} min</span>
                    {heroShop.area && <><span style={{ color:t.text3 }}>·</span><span style={{ display:'flex', alignItems:'center', gap:3, color:t.text2, fontSize:12 }}><IcoPin /> {heroShop.area}</span></>}
                  </div>
                  {heroProds.length === 0
                    ? [1,2,3].map(i => <div key={i} className="sk" style={{ height:40, borderRadius:11, marginBottom:8 }} />)
                    : heroProds.map((p:any, i:number) => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:i<heroProds.length-1?`1px solid ${t.border}`:'none' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width:34, height:34, borderRadius:9, objectFit:'cover', background:t.bg3 }} onError={e => (e.currentTarget.style.display='none')} /> : <div style={{ width:34, height:34, borderRadius:9, background:t.bg3 }} />}
                        <span style={{ fontSize:13, fontWeight:600, color:t.text, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontWeight:800, fontSize:13, color:t.text }}>&#8377;{p.price}</span>
                        <div style={{ width:24, height:24, borderRadius:8, background:'#FF3008', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <svg viewBox="0 0 10 10" fill="none" width={9} height={9}><path d="M5 2v6M2 5h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Link href={heroShop?`/stores/${heroShop.id}`:'/stores'} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:16, padding:'13px 16px', background:'#FF3008', borderRadius:14 }}>
                    <span style={{ color:'#fff', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}><IcoBag /> View full shop</span>
                    <span style={{ color:'rgba(255,255,255,.8)' }}><IcoArrow /></span>
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ width:300, background:t.card, borderRadius:26, overflow:'hidden', border:`1px solid ${t.border}`, position:'relative', zIndex:2 }}>
                <div className="sk" style={{ height:105 }} />
                <div style={{ padding:'26px 18px 18px' }}>{[1,2,3,4].map(i => <div key={i} className="sk" style={{ height:i===1?16:40, borderRadius:9, marginBottom:10, width:i===1?'60%':'100%' }} />)}</div>
              </div>
            )}

            {/* Float badges */}
            <div className="fu" style={{ position:'absolute', top:60, right:-4, background:t.card, borderRadius:16, padding:'11px 16px', boxShadow:dark?'0 12px 40px rgba(0,0,0,.5)':'0 8px 30px rgba(0,0,0,.08)', border:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:9, zIndex:3, animationDelay:'.4s' }}>
              <span className="pulse" style={{ width:9, height:9, borderRadius:'50%', background:'#16a34a', display:'block', flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:800, color:t.text }}>Rider nearby</span>
            </div>
            <div className="fu" style={{ position:'absolute', bottom:76, left:-8, background:t.card, borderRadius:16, padding:'12px 18px', boxShadow:dark?'0 12px 40px rgba(0,0,0,.5)':'0 8px 30px rgba(0,0,0,.08)', border:`1px solid ${t.border}`, zIndex:3, animationDelay:'.55s' }}>
              <p style={{ fontSize:10, color:t.text3, fontWeight:600, marginBottom:3, textTransform:'uppercase', letterSpacing:'.06em' }}>ETA</p>
              <p style={{ fontSize:24, fontWeight:900, color:'#FF3008', lineHeight:1, letterSpacing:'-0.04em' }}>{heroShop?.avg_delivery_time || 30}<span style={{ fontSize:13, fontWeight:700 }}> min</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section style={{ background:'#0a0a0a', padding:'42px 20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(rgba(255,48,8,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,48,8,.03) 1px, transparent 1px)', backgroundSize:'60px 60px', pointerEvents:'none' }} />
        <div className="stat-g" style={{ maxWidth:1100, margin:'0 auto', position:'relative' }}>
          {[
            { v:stats.shops>0?`${stats.shops}+`:'\u2014', l:'Active shops' },
            { v:'<30', l:'Min delivery' },
            { v:stats.rating, l:'Avg shop rating' },
            { v:stats.orders>999?`${(stats.orders/1000).toFixed(1)}k+`:stats.orders>0?`${stats.orders}+`:'\u2014', l:'Orders delivered' },
          ].map(s => (
            <div key={s.l} style={{ padding:'8px 0' }}>
              <p className="syne" style={{ fontWeight:800, fontSize:'clamp(28px,5vw,42px)', color:'#FF3008', letterSpacing:'-0.06em', lineHeight:1 }}>{s.v}</p>
              <p style={{ fontSize:'clamp(10px,1.5vw,12px)', fontWeight:600, color:'rgba(255,255,255,.3)', marginTop:8, textTransform:'uppercase', letterSpacing:'.08em' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── MISSION ──────────────────────────────────────────── */}
      <section className="sec" style={{ padding:'96px 20px', background:t.bg2, borderBottom:`1px solid ${t.border}` }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>

          {/* Tag + headline */}
          <div style={{ maxWidth:760, marginBottom:72 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:dark?'rgba(255,48,8,.1)':'rgba(255,48,8,.06)', border:'1px solid rgba(255,48,8,.15)', borderRadius:999, padding:'6px 18px', marginBottom:28 }}>
              <span className="pulse" style={{ width:7, height:7, borderRadius:'50%', background:'#FF3008', display:'block', flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:700, color:'#FF3008', letterSpacing:'.06em', textTransform:'uppercase' }}>Our Mission</span>
            </div>
            <h2 className="syne" style={{ fontSize:'clamp(30px,5vw,56px)', fontWeight:900, color:t.text, letterSpacing:'-0.055em', lineHeight:1.06, marginBottom:28 }}>
              We believe your corner shop<br />
              shouldn't lose to a warehouse<br />
              <span className="tg">500 km away.</span>
            </h2>
            <p style={{ fontSize:'clamp(15px,1.8vw,18px)', color:t.text2, lineHeight:1.8, maxWidth:580 }}>
              Welokl is built on a simple idea: local shops are the backbone of every neighbourhood. We connect real stores — the pharmacy around the corner, the daily tiffin, the family grocery — directly to the people who need them. No middlemen. No dark kitchens. Just your community, closer.
            </p>
          </div>

          {/* Three pillars */}
          <div className="pillars">
            {[
              {
                icon: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
                color:'#FF3008', bg:dark?'rgba(255,48,8,.1)':'rgba(255,48,8,.06)',
                label:'Local First',
                desc:'We partner only with physical shops in your city. Every product is stocked on a real shelf, by a real person you could walk in and meet.',
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
                color:'#2563eb', bg:dark?'rgba(37,99,235,.1)':'rgba(37,99,235,.06)',
                label:'People Powered',
                desc:'Every rider is locally verified before their first delivery. Every shopkeeper is your neighbour. Every delivery is a person, not a drone.',
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
                color:'#16a34a', bg:dark?'rgba(22,163,74,.1)':'rgba(22,163,74,.06)',
                label:'Always Improving',
                desc:'We started with one city. We are growing to every town that has a shop worth supporting. Built in India, for India, with every zip code in mind.',
              },
            ].map((p,i) => (
              <div key={i} className="lift" style={{ background:t.card, borderRadius:24, padding:'clamp(24px,2.5vw,32px)', border:`2px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`, boxShadow:dark?'none':'0 4px 24px rgba(0,0,0,.07)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:p.bg, filter:'blur(30px)', opacity:.8, pointerEvents:'none' }} />
                <div style={{ width:48, height:48, borderRadius:16, background:p.bg, display:'flex', alignItems:'center', justifyContent:'center', color:p.color, marginBottom:22, position:'relative' }}>
                  {p.icon}
                </div>
                <h3 style={{ fontWeight:900, fontSize:'clamp(16px,1.8vw,20px)', color:t.text, letterSpacing:'-0.03em', marginBottom:12 }}>{p.label}</h3>
                <p style={{ fontSize:'clamp(13px,1.3vw,14px)', color:t.text2, lineHeight:1.75 }}>{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Marquee of values / commitments */}
          <div style={{ marginTop:64, overflow:'hidden', position:'relative' }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:80, background:`linear-gradient(to right,${t.bg},transparent)`, zIndex:2, pointerEvents:'none' }} />
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:`linear-gradient(to left,${t.bg},transparent)`, zIndex:2, pointerEvents:'none' }} />
            <div className="marquee-inner">
              {[
                '🏪 Real local shops only',
                '🛵 Verified delivery partners',
                '📍 Hyperlocal, always within 5 km',
                '⚡ Under 30 minutes, guaranteed',
                '💳 UPI · COD · Wallet payments',
                '🔁 Subscribe for daily deliveries',
                '🌱 Supporting local livelihoods',
                '📲 Live GPS order tracking',
                '🏪 Real local shops only',
                '🛵 Verified delivery partners',
                '📍 Hyperlocal, always within 5 km',
                '⚡ Under 30 minutes, guaranteed',
                '💳 UPI · COD · Wallet payments',
                '🔁 Subscribe for daily deliveries',
                '🌱 Supporting local livelihoods',
                '📲 Live GPS order tracking',
              ].map((item,i) => (
                <span key={i} style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:10, padding:'12px 22px', borderRadius:999, background:t.card, border:`1px solid ${t.border}`, fontSize:13.5, fontWeight:600, color:t.text2, whiteSpace:'nowrap' }}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── BENTO GRID ───────────────────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px', background:t.bg2 }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:12 }}>Why Welokl</p>
            <h2 className="syne" style={{ fontSize:'clamp(26px,4.5vw,44px)', fontWeight:800, color:t.text, letterSpacing:'-0.045em', marginBottom:12 }}>Built for your neighbourhood</h2>
            <p style={{ fontSize:'clamp(14px,2vw,16px)', color:t.text2, maxWidth:460, margin:'0 auto', lineHeight:1.65 }}>Everything you need, from shops you already trust — live tracking, real products, no markup.</p>
          </div>

          <div className="bento" style={{ gridTemplateRows:'250px 250px' }}>
            {/* B1 — Live tracking (RED — always visible) */}
            <div className="b1" style={{ background:'linear-gradient(145deg,#FF3008 0%,#e02800 100%)', borderRadius:24, padding:'clamp(24px,3vw,36px)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ position:'absolute', top:-60, right:-60, width:280, height:280, borderRadius:'50%', background:'rgba(255,255,255,.07)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:-40, left:-30, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ width:48, height:48, borderRadius:16, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                  <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><circle cx="12" cy="12" r="3" fill="white"/><circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.8" strokeDasharray="3 2"/><circle cx="12" cy="12" r="10.5" stroke="rgba(255,255,255,.3)" strokeWidth="1"/></svg>
                </div>
                <h3 className="syne" style={{ fontWeight:800, fontSize:'clamp(22px,3vw,30px)', color:'#fff', letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:10 }}>Live GPS<br />tracking</h3>
                <p style={{ fontSize:'clamp(13px,1.4vw,14px)', color:'rgba(255,255,255,.75)', lineHeight:1.7, maxWidth:280 }}>Watch your rider in real time. Know exactly when your order arrives.</p>
              </div>
              <div style={{ background:'rgba(255,255,255,.13)', borderRadius:16, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, position:'relative', zIndex:1 }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg viewBox="0 0 16 16" fill="none" width={14} height={14}><circle cx="8" cy="8" r="3" fill="white"/></svg>
                  </div>
                  <span style={{ position:'absolute', top:-2, right:-2, width:10, height:10, borderRadius:'50%', background:'#4ade80', border:'2px solid #FF3008' }} />
                </div>
                <div>
                  <p style={{ fontSize:12, fontWeight:800, color:'#fff' }}>Rider is 1.2 km away</p>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:2 }}>Arriving in ~8 min</p>
                </div>
              </div>
            </div>

            {/* B2 — 30 min */}
            <div className="b2" style={{ background:t.bentoCard, borderRadius:24, padding:'clamp(22px,2.5vw,30px)', border:`1.5px solid ${t.bentoBorder}`, boxShadow:t.bentoShadow, display:'flex', flexDirection:'column', justifyContent:'space-between', overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', right:-15, top:-15, width:110, height:110, borderRadius:'50%', background:'rgba(255,48,8,.06)', pointerEvents:'none' }} />
              <div style={{ width:42, height:42, borderRadius:14, background:'rgba(255,48,8,.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008' }}><IcoClock /></div>
              <div>
                <p className="syne" style={{ fontWeight:800, fontSize:'clamp(34px,4vw,48px)', color:'#FF3008', letterSpacing:'-0.06em', lineHeight:1 }}>30<span style={{ fontSize:'clamp(16px,2vw,22px)', fontWeight:700 }}>min</span></p>
                <p style={{ fontWeight:700, fontSize:14, color:t.text, marginTop:6 }}>Average delivery</p>
                <p style={{ fontSize:12.5, color:t.text2, marginTop:4, lineHeight:1.55 }}>From local shops within 5 km</p>
              </div>
            </div>

            {/* B3 — Verified riders */}
            <div className="b3" style={{ background:t.bentoCard, borderRadius:24, padding:'clamp(22px,2.5vw,30px)', border:`1.5px solid ${t.bentoBorder}`, boxShadow:t.bentoShadow, display:'flex', flexDirection:'column', justifyContent:'space-between', overflow:'hidden' }}>
              <div style={{ width:42, height:42, borderRadius:14, background:'rgba(22,163,74,.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#16a34a' }}><IcoShield /></div>
              <div>
                <p style={{ fontWeight:900, fontSize:'clamp(16px,1.8vw,19px)', color:t.text, letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:6 }}>Verified<br />local riders</p>
                <p style={{ fontSize:12.5, color:t.text2, lineHeight:1.55 }}>Every rider is ID-verified before their first delivery.</p>
              </div>
            </div>

            {/* B4 — Local economy (always dark) */}
            <div className="b4" style={{ background:'linear-gradient(145deg,#111 0%,#0a0a0a 100%)', borderRadius:24, padding:'clamp(22px,2.5vw,30px)', border:'1.5px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', justifyContent:'space-between', overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', bottom:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,48,8,.08)', pointerEvents:'none' }} />
              <p style={{ fontWeight:700, fontSize:11, color:'rgba(255,255,255,.3)', letterSpacing:'.1em', textTransform:'uppercase' }}>Local economy</p>
              <div>
                <p className="syne" style={{ fontWeight:800, fontSize:'clamp(30px,4vw,44px)', color:'#fff', letterSpacing:'-0.05em', lineHeight:1 }}>{stats.shops > 0 ? `${stats.shops}+` : '\u2014'}</p>
                <p style={{ fontWeight:700, fontSize:14, color:'rgba(255,255,255,.65)', marginTop:6 }}>Local shops onboarded</p>
                <p style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginTop:4, lineHeight:1.55 }}>Every order keeps money in your neighbourhood.</p>
              </div>
            </div>

            {/* B5 — Payment */}
            <div className="b5" style={{ background:dark?'rgba(255,48,8,.06)':'#fff7f5', border:'1.5px solid rgba(255,48,8,.18)', borderRadius:24, padding:'clamp(22px,2.5vw,30px)', display:'flex', flexDirection:'column', justifyContent:'space-between', overflow:'hidden' }}>
              <div style={{ width:42, height:42, borderRadius:14, background:'rgba(255,48,8,.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008' }}>
                <svg viewBox="0 0 22 22" fill="none" width={18} height={18}><rect x="2" y="5" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M2 9h18" stroke="currentColor" strokeWidth="1.8"/><path d="M6 14h3M13 14h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p style={{ fontWeight:900, fontSize:'clamp(15px,1.6vw,17px)', color:t.text, letterSpacing:'-0.02em', lineHeight:1.25, marginBottom:6 }}>UPI · Card<br />Cash on delivery</p>
                <p style={{ fontSize:12, color:t.text2, lineHeight:1.55 }}>Pay however works for you.</p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ── PLATFORM FEATURES GRID ───────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px 96px', background:t.bg2 }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:12 }}>Platform</p>
            <h2 className="syne" style={{ fontSize:'clamp(26px,4.5vw,44px)', fontWeight:800, color:t.text, letterSpacing:'-0.045em', marginBottom:12 }}>One app. Everything local.</h2>
            <p style={{ fontSize:'clamp(14px,2vw,16px)', color:t.text2, maxWidth:460, margin:'0 auto', lineHeight:1.65 }}>From a single daily delivery to full subscription plans — Welokl handles everything between your shop and your door.</p>
          </div>

          <div className="pbento">

            {/* PB1 — big left: "The full picture" dark card */}
            <div className="pb1" style={{ background:'linear-gradient(145deg,#0d0d0d 0%,#111 100%)', borderRadius:28, padding:'clamp(28px,3vw,42px)', border:'1.5px solid rgba(255,255,255,.07)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              {/* Ambient circles */}
              <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,48,8,.12),transparent 70%)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:-60, left:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(37,99,235,.08),transparent 70%)', pointerEvents:'none' }} />

              <div style={{ position:'relative', zIndex:1 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.3)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:20 }}>What makes us different</p>
                <h3 className="syne" style={{ fontWeight:800, fontSize:'clamp(26px,3.2vw,38px)', color:'#fff', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:18 }}>
                  Hyper-local.<br />
                  <span style={{ background:'linear-gradient(135deg,#FF3008,#ff7a3d)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Not hyper-corporate.</span>
                </h3>
                <p style={{ fontSize:'clamp(13px,1.4vw,15px)', color:'rgba(255,255,255,.5)', lineHeight:1.75, maxWidth:360 }}>
                  Every feature we build starts with one question: does this help a local shop owner or a neighbourhood rider make a living? That is the only roadmap that matters.
                </p>
              </div>

              {/* Feature chips */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, position:'relative', zIndex:1 }}>
                {[
                  { label:'Real-time GPS', color:'#FF3008' },
                  { label:'Daily subscriptions', color:'#d97706' },
                  { label:'Wallet & rewards', color:'#16a34a' },
                  { label:'Live order feed', color:'#2563eb' },
                  { label:'Verified riders', color:'#7c3aed' },
                  { label:'UPI + COD', color:'#0891b2' },
                ].map(chip => (
                  <span key={chip.label} style={{ fontSize:12, fontWeight:700, padding:'7px 16px', borderRadius:999, background:`${chip.color}18`, color:chip.color, border:`1px solid ${chip.color}30`, whiteSpace:'nowrap' }}>{chip.label}</span>
                ))}
              </div>
            </div>

            {/* PB2 — right top: Subscriptions */}
            <div className="pb2" style={{ background:'linear-gradient(145deg,#78350f 0%,#431407 100%)', borderRadius:28, padding:'clamp(26px,3vw,38px)', border:'1.5px solid rgba(251,191,36,.12)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ position:'absolute', top:-30, right:-30, width:160, height:160, borderRadius:'50%', background:'rgba(251,191,36,.07)', pointerEvents:'none' }} />
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ width:48, height:48, borderRadius:16, background:'rgba(251,191,36,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22 }}>
                  <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M12 2v20M2 12h20" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/><path d="M17 7A5 5 0 007 7M7 17a5 5 0 0010 0" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>
                <h3 className="syne" style={{ fontWeight:800, fontSize:'clamp(20px,2.5vw,26px)', color:'#fff', letterSpacing:'-0.03em', marginBottom:10 }}>Subscribe once,<br />receive daily.</h3>
                <p style={{ fontSize:13, color:'rgba(255,255,255,.5)', lineHeight:1.65, marginBottom:24 }}>Set up daily milk, eggs, tiffin or groceries from your local shop. They deliver. You never think about it again.</p>
              </div>
              {/* Mock subscription list */}
              <div style={{ display:'flex', flexDirection:'column', gap:10, position:'relative', zIndex:1 }}>
                {[
                  { name:'Morning Milk', time:'7:00 AM', price:'₹40/day', color:'#fbbf24' },
                  { name:'Tiffin Box', time:'12:30 PM', price:'₹80/day', color:'#fb923c' },
                  { name:'Evening Veggies', time:'5:00 PM', price:'₹60/day', color:'#4ade80' },
                ].map(sub => (
                  <div key={sub.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,.06)', borderRadius:14, padding:'11px 16px', border:'1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:sub.color, display:'block', flexShrink:0 }} />
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{sub.name}</p>
                        <p style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>{sub.time} daily</p>
                      </div>
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:sub.color }}>{sub.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PB3 — bottom left: Wallet & rewards */}
            <div className="pb3" style={{ background:'linear-gradient(145deg,#052e16 0%,#0a3622 100%)', borderRadius:28, padding:'clamp(24px,2.5vw,32px)', border:'1.5px solid rgba(74,222,128,.1)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ position:'absolute', bottom:-40, right:-30, width:140, height:140, borderRadius:'50%', background:'rgba(74,222,128,.06)', pointerEvents:'none' }} />
              <div style={{ width:44, height:44, borderRadius:14, background:'rgba(74,222,128,.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-3" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"/><path d="M16 12h5v4h-5a2 2 0 010-4z" stroke="#4ade80" strokeWidth="2"/></svg>
              </div>
              <div style={{ position:'relative', zIndex:1 }}>
                <p className="syne" style={{ fontWeight:900, fontSize:'clamp(28px,3vw,38px)', color:'#4ade80', letterSpacing:'-0.05em', lineHeight:1 }}>+₹20</p>
                <p style={{ fontWeight:800, fontSize:14, color:'rgba(255,255,255,.8)', marginTop:6, marginBottom:8 }}>On your first order</p>
                <p style={{ fontSize:12.5, color:'rgba(255,255,255,.4)', lineHeight:1.6 }}>Earn wallet credits with every order. Use them like cash at checkout. Refer a friend — get ₹30.</p>
              </div>
            </div>

            {/* PB4 — bottom mid: Rider community */}
            <div className="pb4" style={{ background:dark?'rgba(37,99,235,.1)':'#eff6ff', borderRadius:28, padding:'clamp(24px,2.5vw,32px)', border:'1.5px solid rgba(37,99,235,.22)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(37,99,235,.12)', pointerEvents:'none' }} />
              <div style={{ width:44, height:44, borderRadius:14, background:'rgba(37,99,235,.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563eb', marginBottom:20 }}>
                <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><circle cx="5.5" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="2"/><circle cx="18.5" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="2"/><path d="M8 17.5H3V6l3-3h5v5M15 17.5h-3.5M8 6h5l3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 10h5l1.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ position:'relative', zIndex:1 }}>
                <p className="syne" style={{ fontWeight:900, fontSize:'clamp(28px,3vw,38px)', color:'#2563eb', letterSpacing:'-0.05em', lineHeight:1 }}>₹500+</p>
                <p style={{ fontWeight:800, fontSize:14, color:t.text, marginTop:6, marginBottom:8 }}>Avg. daily rider earnings</p>
                <p style={{ fontSize:12.5, color:t.text2, lineHeight:1.6 }}>Work flexible hours. Get paid every week. Join our verified rider community and earn on your own terms.</p>
              </div>
            </div>

            {/* PB5 — bottom right: Zero markup promise */}
            <div className="pb5" style={{ background:dark?'rgba(255,48,8,.1)':'#fff0ed', borderRadius:28, padding:'clamp(24px,2.5vw,32px)', border:'1.5px solid rgba(255,48,8,.28)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ position:'absolute', bottom:-30, left:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,48,8,.06)', pointerEvents:'none' }} />
              <div style={{ width:44, height:44, borderRadius:14, background:'rgba(255,48,8,.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008', marginBottom:20 }}>
                <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ position:'relative', zIndex:1 }}>
                <p className="syne" style={{ fontWeight:900, fontSize:'clamp(26px,2.8vw,34px)', color:'#FF3008', letterSpacing:'-0.05em', lineHeight:1.1 }}>Shop price.<br />Always.</p>
                <p style={{ fontSize:12.5, color:t.text2, lineHeight:1.6, marginTop:10 }}>We charge commission to shops, never to customers. You pay exactly what the sticker says — zero delivery markup on the product price.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px', background:t.bg }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:12 }}>Categories</p>
            <h2 className="syne" style={{ fontSize:'clamp(24px,4.5vw,42px)', fontWeight:800, color:t.text, letterSpacing:'-0.045em', marginBottom:12 }}>Order anything, anytime</h2>
            <p style={{ fontSize:'clamp(14px,2vw,16px)', color:t.text2, maxWidth:420, margin:'0 auto', lineHeight:1.65 }}>From morning chai to midnight medicine — local shops have it all.</p>
          </div>
          <div className="cat-g">
            {CATS.map(({ id, label, Icon, color, bg }) => (
              <Link key={id} href={`/stores?category=${id}`} className="lift" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'22px 8px 18px', background:t.card, borderRadius:22, border:`1.5px solid ${t.border}`, boxShadow:t.cardShadow, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:60, height:60, borderRadius:'50%', background:bg, filter:'blur(20px)', opacity:.6, pointerEvents:'none' }} />
                <div style={{ width:54, height:54, borderRadius:17, background:bg, display:'flex', alignItems:'center', justifyContent:'center', color, position:'relative' }}>
                  <Icon />
                </div>
                <span className="cl" style={{ fontSize:12, fontWeight:700, color:t.text, textAlign:'center', lineHeight:1.3 }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE SHOPS GRID ──────────────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px', background:t.bg2 }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:36, flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span className="pulse" style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', display:'block' }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.08em' }}>Live now</span>
              </div>
              <h2 className="syne" style={{ fontSize:'clamp(24px,4vw,38px)', fontWeight:800, color:t.text, letterSpacing:'-0.04em' }}>Shops open near you</h2>
            </div>
            <Link href="/stores" className="ghost" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 20px', borderRadius:13, border:`1.5px solid ${t.border}`, fontSize:14, fontWeight:700, color:t.text }}>
              See all shops <IcoArrow />
            </Link>
          </div>
          <div className="shops-g">
            {liveShops.length > 0 ? liveShops.map(shop => {
              const color = getCatColor(shop.category_name||'')
              return (
                <Link key={shop.id} href={`/stores/${shop.id}`} className="lift" style={{ display:'block', background:t.card, borderRadius:22, overflow:'hidden', border:`1.5px solid ${t.border}`, boxShadow:t.cardShadow }}>
                  <div style={{ height:130, background:shop.banner_url?'none':`linear-gradient(135deg,${color}15,${color}30)`, position:'relative', overflow:'hidden' }}>
                    {shop.banner_url && <img src={shop.banner_url} alt="" className="iz" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => (e.currentTarget.style.display='none')} />}
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.3),transparent 60%)' }} />
                    <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:5, background:shop.is_open?'rgba(22,163,74,.88)':'rgba(60,60,60,.85)', borderRadius:999, padding:'4px 10px' }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', display:'block' }} />
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{shop.is_open ? 'Open' : 'Closed'}</span>
                    </div>
                    <div style={{ position:'absolute', bottom:-18, left:16, width:44, height:44, borderRadius:14, background:t.card, border:`3px solid ${t.card}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(0,0,0,.12)' }}>
                      {shop.image_url
                        ? <img src={shop.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => (e.currentTarget.style.display='none')} />
                        : <span style={{ color, fontSize:18 }}><IcoGrocery size={20} /></span>
                      }
                    </div>
                  </div>
                  <div style={{ padding:'26px 18px 18px' }}>
                    <p style={{ fontWeight:800, fontSize:15, color:t.text, marginBottom:6 }}>{shop.name}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      {shop.rating && <span style={{ display:'flex', alignItems:'center', gap:3, color:'#d97706', fontSize:12, fontWeight:700 }}><IcoStar /> {Number(shop.rating).toFixed(1)}</span>}
                      {shop.avg_delivery_time && <><span style={{ color:t.text3 }}>·</span><span style={{ display:'flex', alignItems:'center', gap:3, color:t.text2, fontSize:12, fontWeight:600 }}><IcoClock /> {shop.avg_delivery_time} min</span></>}
                      {shop.category_name && <><span style={{ color:t.text3 }}>·</span><span style={{ fontSize:11, fontWeight:600, color, background:`${color}15`, padding:'2px 8px', borderRadius:999 }}>{shop.category_name.split(' ')[0]}</span></>}
                    </div>
                  </div>
                </Link>
              )
            }) : [1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background:t.card, borderRadius:22, overflow:'hidden', border:`1.5px solid ${t.border}`, boxShadow:t.cardShadow }}>
                <div className="sk" style={{ height:130 }} />
                <div style={{ padding:'26px 18px 18px' }}>
                  <div className="sk" style={{ height:16, borderRadius:8, marginBottom:10, width:'60%' }} />
                  <div className="sk" style={{ height:12, borderRadius:6, width:'80%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS GRID ────────────────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px', background:t.bg }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:36, flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <IcoFlash />
                <span style={{ fontSize:12, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'.08em' }}>Available now</span>
              </div>
              <h2 className="syne" style={{ fontSize:'clamp(24px,4vw,38px)', fontWeight:800, color:t.text, letterSpacing:'-0.04em' }}>Fresh from local shops</h2>
            </div>
            <Link href="/stores" className="ghost" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 20px', borderRadius:13, border:`1.5px solid ${t.border}`, fontSize:14, fontWeight:700, color:t.text }}>
              Browse all <IcoArrow />
            </Link>
          </div>
          <div className="prod-g">
            {products.length > 0 ? products.map((p:any) => {
              const disc = p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0
              return (
                <div key={p.id} className="lift" style={{ background:t.card, borderRadius:20, overflow:'hidden', border:`1.5px solid ${t.border}`, boxShadow:t.cardShadow }}>
                  <div style={{ aspectRatio:'1/1', background:t.bg3, position:'relative', overflow:'hidden' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="iz" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => (e.currentTarget.style.display='none')} />
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:t.text3 }}><IcoGrocery size={40} /></div>
                    }
                    {disc > 0 && (
                      <div style={{ position:'absolute', top:10, left:10, background:'#FF3008', color:'#fff', fontSize:11, fontWeight:900, padding:'3px 9px', borderRadius:9 }}>-{disc}%</div>
                    )}
                  </div>
                  <div style={{ padding:'14px 16px 16px' }}>
                    <p style={{ fontWeight:700, fontSize:14, color:t.text, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                    {p.shop?.name && (
                      <p style={{ fontSize:11.5, color:t.text2, marginBottom:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.shop.name}{p.shop.area ? ` · ${p.shop.area}` : ''}</p>
                    )}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <span style={{ fontWeight:900, fontSize:16, color:t.text }}>&#8377;{p.price}</span>
                        {disc > 0 && <span style={{ fontSize:12, color:t.text3, textDecoration:'line-through', marginLeft:6 }}>&#8377;{p.original_price}</span>}
                      </div>
                      <Link href={`/stores/${p.shop_id}`} style={{ width:32, height:32, borderRadius:10, background:'#FF3008', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flexShrink:0 }}>
                        <IcoArrow />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            }) : [1,2,3,4,5,6,7,8].map(i => (
              <div key={i} style={{ background:t.card, borderRadius:20, overflow:'hidden', border:`1.5px solid ${t.border}`, boxShadow:t.cardShadow }}>
                <div className="sk" style={{ aspectRatio:'1/1' }} />
                <div style={{ padding:'14px 16px 16px' }}>
                  <div className="sk" style={{ height:14, borderRadius:6, marginBottom:8, width:'70%' }} />
                  <div className="sk" style={{ height:11, borderRadius:5, marginBottom:12, width:'50%' }} />
                  <div className="sk" style={{ height:18, borderRadius:7, width:'40%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px', background:t.bg2 }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:12 }}>Simple</p>
            <h2 className="syne" style={{ fontSize:'clamp(26px,4.5vw,42px)', fontWeight:800, color:t.text, letterSpacing:'-0.045em', marginBottom:12 }}>How it works</h2>
            <p style={{ fontSize:'clamp(14px,2vw,16px)', color:t.text2 }}>From tap to doorstep in three steps.</p>
          </div>
          <div className="step-g">
            {[
              { n:'01', title:'Share your location', desc:'We show every open shop within 5 km that delivers to you right now. Real-time, no guessing.' },
              { n:'02', title:'Add to cart and pay', desc:'Browse real products with real prices from local shops you know. Pay online or cash on delivery.' },
              { n:'03', title:'Track live on map', desc:'A verified rider picks up and delivers. Watch them move on the live map right to your door.' },
            ].map((step,i) => (
              <div key={i} className="lift" style={{ position:'relative', background:t.card, borderRadius:24, padding:'clamp(26px,3vw,34px)', border:`1.5px solid ${t.border}`, overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-10, right:14, fontSize:90, fontWeight:900, color:dark?'rgba(255,255,255,.02)':'rgba(0,0,0,.03)', lineHeight:1, letterSpacing:'-0.06em', userSelect:'none' }}>{step.n}</div>
                <div style={{ width:44, height:44, borderRadius:14, background:'rgba(255,48,8,.08)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
                  <span className="syne" style={{ fontWeight:800, fontSize:17, color:'#FF3008' }}>{step.n}</span>
                </div>
                <h3 style={{ fontWeight:800, fontSize:18, color:t.text, marginBottom:12, letterSpacing:'-0.02em' }}>{step.title}</h3>
                <p style={{ fontSize:14, color:t.text2, lineHeight:1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNER ──────────────────────────────────────────── */}
      <section className="sec" style={{ padding:'80px 20px', background:t.bg }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:12 }}>Join us</p>
            <h2 className="syne" style={{ fontSize:'clamp(26px,4.5vw,42px)', fontWeight:800, color:t.text, letterSpacing:'-0.045em', marginBottom:12 }}>Grow with Welokl</h2>
            <p style={{ fontSize:'clamp(14px,2vw,16px)', color:t.text2 }}>Whether you run a shop or own a vehicle, there is a place for you.</p>
          </div>
          <div className="part-g">
            {[
              { title:'List your shop', desc:'Reach thousands of local customers at zero setup cost. Get orders from day one and manage everything from your phone.', cta:'Partner with us', href:'/become-partner', color:'#FF3008', bullets:['Zero listing fee','Real-time order dashboard','Push notification alerts'] },
              { title:'Earn as a rider', desc:'Deliver when you want. Get paid weekly. Join hundreds of riders already earning on their own schedule with Welokl.', cta:'Become a rider', href:'/auth/signup?role=delivery_partner', color:'#2563eb', bullets:['Flexible hours','Weekly payouts','In-app navigation'] },
            ].map((card,i) => (
              <div key={i} className="lift" style={{ background:t.card, borderRadius:24, padding:'clamp(28px,3vw,38px)', border:`1.5px solid ${t.border}`, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`${card.color}08`, pointerEvents:'none' }} />
                <h3 className="syne" style={{ fontWeight:800, fontSize:'clamp(20px,2.5vw,24px)', color:t.text, letterSpacing:'-0.03em', marginBottom:12 }}>{card.title}</h3>
                <p style={{ fontSize:15, color:t.text2, lineHeight:1.7, marginBottom:24 }}>{card.desc}</p>
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:32 }}>
                  {card.bullets.map((b,bi) => (
                    <div key={bi} style={{ display:'flex', alignItems:'center', gap:9, color:'#16a34a' }}>
                      <IcoCheck /><span style={{ fontSize:14, fontWeight:600, color:t.text2 }}>{b}</span>
                    </div>
                  ))}
                </div>
                <Link href={card.href} className="btn-p press" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 26px', background:card.color, color:'#fff', fontWeight:800, fontSize:14, borderRadius:13, boxShadow:`0 8px 24px ${card.color}30` }}>
                  {card.cta} <IcoArrow />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="sec" style={{ padding:'96px 20px', background:t.bg, textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'60vw', height:'60vw', maxWidth:600, maxHeight:600, borderRadius:'50%', background:dark?'radial-gradient(circle,rgba(255,48,8,.07),transparent 70%)':'radial-gradient(circle,rgba(255,48,8,.05),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ maxWidth:580, margin:'0 auto', position:'relative' }}>
          <h2 className="syne" style={{ fontSize:'clamp(28px,6vw,52px)', fontWeight:800, color:t.text, letterSpacing:'-0.05em', lineHeight:1.02, marginBottom:18 }}>
            Ready to order from<br /><span className="tg">your neighbourhood?</span>
          </h2>
          <p style={{ fontSize:'clamp(14px,2vw,16px)', color:t.text2, marginBottom:40, lineHeight:1.7 }}>
            No subscription. No minimum order. Just fast, local delivery from shops you already know.
          </p>
          <Link href="/dashboard/customer" className="btn-p press" style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'17px 40px', background:'#FF3008', color:'#fff', fontWeight:900, fontSize:16, borderRadius:16, boxShadow:'0 14px 48px rgba(255,48,8,.35)' }}>
            Start ordering now <IcoArrow />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ background:'#060606', padding:'56px 20px 32px', borderTop:'1px solid rgba(255,255,255,.04)' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div className="foot-g" style={{ marginBottom:48 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:16 }}>
                <Logo />
                <span className="syne" style={{ fontWeight:800, fontSize:18, color:'#fff', letterSpacing:'-0.04em' }}>welokl</span>
              </div>
              <p style={{ fontSize:13.5, color:'rgba(255,255,255,.25)', lineHeight:1.8, maxWidth:260 }}>
                Hyperlocal delivery connecting local shops with customers nearby. Your neighbourhood, fast.
              </p>
            </div>
            {[
              { t:'Customers', l:[['Browse shops','/stores'],['Track order','/orders/history'],['Sign up','/auth/signup']] },
              { t:'Business',  l:[['Partner with us','/become-partner'],['Rider signup','/auth/signup?role=delivery_partner'],['Login','/auth/login']] },
              { t:'Company',   l:[['About us','#'],['Privacy','/privacy'],['Contact','#']] },
            ].map(col => (
              <div key={col.t}>
                <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.2)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:16 }}>{col.t}</p>
                {col.l.map(([label,href]) => (
                  <Link key={label} href={href} style={{ display:'block', fontSize:13.5, color:'rgba(255,255,255,.35)', marginBottom:10, fontWeight:500, transition:'color .15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.color='#fff')}
                    onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.35)')}>
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div style={{ paddingTop:24, borderTop:'1px solid rgba(255,255,255,.05)', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <p style={{ fontSize:12.5, color:'rgba(255,255,255,.15)' }}>&copy; {new Date().getFullYear()} Welokl. All rights reserved.</p>
            <p style={{ fontSize:12.5, color:'rgba(255,255,255,.15)' }}>Built for local, by local.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}