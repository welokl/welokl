'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    const role = data.user.user_metadata?.role || 'customer'
    window.location.href = `/dashboard/${role}`
  }

  return (
    <div className="min-h-screen bg-[#fafaf7] flex">
      <div className="hidden lg:flex w-1/2 bg-[#0a0a0a] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-brand-500 rounded-full opacity-20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center text-white font-black">W</div>
          <span className="font-display font-bold text-2xl text-white">welokl</span>
        </Link>
        <div className="relative">
          <p className="text-white/30 text-sm font-semibold tracking-widest uppercase mb-4">Welcome back</p>
          <h2 className="font-display text-4xl font-bold text-white leading-tight mb-6">Your neighbourhood<br />is waiting.</h2>
          <div className="space-y-3">
            {['500+ local shops near you', 'UPI & Cash on delivery', 'Live order tracking'].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/50 text-sm">
                <span className="text-brand-500">→</span> {f}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-white/20 text-xs">Hyperlocal. Honest. Yours.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-sm">W</div>
            <span className="font-display font-bold text-xl">welokl</span>
          </div>
          <h1 className="font-display text-3xl font-bold mb-1">Sign in</h1>
          <p className="text-gray-400 text-sm mb-8">Enter your credentials to continue</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-field" placeholder="••••••••" required autoComplete="current-password" />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-brand-500 font-semibold hover:text-brand-600">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
