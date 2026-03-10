'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

const ROLE_HOME: Record<string, string> = {
  customer:   '/dashboard/customer',
  shopkeeper: '/dashboard/business',
  business:   '/dashboard/business',
  delivery:   '/dashboard/delivery',
  admin:      '/dashboard/admin',
}

export default function LandingPage() {
  const [user, setUser]   = useState<any>(undefined)
  const [role, setRole]   = useState<string>('')
  const [stats, setStats] = useState({ shops: 0, riders: 0, orders: 0 })

  useEffect(() => {
    async function init() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const u = session?.user ?? null
      setUser(u)
      if (!u) { setRole(''); return }
      let r = u.user_metadata?.role || ''
      if (!r) {
        const { data: p } = await sb.from('users').select('role').eq('id', u.id).single()
        r = p?.role || 'customer'
      }
      setRole(r)
    }
    init()
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_, s) => {
      setUser(s?.user ?? null)
      if (!s?.user) setRole('')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadStats() {
      const sb = createClient()
      const [{ count: shopCount }, { count: riderCount }, { count: orderCount }] = await Promise.all([
        sb.from('shops').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('users').select('*', { count: 'exact', head: true }).eq('role', 'delivery'),
        sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      ])
      setStats({
        shops:  shopCount  || 0,
        riders: riderCount || 0,
        orders: orderCount || 0,
      })
    }
    loadStats()
  }, [])

  const dashHref = ROLE_HOME[role] || '/dashboard/customer'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' }}>
      

      {/* NAV */}
      <nav style={{position:'sticky',top:0,zIndex:100,borderBottom:'1px solid rgba(255,255,255,.06)',background:'rgba(10,10,10,.92)',backdropFilter:'blur(16px)'}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'0 20px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:9,textDecoration:'none'}}>
            <div style={{width:34,height:34,borderRadius:10,background:'#FF3008',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16,color:'#fff'}}>W</div>
            <span style={{fontWeight:900,fontSize:18,color:'#fff',letterSpacing:'-0.03em'}}>welokl</span>
          </Link>
          <div className="hide-m" style={{display:'flex',alignItems:'center',gap:32}}>
            <a href="#how" className="nav-a">How it works</a>
            <a href="#for" className="nav-a">For you</a>
            <a href="#mission" className="nav-a">Mission</a>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <ThemeToggle />
            {user === undefined ? (
              <div style={{width:80,height:34,borderRadius:10,background:'rgba(255,255,255,.06)'}}/>
            ) : user ? (
              <Link href={dashHref} className="cta-p" style={{padding:'8px 18px',fontSize:13}}>My Dashboard →</Link>
            ) : (
              <>
                <Link href="/auth/login" style={{color:'rgba(255,255,255,.6)',fontSize:14,fontWeight:600,textDecoration:'none',padding:'8px 12px'}} className="hide-m">Log in</Link>
                <Link href="/auth/signup" className="cta-p" style={{padding:'8px 18px',fontSize:13}}>Get started free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{padding:'clamp(72px,10vw,128px) 20px clamp(56px,8vw,96px)',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-80,right:-60,width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(255,48,8,.15) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-100,left:-80,width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(255,48,8,.06) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:0,opacity:.025,backgroundImage:'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)',backgroundSize:'56px 56px',pointerEvents:'none'}}/>

        <div style={{maxWidth:800,margin:'0 auto',textAlign:'center',position:'relative'}}>
          <div className="fade-up" style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,48,8,.12)',border:'1px solid rgba(255,48,8,.25)',borderRadius:999,padding:'7px 16px',marginBottom:28,fontSize:13,fontWeight:700,color:'#FF7A5C'}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:'#FF3008',display:'inline-block',animation:'pulse 2s infinite'}}/>
            Hyperlocal delivery — live in your city
          </div>

          <h1 className="fade-up-1 hero-h" style={{fontSize:'clamp(2.8rem,6vw,4.6rem)',fontWeight:900,lineHeight:1.05,letterSpacing:'-0.04em',marginBottom:24}}>
            Your neighbourhood<br/>
            <span style={{color:'#FF3008'}}>delivered to your door</span>
          </h1>

          <p className="fade-up-2" style={{fontSize:'clamp(15px,2.5vw,18px)',color:'rgba(255,255,255,.5)',lineHeight:1.8,maxWidth:540,margin:'0 auto 36px'}}>
            Food, grocery, pharmacy, salon — real shops from your street. Real riders. Real-time tracking. Under 30 minutes.
          </p>

          <div className="fade-up-3" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,flexWrap:'wrap'}}>
            {user ? (
              <Link href={dashHref} className="cta-p" style={{fontSize:16,padding:'15px 32px'}}>Go to my dashboard →</Link>
            ) : (
              <>
                <Link href="/auth/signup" className="cta-p" style={{fontSize:16,padding:'15px 32px'}}>Order from nearby shops</Link>
                <Link href="/auth/signup?role=business" className="cta-g" style={{fontSize:16,padding:'15px 32px'}}>List your shop</Link>
              </>
            )}
          </div>

          <div className="fade-up-4" style={{marginTop:44,display:'flex',alignItems:'center',justifyContent:'center',gap:24,flexWrap:'wrap'}}>
            {['500+ local shops','Under 30 min delivery','UPI & Cash on delivery','Real riders near you'].map(t=>(
              <div key={t} style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:'rgba(255,255,255,.35)',fontWeight:600}}>
                <span style={{color:'#FF3008',fontSize:14}}>✓</span> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div style={{borderTop:'1px solid rgba(255,255,255,.06)',borderBottom:'1px solid rgba(255,255,255,.06)',background:'rgba(255,255,255,.02)'}}>
        <div className="stats-g" style={{maxWidth:960,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
          {[
            {val: stats.shops  > 0 ? `${stats.shops}+`  : '—', label:'Local shops live'},
            {val: stats.orders > 0 ? `${stats.orders}+` : '—', label:'Orders delivered'},
            {val: stats.riders > 0 ? `${stats.riders}+` : '—', label:'Delivery riders'},
            {val: '< 30',                                        label:'Minutes avg delivery'},
          ].map(s=>(
            <div key={s.label} style={{textAlign:'center',padding:'24px 16px',borderRight:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{fontWeight:900,fontSize:'clamp(1.6rem,3vw,2.2rem)',color:'#FF3008',letterSpacing:'-0.03em'}}>{s.val}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* THE PROBLEM */}
      <section style={{padding:'clamp(64px,8vw,100px) 20px'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div className="g2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:56,alignItems:'center'}}>
            <div>
              <p style={{fontSize:12,fontWeight:700,color:'#FF3008',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:16}}>The Problem</p>
              <h2 style={{fontWeight:900,fontSize:'clamp(1.8rem,3vw,2.6rem)',lineHeight:1.15,letterSpacing:'-0.03em',marginBottom:20}}>
                Big apps ignore<br/>your street.<br/><span style={{color:'#FF3008'}}>We don't.</span>
              </h2>
              <p style={{color:'rgba(255,255,255,.45)',lineHeight:1.8,fontSize:15}}>
                National delivery apps use dark kitchens 15km away. Your local kirana, pharmacy, corner bakery — invisible to them. Welokl makes every shop in your locality discoverable and deliverable.
              </p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {bad:'Dark kitchens 15km away',good:'Your street-corner shop'},
                {bad:'No local pharmacy delivery',good:'Medicine in 20 minutes'},
                {bad:'Shops losing to big apps',good:'Shops keep most of revenue'},
                {bad:'Riders underpaid by big apps',good:'Riders earn fairly here'},
              ].map((row,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div style={{background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.15)',borderRadius:12,padding:'11px 14px',fontSize:13,color:'rgba(255,255,255,.4)',fontWeight:600}}>❌ {row.bad}</div>
                  <div style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.2)',borderRadius:12,padding:'11px 14px',fontSize:13,color:'rgba(34,197,94,.9)',fontWeight:700}}>✅ {row.good}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{padding:'clamp(56px,8vw,96px) 20px',background:'rgba(255,255,255,.015)',borderTop:'1px solid rgba(255,255,255,.05)'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:52}}>
            <p style={{fontSize:12,fontWeight:700,color:'#FF3008',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:14}}>How it works</p>
            <h2 style={{fontWeight:900,fontSize:'clamp(1.8rem,3vw,2.4rem)',letterSpacing:'-0.03em'}}>Order in under 60 seconds</h2>
          </div>
          <div className="g3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20}}>
            {[
              {n:'1',icon:'📍',title:'Share your location',desc:'We find every open shop within your neighbourhood — 2 to 20 km from you.'},
              {n:'2',icon:'🛒',title:'Browse & add to cart',desc:'Groceries, food, medicine, salons. Filter by open now, category, or distance.'},
              {n:'3',icon:'🛵',title:'Delivered in 30 min',desc:'A local rider picks up from the shop and delivers to your door. Track live.'},
            ].map(s=>(
              <div key={s.n} className="fcard">
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                  <div style={{width:36,height:36,borderRadius:10,background:'#FF3008',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16,color:'white',flexShrink:0}}>{s.n}</div>
                  <span style={{fontSize:28}}>{s.icon}</span>
                </div>
                <h3 style={{fontWeight:800,fontSize:17,marginBottom:10,letterSpacing:'-0.01em'}}>{s.title}</h3>
                <p style={{fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.7}}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:36}}>
            <Link href={user ? dashHref : '/auth/signup'} className="cta-p">
              {user ? 'Go to my dashboard →' : 'Start ordering free →'}
            </Link>
          </div>
        </div>
      </section>

      {/* FOR EVERYONE */}
      <section id="for" style={{padding:'clamp(56px,8vw,96px) 20px',borderTop:'1px solid rgba(255,255,255,.05)'}}>
        <div style={{maxWidth:1060,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:52}}>
            <p style={{fontSize:12,fontWeight:700,color:'#FF3008',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:14}}>Who it's for</p>
            <h2 style={{fontWeight:900,fontSize:'clamp(1.8rem,3vw,2.4rem)',letterSpacing:'-0.03em'}}>Built for the whole neighbourhood</h2>
          </div>
          <div className="g3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20}}>
            <div className="for-card" style={{background:'rgba(255,48,8,.08)',border:'1px solid rgba(255,48,8,.2)'}}>
              <div style={{fontSize:44,marginBottom:18}}>🛍️</div>
              <h3 style={{fontWeight:900,fontSize:20,marginBottom:10}}>Customers</h3>
              <p style={{fontSize:14,color:'rgba(255,255,255,.5)',lineHeight:1.7,marginBottom:20}}>Order from every kind of local shop — food, groceries, medicine — and get it fast or pick it up yourself.</p>
              <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
                {['Shop from your neighbourhood','Live delivery tracking','Pickup or delivery option','UPI & Cash accepted'].map(f=>(
                  <li key={f} style={{fontSize:13,color:'rgba(255,255,255,.6)',display:'flex',alignItems:'center',gap:8}}><span style={{color:'#FF3008',fontWeight:900}}>→</span>{f}</li>
                ))}
              </ul>
              <Link href={user&&role==='customer'?dashHref:'/auth/signup'} style={{display:'block',textAlign:'center',padding:'11px 0',borderRadius:12,background:'#FF3008',color:'white',fontWeight:800,fontSize:14,textDecoration:'none'}}>
                {user&&role==='customer'?'Go to my orders →':'Order now free →'}
              </Link>
            </div>

            <div className="for-card" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
              <div style={{fontSize:44,marginBottom:18}}>🏪</div>
              <h3 style={{fontWeight:900,fontSize:20,marginBottom:10}}>Shop Owners</h3>
              <p style={{fontSize:14,color:'rgba(255,255,255,.5)',lineHeight:1.7,marginBottom:20}}>List your shop free. We bring local customers to your door. You keep the bulk of every order — no hidden fees, ever.</p>
              <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
                {['Free listing — zero setup cost','Low commission on completed sales','Dashboard to manage orders','Accept pickup & delivery'].map(f=>(
                  <li key={f} style={{fontSize:13,color:'rgba(255,255,255,.6)',display:'flex',alignItems:'center',gap:8}}><span style={{color:'rgba(255,255,255,.3)',fontWeight:900}}>→</span>{f}</li>
                ))}
              </ul>
              <Link href={user&&(role==='shopkeeper'||role==='business')?dashHref:'/auth/signup?role=business'} style={{display:'block',textAlign:'center',padding:'11px 0',borderRadius:12,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.15)',color:'white',fontWeight:800,fontSize:14,textDecoration:'none'}}>
                {user&&(role==='shopkeeper'||role==='business')?'Go to my shop →':'Register your shop →'}
              </Link>
            </div>

            <div className="for-card" style={{background:'rgba(34,197,94,.06)',border:'1px solid rgba(34,197,94,.15)'}}>
              <div style={{fontSize:44,marginBottom:18}}>🛵</div>
              <h3 style={{fontWeight:900,fontSize:20,marginBottom:10}}>Delivery Riders</h3>
              <p style={{fontSize:14,color:'rgba(255,255,255,.5)',lineHeight:1.7,marginBottom:20}}>Earn a solid income doing deliveries in your own neighbourhood. Work whenever you want. Get paid on time, every time.</p>
              <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
                {['Competitive pay per delivery','Instant wallet credit','Work your own hours','Short local distances only'].map(f=>(
                  <li key={f} style={{fontSize:13,color:'rgba(255,255,255,.6)',display:'flex',alignItems:'center',gap:8}}><span style={{color:'#22C55E',fontWeight:900}}>→</span>{f}</li>
                ))}
              </ul>
              <Link href={user&&role==='delivery'?dashHref:'/auth/signup?role=delivery'} style={{display:'block',textAlign:'center',padding:'11px 0',borderRadius:12,background:'rgba(34,197,94,.15)',border:'1px solid rgba(34,197,94,.3)',color:'#22C55E',fontWeight:800,fontSize:14,textDecoration:'none'}}>
                {user&&role==='delivery'?'Go to my deliveries →':'Start earning →'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section id="mission" style={{padding:'clamp(56px,8vw,96px) 20px',borderTop:'1px solid rgba(255,255,255,.05)',background:'rgba(255,255,255,.01)'}}>
        <div style={{maxWidth:720,margin:'0 auto',textAlign:'center'}}>
          <p style={{fontSize:12,fontWeight:700,color:'#FF3008',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:20}}>Our Mission</p>
          <blockquote style={{fontWeight:900,fontSize:'clamp(1.5rem,3.5vw,2.2rem)',lineHeight:1.3,letterSpacing:'-0.03em',marginBottom:24,fontStyle:'normal'}}>
            "Make local commerce thrive in the age of apps — so the shop at the end of your street stays open."
          </blockquote>
          <p style={{fontSize:15,color:'rgba(255,255,255,.4)',lineHeight:1.8,maxWidth:560,margin:'0 auto 36px'}}>
            Every order on Welokl keeps a local shopkeeper in business, puts fair wages in a rider's pocket, and gets fresh goods to a neighbour's door. Hyperlocal, honest, built to last.
          </p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap'}}>
            {[{icon:'🌱',title:'Community first',sub:'No dark kitchens'},{icon:'⚡',title:'Under 30 minutes',sub:'Always'},{icon:'🤝',title:'Fair for all',sub:'Shops & riders paid well'}].map(v=>(
              <div key={v.title} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:'14px 18px'}}>
                <span style={{fontSize:22}}>{v.icon}</span>
                <div style={{textAlign:'left'}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#fff'}}>{v.title}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.35)'}}>{v.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA — only for guests */}
      {!user && (
        <section style={{padding:'clamp(56px,8vw,96px) 20px',borderTop:'1px solid rgba(255,255,255,.05)'}}>
          <div style={{maxWidth:600,margin:'0 auto',textAlign:'center'}}>
            <h2 style={{fontWeight:900,fontSize:'clamp(1.8rem,4vw,2.8rem)',letterSpacing:'-0.03em',marginBottom:16}}>
              Order from your<br/><span style={{color:'#FF3008'}}>neighbourhood today</span>
            </h2>
            <p style={{fontSize:15,color:'rgba(255,255,255,.4)',marginBottom:32}}>Free to join. No minimum order. Shops open right now.</p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <Link href="/auth/signup" className="cta-p" style={{fontSize:16,padding:'15px 36px'}}>Create free account</Link>
              <Link href="/auth/login" className="cta-g" style={{fontSize:16,padding:'15px 36px'}}>Sign in</Link>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,.06)',padding:'28px 20px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:'#FF3008',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#fff'}}>W</div>
            <span style={{fontWeight:800,fontSize:16,letterSpacing:'-0.02em'}}>welokl</span>
          </div>
          <p style={{fontSize:12,color:'rgba(255,255,255,.25)'}}>Your neighbourhood, on your phone - © {new Date().getFullYear()} Welokl</p>
          <div style={{display:'flex',gap:24,fontSize:12}}>
            <a href="#" style={{textDecoration:'none',color:'rgba(255,255,255,.3)'}}>Privacy</a>
            <a href="#" style={{textDecoration:'none',color:'rgba(255,255,255,.3)'}}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}