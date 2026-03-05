'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check saved preference first, then system preference
    const saved = localStorage.getItem('welokl_theme')
    if (saved === 'dark') {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else if (saved === 'light') {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    } else {
      // Auto-detect system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(prefersDark)
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('welokl_theme', next ? 'dark' : 'light')
  }

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) return <div className="w-9 h-9" />

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="text-lg select-none">
        {isDark ? '☀️' : '🌙'}
      </span>
    </button>
  )
}