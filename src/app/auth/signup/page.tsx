'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

const ROLES: { id: UserRole; label: string; sub: string }[] = [
  { id: 'customer',         label: 'Customer',        sub: 'Order from local shops'   },
  { id: 'business',         label: 'Business Owner',  sub: 'List your shop & sell'    },
  { id: 'delivery_partner', label: 'Delivery Rider',  sub: 'Deliver & earn money'     },
]

function isValidPhone(p: string) {
  const d = p.replace(/\D/g, '')
  return d.length === 10 && /^[6-9]/.test(d)
}

function SignupPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const fromGoogle = searchParams.get('from') === 'google'

  const [name,        setName]        = useState(decodeURIComponent(searchParams.get('name')  ?? ''))
  const [email,       setEmail]       = useState(decodeURIComponent(searchParams.get('email') ?? ''))
  const [phone,       setPhone]       = useState('')
  const [password,    setPassword]    = useState('')
  const [role,        setRole]        = useState<UserRole>((searchParams.get('role') as UserRole) ?? 'customer')
  const [loading,     setLoading]     = useState(false)
  const [googleLoad,  setGoogleLoad]  = useState(false)
  const [err,         setErr]         = useState('')
  const [googleReady, setGoogleReady] = useState(false)

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

    // Validations
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
        await supabase.from('delivery_partners').insert({ user_id: user.id, is_online: false })
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
    width:'100%', padding:'12px 14px', borderRadius:14,
    border:'1.5px solid var(--divider)', background:'var(--input-bg)',
    color:'var(--text-primary)', fontSize:15, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box',
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ width:'100%', maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <Link href="/" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:10 }}>
            <div style={{ width:44, height:44, background:'#FF3008', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(255,48,8,.3)' }}>
              <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="white"/></svg>
            </div>
            <span style={{ fontWeight:900, fontSize:22, color:'var(--text-primary)', letterSpacing:'-0.03em' }}>welokl</span>
          </Link>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:8 }}>Create your account</p>
        </div>

        <div style={{ background:'var(--card-white)', borderRadius:24, padding:28, boxShadow:'0 4px 24px rgba(0,0,0,.06)' }}>

          {fromGoogle && googleReady && (
            <div style={{ background:'#EEF2FF', border:'1px solid #C7D2FE', borderRadius:14, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#4f46e5', fontWeight:600 }}>
              ✓ Google account verified. Choose your role and complete signup below.
            </div>
          )}

          {err && (
            <div style={{ background:'var(--error-light)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#ef4444', fontWeight:600 }}>
              {err}
            </div>
          )}

          {/* Google button */}
          {!fromGoogle && (
            <>
              <button onClick={handleGoogleSignup} disabled={googleLoad}
                style={{ width:'100%', padding:'13px', borderRadius:14, border:'1.5px solid var(--divider)', background:'var(--page-bg)', color:'var(--text-primary)', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18, opacity:googleLoad?0.7:1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {googleLoad ? 'Redirecting…' : 'Sign up with Google'}
              </button>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                <div style={{ flex:1, height:1, background:'var(--divider)' }} />
                <span style={{ fontSize:12, color:'var(--text-faint)', fontWeight:600 }}>or with email</span>
                <div style={{ flex:1, height:1, background:'var(--divider)' }} />
              </div>
            </>
          )}

          {/* Role selector */}
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:10 }}>I want to join as</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 }}>
            {ROLES.map(r => (
              <button key={r.id} type="button" onClick={() => setRole(r.id)}
                style={{ padding:'12px 8px', borderRadius:14, border:`2px solid ${role===r.id?'#FF3008':'var(--divider)'}`, background:role===r.id?'var(--red-light)':'var(--page-bg)', cursor:'pointer', fontFamily:'inherit', textAlign:'center', transition:'all .15s' }}>
                <p style={{ fontWeight:800, fontSize:11, color:role===r.id?'#FF3008':'var(--text-primary)', marginBottom:3 }}>{r.label}</p>
                <p style={{ fontSize:10, color:'var(--text-faint)', fontWeight:500 }}>{r.sub}</p>
              </button>
            ))}
          </div>

          <form onSubmit={handleSignup} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Name */}
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Full name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Rahul Kumar" required style={inp}
                onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                onBlur={e => e.currentTarget.style.borderColor='var(--divider)'} />
            </div>

            {/* Phone — always shown, always required */}
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Mobile number *</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--text-muted)', fontWeight:600, pointerEvents:'none' }}>+91</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                  placeholder="98765 43210" required maxLength={10}
                  style={{ ...inp, paddingLeft:50 }}
                  onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--divider)'
                    if (phone && !isValidPhone(phone)) setErr('Enter a valid 10-digit number starting with 6, 7, 8 or 9')
                    else setErr('')
                  }} />
              </div>
            </div>

            {/* Email + Password — hide for Google users */}
            {!(fromGoogle && googleReady) && (
              <>
                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required style={inp}
                    onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                    onBlur={e => e.currentTarget.style.borderColor='var(--divider)'} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters" required minLength={8} style={inp}
                    onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                    onBlur={e => e.currentTarget.style.borderColor='var(--divider)'} />
                </div>
              </>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:loading?'var(--chip-bg)':'#FF3008', color:loading?'var(--text-muted)':'#fff', fontWeight:900, fontSize:16, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:loading?'none':'0 8px 24px rgba(255,48,8,.3)', transition:'all .2s' }}>
              {loading ? 'Creating account…' : fromGoogle && googleReady ? 'Complete signup' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)', marginTop:20 }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p style={{ color:'#888', fontFamily:'sans-serif' }}>Loading...</p></div>}>
      <SignupPageInner />
    </Suspense>
  )
}