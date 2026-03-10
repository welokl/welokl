'use client'
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)  // default light
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('welokl_theme') as Theme | null
    const dark = saved === 'dark'  // only dark if explicitly chosen
    setIsDark(dark)
    applyTheme(dark ? 'dark' : 'light', false)
  }, [])

  function applyTheme(effective: 'light' | 'dark', animate = true) {
    if (animate) {
      document.documentElement.classList.add('theme-ready')
      setTimeout(() => document.documentElement.classList.remove('theme-ready'), 300)
    }
    if (effective === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggle() {
    const next: Theme = isDark ? 'light' : 'dark'
    setIsDark(next === 'dark')
    localStorage.setItem('welokl_theme', next)
    applyTheme(next)
  }

  if (!mounted) return <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-3)', flexShrink: 0 }} />

  return (
    <button onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background .15s, transform .1s', fontSize: 16 }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-3)')}
      onMouseDown={e  => (e.currentTarget.style.transform = 'scale(0.92)')}
      onMouseUp={e    => (e.currentTarget.style.transform = 'scale(1)')}>
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}