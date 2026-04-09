'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { WelklLogo } from '@/components/WelklLogo'

type Mode = 'login' | 'forgot'

// ── Left decorative panel ─────────────────────────────────────────────────
function AuthPanel() {
  const benefits = [
    { icon: '⚡', text: 'Order from local shops in under 2 minutes' },
    { icon: '🛵', text: 'Live rider tracking — know exactly when it arrives' },
    { icon: '🏪', text: 'Food, groceries, medicine — all in one app' },
    { icon: '💸', text: 'No minimum order. Rs.15 chai? We still deliver.' },
  ]
  return (
    <div className="auth-panel-left" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Top: logo + tagline */}
      <div>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 22 16" fill="none" width={20} height={14}>
              <polyline points="1,15 5,2 11,10 17,2 21,15" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>welokl</span>
        </Link>

        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 28, lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.5px' }}>
          Your neighbourhood,<br />on demand.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
          Join thousands ordering from local shops every day.
        </p>

        {/* Benefits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{b.icon}</div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.5, margin: 0, paddingTop: 8 }}>{b.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: testimonial */}
      <div style={{
        background: 'rgba(0,0,0,0.15)',
        borderRadius: 14,
        padding: '16px 18px',
        marginTop: 40,
      }}>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px', fontStyle: 'italic' }}>
          "Got medicine at 11pm without stepping out. Welokl is a lifeline for hostel life."
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>R</div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: 0 }}>Rahul S.</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: 0 }}>Hostel Block C, Jaipur</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main login page ───────────────────────────────────────────────────────
export default function LoginPage() {
  const supabase = createClient()

  const [mode,       setMode]       = useState<Mode>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [googleLoad, setGoogleLoad] = useState(false)
  const [msg,        setMsg]        = useState<{text:string; type:'error'|'success'}|null>(null)
  const [notFound,   setNotFound]   = useState(false)
  const [isMobile,   setIsMobile]   = useState(false)

  // Hide left panel on mobile via JS (CSS !important unreliable on some browsers)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Google OAuth ─────────────────────────────────────────────────────────
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
  }

  // ── Email login ──────────────────────────────────────────────────────────
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

  // ── Forgot password ───────────────────────────────────────────────────────
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
      setMsg({ text: `Reset link sent to ${email}. Check your inbox.`, type:'success' })
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid var(--divider, #eee)',
    background: 'var(--input-bg, #f5f5f5)',
    color: 'var(--text-primary, #111)', fontSize: 15,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
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

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary, #555)', marginBottom: 6 }

  return (
    <div className="auth-split" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Left panel — hidden on mobile */}
      {!isMobile && <AuthPanel />}

      {/* Right panel — form */}
      <div className="auth-panel-right">
        <div style={{ width: '100%', maxWidth: 380 }} className="ui-fadein">

          {/* Mobile header — red top with logo + tagline (replaces left panel on mobile) */}
          <div className="auth-mobile-logo" style={{ display: 'none', padding: '40px 24px 28px', width: '100%', boxSizing: 'border-box' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 22 16" fill="none" width={18} height={12}><polyline points="1,15 5,2 11,10 17,2 21,15" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>welokl</span>
            </Link>
            <p style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 700, fontSize: 18, lineHeight: 1.3, margin: 0 }}>Your neighbourhood,<br />on demand.</p>
          </div>

          <div className="auth-inner-card" style={{
            background: 'var(--card-white, #fff)',
            borderRadius: 20,
            padding: '32px 28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            border: '1px solid var(--divider, #eee)',
          }}>

            {/* ── FORGOT PASSWORD MODE ── */}
            {mode === 'forgot' ? (
              <>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-primary, #111)', marginBottom: 6 }}>Forgot password?</h1>
                <p style={{ fontSize: 14, color: 'var(--text-muted, #888)', marginBottom: 24 }}>Enter your email and we'll send a reset link.</p>

                {msg && (
                  <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 16, background: msg.type === 'success' ? 'var(--green-light, #eefaf4)' : 'var(--error-light, #fef2f2)', color: msg.type === 'success' ? '#16a34a' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                    {msg.text}
                  </div>
                )}

                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required style={inp} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: loading ? 'var(--chip-bg)' : '#FF3008', color: loading ? 'var(--text-muted)' : '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 16px rgba(255,48,8,0.28)', transition: 'all .2s' }}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <button onClick={() => { setMode('login'); setMsg(null) }}
                  style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 12, border: '1.5px solid var(--divider)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms' }}>
                  ← Back to sign in
                </button>
              </>
            ) : (
            /* ── LOGIN MODE ── */
            <>
              <h1 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-primary, #111)', marginBottom: 4 }}>Welcome back</h1>
              <p style={{ fontSize: 14, color: 'var(--text-muted, #888)', marginBottom: 24 }}>Sign in to continue ordering</p>

              {/* Google */}
              <button onClick={handleGoogle} disabled={googleLoad}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px solid var(--divider)', background: 'var(--page-bg)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, opacity: googleLoad ? 0.7 : 1, transition: 'background 150ms' }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {googleLoad ? 'Redirecting…' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>or with email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
              </div>

              {/* Error */}
              {msg && (
                <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 14, background: 'var(--error-light, #fef2f2)', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  {msg.text}
                </div>
              )}

              {/* Not registered prompt */}
              {notFound && (
                <div style={{ padding: '14px 16px', borderRadius: 14, marginBottom: 14, background: 'var(--blue-light, #eff2ff)', border: '1px solid rgba(79,70,229,.2)' }}>
                  <p style={{ fontSize: 13, color: '#4f46e5', fontWeight: 700, marginBottom: 8 }}>No account found with this email</p>
                  <Link href={`/auth/signup?email=${encodeURIComponent(email)}`}
                    style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: '#4f46e5', padding: '8px 16px', borderRadius: 10, textDecoration: 'none', display: 'inline-block' }}>
                    Create account →
                  </Link>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required style={inp} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary, #555)' }}>Password</label>
                    <button type="button" onClick={() => { setMode('forgot'); setMsg(null) }}
                      style={{ fontSize: 12, color: '#FF3008', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ ...inp, paddingRight: 44 }} onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4 }}>
                      {showPw
                        ? <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        : <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: loading ? 'var(--chip-bg)' : '#FF3008', color: loading ? 'var(--text-muted)' : '#fff', fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 16px rgba(255,48,8,0.28)', transition: 'all .2s' }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
                Don't have an account?{' '}
                <Link href="/auth/signup" style={{ color: '#FF3008', fontWeight: 700, textDecoration: 'none' }}>Create one free</Link>
              </p>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
