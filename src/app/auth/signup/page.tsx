'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { WelklLogo } from '@/components/WelklLogo'
type UserRole = 'customer' | 'business' | 'delivery_partner' | 'admin'

const ROLES: { id: UserRole; label: string; sub: string; icon: string }[] = [
  { id: 'customer',         label: 'Customer',       sub: 'Order from shops',    icon: '🛒' },
  { id: 'business',         label: 'Shop Owner',     sub: 'Sell on Welokl',      icon: '🏪' },
  { id: 'delivery_partner', label: 'Rider',          sub: 'Deliver & earn',      icon: '🛵' },
]

function isValidPhone(p: string) {
  const d = p.replace(/\D/g, '')
  return d.length === 10 && /^[6-9]/.test(d)
}

// ── Left panel by role ────────────────────────────────────────────────────
const ROLE_COPY: Record<string, { headline: string; sub: string; benefits: string[] }> = {
  customer: {
    headline: 'Order anything in 30 minutes.',
    sub: 'Food, grocery, medicine — from shops right around you.',
    benefits: [
      'Browse local shops open right now',
      'Live rider tracking on a map',
      'No minimum order — even a ₹15 chai',
      'Pay cash, UPI, or wallet',
    ],
  },
  business: {
    headline: 'Grow your shop with Welokl.',
    sub: 'Stop managing orders on WhatsApp. Go fully digital.',
    benefits: [
      'Get discovered by nearby customers',
      'Accept orders instantly — no missed calls',
      'We handle the delivery logistics',
      'Only 10% commission. No upfront cost.',
    ],
  },
  delivery_partner: {
    headline: 'Earn on your own schedule.',
    sub: 'Deliver for local shops. Payout every week.',
    benefits: [
      'Choose your own working hours',
      '₹20 per delivery + weekly settlements',
      'Simple app — no complex training',
      'Priority orders earn extra',
    ],
  },
}

function AuthPanel({ role }: { role: UserRole }) {
  const copy = ROLE_COPY[role] || ROLE_COPY.customer
  return (
    <div style={{
      width: 420, flexShrink: 0, background: '#FF3008',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '48px 40px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 22 16" fill="none" width={20} height={14}>
              <polyline points="1,15 5,2 11,10 17,2 21,15" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>welokl</span>
        </Link>

        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 26, lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.4px', transition: 'all 200ms' }}>
          {copy.headline}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.6, marginBottom: 36 }}>
          {copy.sub}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {copy.benefits.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>
                <svg viewBox="0 0 10 10" fill="none" width={10} height={10}>
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>{b}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div style={{ display: 'flex', gap: 16, marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        {[
          { n: '50+', l: 'Local shops' },
          { n: '500+', l: 'Happy customers' },
          { n: '22 min', l: 'Avg delivery' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: 0 }}>{s.n}</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: 0 }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Signup form inner (needs useSearchParams → Suspense) ──────────────────
function SignupPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const fromGoogle = searchParams.get('from') === 'google'

  const [name,       setName]       = useState(decodeURIComponent(searchParams.get('name')  ?? ''))
  const [email,      setEmail]      = useState(decodeURIComponent(searchParams.get('email') ?? ''))
  const [phone,      setPhone]      = useState('')
  const [password,   setPassword]   = useState('')
  const [role,       setRole]       = useState<UserRole>((searchParams.get('role') as UserRole) ?? 'customer')
  const [loading,    setLoading]    = useState(false)
  const [googleLoad, setGoogleLoad] = useState(false)
  const [err,        setErr]        = useState('')
  const [googleReady,setGoogleReady]= useState(false)

  useEffect(() => {
    if (!fromGoogle) return
    try {
      const saved = localStorage.getItem('welokl_pending_role') as UserRole | null
      if (saved && ['customer','business','delivery_partner'].includes(saved)) {
        setRole(saved)
        localStorage.removeItem('welokl_pending_role')
      }
    } catch {}
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setGoogleReady(true)
      else setErr('Session expired. Please try signing up with Google again.')
    })
  }, [fromGoogle])

  async function handleGoogleSignup() {
    setGoogleLoad(true); setErr('')
    try { localStorage.setItem('welokl_pending_role', role) } catch {}
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo:`${window.location.origin}/auth/callback`, queryParams:{access_type:'offline',prompt:'consent'} },
    })
    if (error) { setErr(error.message); setGoogleLoad(false) }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setErr('')

    if (!name.trim())         { setErr('Please enter your full name'); return }
    if (!isValidPhone(phone)) { setErr('Enter a valid 10-digit Indian mobile number (starts with 6-9)'); return }
    if (!fromGoogle && !email.trim())       { setErr('Please enter your email'); return }
    if (!fromGoogle && password.length < 8) { setErr('Password must be at least 8 characters'); return }

    setLoading(true)

    if (fromGoogle && googleReady) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setErr('Session lost. Please try again.'); setLoading(false); return }
      const { error } = await supabase.from('users').insert({
        id: user.id, name: name.trim(), email: user.email,
        phone: phone.replace(/\D/g,''), role,
      })
      if (error) { setErr(error.message); setLoading(false); return }
      if (role === 'delivery_partner') {
        await supabase.from('delivery_partners').insert({ user_id: user.id, is_online: false, verification_status: 'pending' })
      }
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password, options: { data: { name, role } },
      })
      if (authError || !authData.user) { setErr(authError?.message ?? 'Signup failed'); setLoading(false); return }
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id, name: name.trim(),
        email: email.trim(), phone: phone.replace(/\D/g,''), role,
      })
      if (profileError) { setErr(profileError.message); setLoading(false); return }
      if (role === 'delivery_partner') {
        await supabase.from('delivery_partners').insert({ user_id: authData.user.id, is_online: false })
      }
    }

    const redirects: Record<UserRole, string> = {
      customer:'/dashboard/customer', business:'/dashboard/business',
      delivery_partner:'/dashboard/delivery', admin:'/dashboard/admin',
    }
    await new Promise(r => setTimeout(r, 200))
    window.location.replace(redirects[role])
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'12px 14px', borderRadius:12,
    border:'1.5px solid var(--divider, #eee)', background:'var(--input-bg, #f5f5f5)',
    color:'var(--text-primary, #111)', fontSize:15, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box', transition:'border-color 150ms ease, box-shadow 150ms ease',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#FF3008'
    e.currentTarget.style.background = 'var(--card-white, #fff)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,48,8,0.1)'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--divider, #eee)'
    e.currentTarget.style.background = 'var(--input-bg, #f5f5f5)'
    e.currentTarget.style.boxShadow = 'none'
  }
  const labelStyle: React.CSSProperties = { display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary,#555)', marginBottom:6 }

  return (
    <div className="auth-split" style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", alignItems: 'stretch' }}>

      {/* Left panel — updates dynamically with role */}
      <AuthPanel role={role} />

      {/* Right panel */}
      <div className="auth-panel-right" style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 40 }}>
        <div style={{ width:'100%', maxWidth:400 }} className="ui-fadein">

          {/* Mobile logo */}
          <div className="auth-mobile-logo" style={{ textAlign:'center', marginBottom:28, display:'none' }}>
            <Link href="/" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <WelklLogo height={32} />
            </Link>
          </div>

          <div style={{ background:'var(--card-white,#fff)', borderRadius:20, padding:'28px 24px', boxShadow:'0 4px 24px rgba(0,0,0,0.07)', border:'1px solid var(--divider,#eee)' }}>

            <h1 style={{ fontWeight:900, fontSize:20, color:'var(--text-primary,#111)', marginBottom:4 }}>Create your account</h1>
            <p style={{ fontSize:13, color:'var(--text-muted,#888)', marginBottom:20 }}>Free forever. No credit card needed.</p>

            {fromGoogle && googleReady && (
              <div style={{ background:'#EEF2FF', border:'1px solid #C7D2FE', borderRadius:12, padding:'12px 14px', marginBottom:18, fontSize:13, color:'#4f46e5', fontWeight:600 }}>
                Google account verified. Choose your role and complete signup.
              </div>
            )}

            {err && (
              <div style={{ background:'var(--error-light,#fef2f2)', borderRadius:12, padding:'12px 14px', marginBottom:14, fontSize:13, color:'#ef4444', fontWeight:600 }}>
                {err}
              </div>
            )}

            {/* Role selector */}
            <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary,#555)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>I want to join as</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 }}>
              {ROLES.map(r => (
                <button key={r.id} type="button" onClick={() => setRole(r.id)}
                  style={{
                    padding:'10px 6px', borderRadius:12,
                    border:`2px solid ${role===r.id?'#FF3008':'var(--divider,#eee)'}`,
                    background:role===r.id?'var(--red-light,#fff0ee)':'var(--page-bg,#f5f5f5)',
                    cursor:'pointer', fontFamily:'inherit', textAlign:'center',
                    transition:'all 150ms',
                  }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{r.icon}</div>
                  <p style={{ fontWeight:800, fontSize:11, color:role===r.id?'#FF3008':'var(--text-primary,#111)', marginBottom:2 }}>{r.label}</p>
                  <p style={{ fontSize:9, color:'var(--text-faint,#aaa)', fontWeight:500 }}>{r.sub}</p>
                </button>
              ))}
            </div>

            {/* Google button */}
            {!fromGoogle && (
              <>
                <button onClick={handleGoogleSignup} disabled={googleLoad}
                  style={{ width:'100%', padding:'12px', borderRadius:12, border:'1.5px solid var(--divider,#eee)', background:'var(--page-bg)', color:'var(--text-primary)', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16, opacity:googleLoad?0.7:1, transition:'background 150ms' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {googleLoad ? 'Redirecting…' : 'Sign up with Google'}
                </button>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ flex:1, height:1, background:'var(--divider)' }} />
                  <span style={{ fontSize:12, color:'var(--text-faint)', fontWeight:600 }}>or with email</span>
                  <div style={{ flex:1, height:1, background:'var(--divider)' }} />
                </div>
              </>
            )}

            <form onSubmit={handleSignup} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>Full name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Rahul Kumar" required style={inp} onFocus={onFocus} onBlur={onBlur} />
              </div>

              {/* Phone */}
              <div>
                <label style={labelStyle}>Mobile number *</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--text-muted)', fontWeight:600, pointerEvents:'none' }}>+91</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="98765 43210" required maxLength={10}
                    style={{ ...inp, paddingLeft:50 }} onFocus={onFocus}
                    onBlur={e => {
                      e.currentTarget.style.borderColor='var(--divider,#eee)'
                      e.currentTarget.style.background='var(--input-bg,#f5f5f5)'
                      e.currentTarget.style.boxShadow='none'
                      if (phone && !isValidPhone(phone)) setErr('Enter a valid 10-digit number starting with 6, 7, 8 or 9')
                      else setErr('')
                    }} />
                </div>
              </div>

              {/* Email + Password — hide for Google users */}
              {!(fromGoogle && googleReady) && (
                <>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inp} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <div>
                    <label style={labelStyle}>Password *</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} style={inp} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </>
              )}

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:loading?'var(--chip-bg)':'#FF3008', color:loading?'var(--text-muted)':'#fff', fontWeight:900, fontSize:15, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:loading?'none':'0 4px 16px rgba(255,48,8,0.28)', transition:'all .2s', marginTop:4 }}>
                {loading ? 'Creating account…' : fromGoogle && googleReady ? 'Complete signup' : 'Create account'}
              </button>
            </form>

            <p style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)', marginTop:18 }}>
              Already have an account?{' '}
              <Link href="/auth/login" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <p style={{ color:'#888', fontFamily:'sans-serif' }}>Loading...</p>
      </div>
    }>
      <SignupPageInner />
    </Suspense>
  )
}
