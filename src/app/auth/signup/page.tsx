'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const roles = [
  { id: 'customer', icon: '🛍️', title: 'Customer', desc: 'Shop & order from local stores' },
  { id: 'business', icon: '🏪', title: 'Business', desc: 'List your shop & accept orders' },
  { id: 'delivery', icon: '🛵', title: 'Rider', desc: 'Deliver & earn per order' },
]

function SignupForm() {
  const params = useSearchParams()
  const defaultRole = params.get('role') || 'customer'
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [password, setPwd]    = useState('')
  const [role, setRole]       = useState(defaultRole)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || phone.replace(/\D/g,'').length < 10) {
      setError('Please enter a valid 10-digit phone number'); return
    }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role, phone } },
    })
    if (authError) {
      setError(authError.message.includes('already registered') ? 'Email already registered. Please sign in.' : authError.message)
      setLoading(false); return
    }
    if (!data.user) { setError('Signup failed — please try again'); setLoading(false); return }

    await supabase.from('users').upsert({ id: data.user.id, name, email, role, phone }, { onConflict: 'id' })
    await supabase.from('wallets').upsert({ user_id: data.user.id, balance: 0, total_earned: 0 }, { onConflict: 'user_id' })
    if (role === 'delivery') {
      await supabase.from('delivery_partners').upsert({ user_id: data.user.id, is_online: false, total_deliveries: 0 }, { onConflict: 'user_id' })
    }
    window.location.href = `/dashboard/${role}`
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border-2)',
    background: 'var(--input-bg)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left panel — desktop only */}
      <div style={{ display: 'none', width: '42%', background: '#0a0a0a', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', position: 'relative', overflow: 'hidden' }}
        className="auth-left-panel">
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '48px 48px' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 280, height: 280, borderRadius: '50%', background: '#ff3008', opacity: 0.12, filter: 'blur(60px)' }} />
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', position: 'relative' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ff3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 18 }}>W</div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>welokl</span>
        </Link>
        <div style={{ position: 'relative' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Join the movement</p>
          <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 36, lineHeight: 1.15, marginBottom: 16 }}>Every shop.<br />One app.<br /><span style={{ color: '#ff3008' }}>Your city.</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: 1.6 }}>Welokl connects your neighbourhood shops to your doorstep.</p>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, position: 'relative' }}>Hyperlocal. Honest. Yours.</p>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 440, paddingTop: 8, paddingBottom: 32 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 32 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ff3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>W</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>welokl</span>
          </Link>

          <h1 style={{ fontWeight: 900, fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>Create account</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 28 }}>Free, takes 30 seconds</p>

          {/* Role selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>I want to join as</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {roles.map(r => (
                <button key={r.id} type="button" onClick={() => setRole(r.id)}
                  style={{ padding: '12px 8px', borderRadius: 12, border: `2px solid ${role === r.id ? '#ff3008' : 'var(--border-2)'}`,
                    background: role === r.id ? 'var(--brand-muted)' : 'var(--card-bg)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{r.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: role === r.id ? 'var(--brand)' : 'var(--text)' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Full name', type: 'text', val: name, set: setName, ph: 'Rahul Verma', req: true },
              { label: 'Email address', type: 'email', val: email, set: setEmail, ph: 'you@example.com', req: true },
            ].map(f => (
              <div key={f.label}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{f.label}</label>
                <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required={f.req} style={inputStyle}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#ff3008'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-2)'} />
              </div>
            ))}

            {/* Phone — REQUIRED */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                Phone number <span style={{ color: '#ff3008' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-3)', fontWeight: 700 }}>+91</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                  placeholder="9876543210" required maxLength={10} style={{ ...inputStyle, paddingLeft: 48 }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#ff3008'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-2)'} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Required for order updates and delivery coordination</p>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPwd(e.target.value)} placeholder="Min. 8 characters" required style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#ff3008'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-2)'} />
              {password.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: password.length > i * 2 + 2 ? (password.length >= 8 ? '#22c55e' : '#f59e0b') : 'var(--border-2)' }} />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, borderRadius: 10, padding: '10px 14px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 13, fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: '#ff3008', color: '#fff', boxShadow: '0 4px 16px rgba(255,48,8,0.3)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Creating account…' : `Join as ${roles.find(r => r.id === role)?.title} →`}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-3)', marginTop: 20 }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: '#ff3008', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ff3008', margin: '0 auto 12px', opacity: 0.6 }} />
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}