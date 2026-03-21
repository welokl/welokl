'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── PhoneGate — forces existing users to add phone number ────
export function PhoneGate({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function isValid(p: string) {
    const d = p.replace(/\D/g,'')
    return d.length === 10 && /^[6-9]/.test(d)
  }

  async function save() {
    if (!isValid(phone)) { setErr('Enter a valid 10-digit Indian mobile number'); return }
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('users').update({ phone: phone.replace(/\D/g,'') }).eq('id', userId)
    if (error) { setErr(error.message); setSaving(false); return }
    onDone()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background:'var(--card-bg)', borderRadius:24, padding:32, maxWidth:380, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,.2)' }}>
        <div style={{ width:56, height:56, borderRadius:18, background:'rgba(255,48,8,.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
          <svg viewBox="0 0 24 24" fill="none" width={26} height={26}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h2 style={{ fontWeight:900, fontSize:20, color:'var(--text)', marginBottom:8, letterSpacing:'-0.02em' }}>Add your mobile number</h2>
        <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6, marginBottom:24 }}>
          We need your phone number for order updates and delivery coordination. This is required to continue.
        </p>

        {err && <p style={{ fontSize:13, color:'#ef4444', fontWeight:600, marginBottom:12 }}>{err}</p>}

        <div style={{ position:'relative', marginBottom:16 }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--text-2)', fontWeight:600, pointerEvents:'none' }}>+91</span>
          <input
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value.replace(/\D/g,'').slice(0,10)); setErr('') }}
            placeholder="98765 43210"
            maxLength={10}
            autoFocus
            style={{ width:'100%', padding:'13px 14px 13px 50px', borderRadius:14, border:'1.5px solid var(--border)', background:'var(--input-bg)', color:'var(--text)', fontSize:15, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
            onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        </div>

        <button onClick={save} disabled={saving}
          style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:saving?'var(--bg-3)':'#FF3008', color:saving?'var(--text-3)':'#fff', fontWeight:900, fontSize:15, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:saving?'none':'0 8px 24px rgba(255,48,8,.3)', transition:'all .2s' }}>
          {saving ? 'Saving…' : 'Save and continue'}
        </button>
      </div>
    </div>
  )
}