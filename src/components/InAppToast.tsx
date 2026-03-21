'use client'
import { useEffect, useState, useCallback } from 'react'

interface ToastData {
  title: string
  body?: string
  color?: string
  icon?: string
  id: number
}

export default function InAppToast() {
  const [toast, setToast] = useState<ToastData | null>(null)
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  const dismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => setToast(null), 320)
  }, [])

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as Omit<ToastData, 'id'>
      setToast({ ...detail, id: Date.now() })
      setProgress(100)
      setVisible(true)
      try { if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 300]) } catch {}
    }
    window.addEventListener('welokl-toast', handler)
    return () => window.removeEventListener('welokl-toast', handler)
  }, [])

  useEffect(() => {
    if (!visible || !toast) return
    const DURATION = 5500
    const start = Date.now()
    const iv = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(pct)
      if (elapsed >= DURATION) {
        clearInterval(iv)
        dismiss()
      }
    }, 40)
    return () => clearInterval(iv)
  }, [toast?.id, visible]) // eslint-disable-line

  if (!toast) return null

  const accentColor = toast.color || '#FF3008'

  return (
    <>
      <style>{`
        @keyframes wt-in  { from { opacity:0; transform:translateX(-50%) translateY(-18px) scale(.95) } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1) } }
        @keyframes wt-out { from { opacity:1; transform:translateX(-50%) translateY(0) scale(1) } to { opacity:0; transform:translateX(-50%) translateY(-14px) scale(.96) } }
      `}</style>
      <div
        onClick={dismiss}
        style={{
          position: 'fixed',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          maxWidth: 'min(440px, 92vw)',
          width: '92vw',
          background: 'rgba(12,12,14,0.93)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderRadius: 20,
          boxShadow: '0 12px 48px rgba(0,0,0,.45), 0 2px 0 rgba(255,255,255,.06) inset',
          overflow: 'hidden',
          cursor: 'pointer',
          animation: visible ? 'wt-in .28s cubic-bezier(.34,1.3,.64,1) forwards' : 'wt-out .28s ease forwards',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: `linear-gradient(180deg, ${accentColor}, ${accentColor}99)`,
          borderRadius: '0 0 0 0',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 14px 20px' }}>
          {toast.icon && (
            <div style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              background: `${accentColor}22`,
              border: `1.5px solid ${accentColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {toast.icon}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: toast.body ? 3 : 0, letterSpacing: '-0.01em' }}>
              {toast.title}
            </p>
            {toast.body && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', fontWeight: 500, lineHeight: 1.4 }}>
                {toast.body}
              </p>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,.07)' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}bb)`,
            transition: 'width 40ms linear',
            borderRadius: '0 2px 2px 0',
          }} />
        </div>
      </div>
    </>
  )
}
