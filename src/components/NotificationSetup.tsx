'use client'
// NotificationSetup.tsx — Rapido-style full bottom-sheet notification permission prompt
import { useEffect, useState } from 'react'
import { useFCM } from '@/hooks/useFCM'

export default function NotificationSetup({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [dismissed, setDismissed] = useState(false)

  useFCM(userId)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('dwarpar_notif_dismissed')) { setDismissed(true); return }
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') { setStatus('granted'); return }
    if (Notification.permission === 'denied')  { setStatus('denied');  return }
    const t = setTimeout(() => setStatus('asking'), 2000)
    return () => clearTimeout(t)
  }, [userId])

  function dismiss() {
    localStorage.setItem('dwarpar_notif_dismissed', '1')
    setDismissed(true)
  }

  async function allow() {
    const result = await Notification.requestPermission()
    setStatus(result === 'granted' ? 'granted' : 'denied')
    if (result !== 'granted') dismiss()
    else setDismissed(true)
  }

  if (dismissed || status !== 'asking') return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'32px 24px 40px', width:'100%', maxWidth:480, boxShadow:'0 -8px 40px rgba(0,0,0,.18)' }}>

        {/* Icon + brand */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:72, height:72, borderRadius:22, background:'#FFF0EE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 4px 20px rgba(255,48,8,.15)' }}>
            <span style={{ fontSize:36 }}>🔔</span>
          </div>
          <h2 style={{ fontWeight:900, fontSize:20, color:'#111', marginBottom:6, letterSpacing:'-0.03em' }}>Stay in the loop</h2>
          <p style={{ fontSize:14, color:'#888', lineHeight:1.6, maxWidth:300, margin:'0 auto' }}>
            Get real-time updates when your order is accepted, out for delivery, and delivered
          </p>
        </div>

        {/* Benefit bullets */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
          {[
            { icon:'✅', text:'Order confirmed by the shop' },
            { icon:'🛵', text:'Rider picked up your order' },
            { icon:'🎉', text:'Your order has arrived' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#fafaf9', borderRadius:14, border:'1px solid #f0eeec' }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
              <p style={{ fontSize:14, fontWeight:600, color:'#333' }}>{text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={allow}
          style={{ width:'100%', padding:'16px', borderRadius:18, border:'none', background:'#FF3008', color:'#fff', fontWeight:900, fontSize:16, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 6px 24px rgba(255,48,8,.35)', marginBottom:10 }}>
          Allow Notifications
        </button>
        <button onClick={dismiss}
          style={{ width:'100%', padding:'12px', borderRadius:16, border:'none', background:'none', color:'#aaa', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
          Not now
        </button>
      </div>
    </div>
  )
}
