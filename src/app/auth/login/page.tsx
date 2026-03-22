'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'forgot'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [mode,       setMode]       = useState<Mode>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [googleLoad, setGoogleLoad] = useState(false)
  const [msg,        setMsg]        = useState<{text:string; type:'error'|'success'}|null>(null)
  const [notFound,   setNotFound]   = useState(false)  // triggers "go to signup" prompt

  // ── Google OAuth ────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoad(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setMsg({ text: error.message, type:'error' }); setGoogleLoad(false) }
    // On success, browser redirects to Google — no further action needed
  }

  // ── Email login ─────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    setNotFound(false)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      const msg = error.message.toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('email not confirmed')) {
        setNotFound(true)
        setMsg({ text: 'Wrong email or password. Try again or sign up.', type:'error' })
      } else {
        setMsg({ text: error.message, type:'error' })
      }
      return
    }

    if (data.user) {
      let role = data.user.user_metadata?.role
      if (!role) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single()
        role = profile?.role || 'customer'
      }
      const roleMap: Record<string,string> = {
        customer:         '/dashboard/customer',
        business:         '/dashboard/business',
        shopkeeper:       '/dashboard/business',
        delivery:         '/dashboard/delivery',
        delivery_partner: '/dashboard/delivery',
        admin:            '/dashboard/admin',
        management:       '/dashboard/management',
      }
      window.location.replace(roleMap[role] ?? '/dashboard/customer')
    }
  }

  // ── Forgot password ─────────────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)
    if (error) {
      setMsg({ text: error.message, type:'error' })
    } else {
      setMsg({ text: `Password reset link sent to ${email}. Check your inbox.`, type:'success' })
    }
  }

  // ── Styles ──────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width:'100%', padding:'12px 14px', borderRadius:14,
    border:'1.5px solid var(--divider)', background:'var(--input-bg)',
    color:'var(--text-primary)', fontSize:15, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box',
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <Link href="/" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:10 }}>
            <div style={{ width:44, height:44, background:'#FF3008', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(255,48,8,.3)' }}>
              <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontWeight:900, fontSize:22, color:'var(--text-primary)', letterSpacing:'-0.03em' }}>welokl</span>
          </Link>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:8 }}>
            {mode === 'login' ? 'Sign in to continue' : 'Reset your password'}
          </p>
        </div>

        <div style={{ background:'var(--card-white)', borderRadius:24, padding:28, boxShadow:'0 4px 24px rgba(0,0,0,.06)' }}>

          {/* ── FORGOT PASSWORD MODE ── */}
          {mode === 'forgot' ? (
            <>
              <h1 style={{ fontWeight:900, fontSize:20, color:'var(--text-primary)', marginBottom:6 }}>Forgot password?</h1>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>Enter your email and we'll send a reset link.</p>

              {msg && (
                <div style={{ padding:'12px 14px', borderRadius:12, marginBottom:16, background: msg.type==='success' ? 'var(--green-light)' : 'var(--error-light)', color: msg.type==='success' ? '#16a34a' : '#ef4444', fontSize:13, fontWeight:600 }}>
                  {msg.text}
                </div>
              )}

              <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required style={inp}
                  onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                  onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
                />
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:15, cursor:loading?'not-allowed':'pointer', opacity:loading?.7:1, fontFamily:'inherit' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <button onClick={() => { setMode('login'); setMsg(null) }}
                style={{ width:'100%', marginTop:14, padding:'12px', borderRadius:14, border:'1.5px solid var(--divider)', background:'transparent', color:'var(--text-muted)', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                ← Back to sign in
              </button>
            </>
          ) : (
          /* ── LOGIN MODE ── */
          <>
            <h1 style={{ fontWeight:900, fontSize:20, color:'var(--text-primary)', marginBottom:20 }}>Welcome back</h1>

            {/* Google button */}
            <button onClick={handleGoogle} disabled={googleLoad}
              style={{ width:'100%', padding:'13px', borderRadius:14, border:'1.5px solid var(--divider)', background:'var(--page-bg)', color:'var(--text-primary)', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18, opacity:googleLoad?.7:1 }}>
              {/* Google SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoad ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ flex:1, height:1, background:'var(--divider)' }} />
              <span style={{ fontSize:12, color:'var(--text-faint)', fontWeight:600 }}>or</span>
              <div style={{ flex:1, height:1, background:'var(--divider)' }} />
            </div>

            {/* Error / not found */}
            {msg && (
              <div style={{ padding:'12px 14px', borderRadius:12, marginBottom:14, background:'var(--error-light)', color:'#ef4444', fontSize:13, fontWeight:600 }}>
                {msg.text}
              </div>
            )}

            {/* Not registered prompt */}
            {notFound && (
              <div style={{ padding:'14px 16px', borderRadius:14, marginBottom:14, background:'var(--blue-light)', border:'1px solid rgba(79,70,229,.2)' }}>
                <p style={{ fontSize:13, color:'#4f46e5', fontWeight:700, marginBottom:6 }}>No account found with this email</p>
                <Link href={`/auth/signup?email=${encodeURIComponent(email)}`}
                  style={{ fontSize:13, fontWeight:800, color:'#fff', background:'#4f46e5', padding:'8px 16px', borderRadius:10, textDecoration:'none', display:'inline-block' }}>
                  Create account →
                </Link>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required style={inp}
                  onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                  onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
                />
              </div>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <label style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)' }}>Password</label>
                  <button type="button" onClick={() => { setMode('forgot'); setMsg(null) }}
                    style={{ fontSize:12, color:'#FF3008', fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position:'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required style={{ ...inp, paddingRight:44 }}
                    onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                    onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-faint)', padding:4 }}>
                    {showPw
                      ? <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:loading?'var(--chip-bg)':'#FF3008', color:loading?'var(--text-muted)':'#fff', fontWeight:900, fontSize:16, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:loading?'none':'0 8px 24px rgba(255,48,8,.3)', transition:'all .2s' }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)', marginTop:20 }}>
              Don't have an account?{' '}
              <Link href="/auth/signup" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>Create one</Link>
            </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}