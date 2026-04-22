'use client'
// InstallPrompt.tsx
// Shows a native Android install prompt (beforeinstallprompt) or iOS "Add to Home Screen" guide.
// Dismissed state is stored in localStorage so it doesn't nag users.
import { useEffect, useState } from 'react'

type Platform = 'android' | 'ios' | 'other'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'other'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow]                     = useState(false)
  const [showIOS, setShowIOS]               = useState(false)
  const [platform, setPlatform]             = useState<Platform>('other')

  useEffect(() => {
    if (isStandalone()) return                              // already installed
    if (localStorage.getItem('dwarpar_install_dismissed')) return // user said no

    const p = detectPlatform()
    setPlatform(p)

    if (p === 'android') {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setShow(true)
      }
      window.addEventListener('beforeinstallprompt', handler as any)
      return () => window.removeEventListener('beforeinstallprompt', handler as any)
    }

    if (p === 'ios') {
      // Show iOS guide after a short delay so it doesn't pop immediately
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('dwarpar_install_dismissed', '1')
    setShow(false)
    setShowIOS(false)
  }

  async function installAndroid() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') localStorage.setItem('dwarpar_install_dismissed', '1')
    setDeferredPrompt(null)
    setShow(false)
  }

  if (!show) return null

  // ── iOS guide modal ────────────────────────────────────────────
  if (platform === 'ios') return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'flex-end', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480, boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/icons/icon-96.png" alt="Dwarpar" style={{ width:44, height:44, borderRadius:12 }} />
            <div>
              <p style={{ fontWeight:900, fontSize:16, color:'#111' }}>Install Dwarpar</p>
              <p style={{ fontSize:12, color:'#888' }}>Add to your home screen</p>
            </div>
          </div>
          <button onClick={dismiss} style={{ background:'#f5f5f5', border:'none', borderRadius:999, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, color:'#888' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
          {[
            { step:'1', icon:'⬆️', text: <>Tap the <strong>Share</strong> button at the bottom of Safari</> },
            { step:'2', icon:'📲', text: <>Scroll down and tap <strong>"Add to Home Screen"</strong></> },
            { step:'3', icon:'✅', text: <>Tap <strong>"Add"</strong> — Dwarpar will appear on your home screen like a real app</> },
          ].map(({ step, icon, text }) => (
            <div key={step} style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:32, height:32, borderRadius:999, background:'#FF3008', color:'#fff', fontWeight:900, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{step}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:6 }}>
                <span style={{ fontSize:20 }}>{icon}</span>
                <p style={{ fontSize:14, color:'#444', lineHeight:1.5 }}>{text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Arrow pointing at Safari share button */}
        <div style={{ background:'#FFF0EE', border:'1.5px solid rgba(255,48,8,.2)', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <span style={{ fontSize:20 }}>💡</span>
          <p style={{ fontSize:12, color:'#FF3008', fontWeight:700, lineHeight:1.5 }}>Look for the share icon (box with an arrow) in the Safari toolbar at the bottom of your screen.</p>
        </div>

        <button onClick={dismiss} style={{ width:'100%', padding:'14px', borderRadius:16, border:'1.5px solid #eee', background:'#f8f8f8', color:'#888', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
          Maybe later
        </button>
      </div>
    </div>
  )

  // ── Android native banner ──────────────────────────────────────
  return (
    <div style={{ position:'fixed', bottom:'calc(72px + env(safe-area-inset-bottom, 0px) + 12px)', left:12, right:12, zIndex:9999, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'14px 16px', boxShadow:'0 8px 32px rgba(0,0,0,.18)', border:'1px solid #f0f0f0', display:'flex', alignItems:'center', gap:12 }}>
        <img src="/icons/icon-96.png" alt="Dwarpar" style={{ width:44, height:44, borderRadius:12, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontWeight:900, fontSize:14, color:'#111', marginBottom:1 }}>Install Dwarpar</p>
          <p style={{ fontSize:12, color:'#888', lineHeight:1.4 }}>Add to home screen for the full app experience</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
          <button onClick={installAndroid}
            style={{ padding:'8px 16px', borderRadius:12, border:'none', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
            Install
          </button>
          <button onClick={dismiss}
            style={{ padding:'6px 16px', borderRadius:12, border:'none', background:'#f5f5f5', color:'#999', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
