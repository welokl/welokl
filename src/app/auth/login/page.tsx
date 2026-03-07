'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPwd]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.user) { setError('Invalid email or password.'); setLoading(false); return }
    let role = data.user.user_metadata?.role
    if (!role) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single()
      role = profile?.role || 'customer'
    }
    await new Promise(r => setTimeout(r, 300))
    window.location.replace(`/dashboard/${role}`)
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border-2)',
    background: 'var(--input-bg)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left panel */}
      <div style={{ display: 'none', width: '50%', background: '#0a0a0a', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', position: 'relative', overflow: 'hidden' }}
        className="auth-left-panel">
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ position: 'absolute', top: '30%', right: -60, width: 300, height: 300, borderRadius: '50%', background: '#ff3008', opacity: 0.15, filter: 'blur(70px)' }} />
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', position: 'relative' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ff3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 18 }}>W</div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>welokl</span>
        </Link>
        <div style={{ position: 'relative' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Welcome back</p>
          <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 36, lineHeight: 1.15, marginBottom: 24 }}>Your neighbourhood<br />is waiting.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['500+ local shops near you', 'UPI & Cash on delivery', 'Live order tracking'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                <span style={{ color: '#ff3008', fontWeight: 900 }}>→</span> {f}
              </div>
            ))}
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, position: 'relative' }}>Hyperlocal. Honest. Yours.</p>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 36 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ff3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>W</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>welokl</span>
          </Link>
          <h1 style={{ fontWeight: 900, fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>Sign in</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 28 }}>Enter your credentials to continue</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                required autoComplete="email" style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#ff3008'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-2)'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPwd(e.target.value)} placeholder="••••••••"
                required autoComplete="current-password" style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#ff3008'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-2)'} />
            </div>

            {error && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, borderRadius: 10, padding: '10px 14px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 13, fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: '#ff3008', color: '#fff', boxShadow: '0 4px 16px rgba(255,48,8,0.3)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Signing in…</>
              ) : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-3)', marginTop: 20 }}>
            Don't have an account?{' '}
            <Link href="/auth/signup" style={{ color: '#ff3008', fontWeight: 700, textDecoration: 'none' }}>Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}