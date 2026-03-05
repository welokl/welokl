'use client'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = (localStorage.getItem('welokl_theme') as Theme) || 'system'
    setTheme(saved)
    const dark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(dark)

    // Listen for system changes when in 'system' mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if ((localStorage.getItem('welokl_theme') || 'system') === 'system') {
        applyTheme(e.matches ? 'dark' : 'light')
        setIsDark(e.matches)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function applyTheme(effective: 'light' | 'dark') {
    // Brief transition class for smooth swap
    document.documentElement.classList.add('theme-ready')
    if (effective === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    setTimeout(() => document.documentElement.classList.remove('theme-ready'), 300)
  }

  function toggle() {
    const next: Theme = isDark ? 'light' : 'dark'
    setTheme(next)
    setIsDark(next === 'dark')
    localStorage.setItem('welokl_theme', next)
    applyTheme(next)
  }

  if (!mounted) {
    // Placeholder same size to prevent layout shift
    return <div style={{ width: 36, height: 36 }} />
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: '1px solid var(--border-2)',
        background: 'var(--bg-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
        fontSize: 16,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-4)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-3)')}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}