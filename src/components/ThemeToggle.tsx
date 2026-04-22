'use client'
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export default function ThemeToggle() {
  const [isDark, setIsDark]     = useState(false)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('dwarpar_theme') as Theme | null
    const dark = saved === 'dark'
    setIsDark(dark)
    applyTheme(dark ? 'dark' : 'light', false)
  }, [])

  function applyTheme(theme: 'light' | 'dark', animate = true) {
    if (animate) {
      document.documentElement.style.transition = 'background .25s, color .25s'
      setTimeout(() => document.documentElement.style.transition = '', 300)
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggle() {
    const next: Theme = isDark ? 'light' : 'dark'
    setIsDark(next === 'dark')
    localStorage.setItem('dwarpar_theme', next)
    applyTheme(next)
  }

  if (!mounted) return <div style={{ width:36, height:36, borderRadius:10, background:'var(--bg-3)', flexShrink:0 }} />

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'background .15s' }}>
      {isDark ? (
        // Sun icon
        <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
          <circle cx="12" cy="12" r="5" stroke="#f59e0b" strokeWidth="2" fill="rgba(245,158,11,.2)"/>
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        // Moon icon
        <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            fill="rgba(100,100,120,.1)"/>
        </svg>
      )}
    </button>
  )
}