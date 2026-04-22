'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [ready,     setReady]     = useState(false)
  const [msg,       setMsg]       = useState<{text:string;type:'error'|'success'}|null>(null)

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash
    // When the page loads, getSession() picks it up automatically
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else setMsg({ text: 'Invalid or expired reset link. Please request a new one.', type:'error' })
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setMsg({ text: 'Passwords do not match', type:'error' }); return }
    if (password.length < 6)  { setMsg({ text: 'Password must be at least 6 characters', type:'error' }); return }

    setLoading(true)
    setMsg(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMsg({ text: error.message, type:'error' })
      setLoading(false)
    } else {
      setMsg({ text: 'Password updated! Redirecting…', type:'success' })
      setTimeout(() => router.push('/dashboard/customer'), 1500)
    }
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'12px 14px', borderRadius:14,
    border:'1.5px solid var(--divider)', background:'var(--input-bg)',
    color:'var(--text-primary)', fontSize:15, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box',
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <Link href="/" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:10 }}>
            <div style={{ width:44, height:44, background:'#FF3008', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontWeight:900, fontSize:22, color:'var(--text-primary)', letterSpacing:'-0.03em' }}>dwarpar</span>
          </Link>
        </div>

        <div style={{ background:'var(--card-white)', borderRadius:24, padding:28, boxShadow:'0 4px 24px rgba(0,0,0,.06)' }}>
          <h1 style={{ fontWeight:900, fontSize:20, color:'var(--text-primary)', marginBottom:6 }}>Set new password</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>Choose a strong password for your account.</p>

          {msg && (
            <div style={{ padding:'12px 14px', borderRadius:12, marginBottom:16, background: msg.type==='success' ? 'var(--green-light)' : 'var(--error-light)', color: msg.type==='success' ? '#16a34a' : '#ef4444', fontSize:13, fontWeight:600 }}>
              {msg.text}
            </div>
          )}

          {ready && (
            <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>New password</label>
                <div style={{ position:'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters" required style={{ ...inp, paddingRight:44 }}
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

              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Confirm password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Same password again" required style={inp}
                  onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                  onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
                />
              </div>

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:loading?'var(--chip-bg)':'#FF3008', color:loading?'var(--text-muted)':'#fff', fontWeight:900, fontSize:16, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:loading?'none':'0 8px 24px rgba(255,48,8,.3)' }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          {!ready && !msg && (
            <p style={{ color:'var(--text-muted)', fontSize:14, textAlign:'center' }}>Verifying reset link…</p>
          )}

          <p style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)', marginTop:20 }}>
            <Link href="/auth/login" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}