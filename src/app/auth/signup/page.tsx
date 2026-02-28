'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const roles = [
  { id: 'customer', icon: '🛍️', title: 'Customer', desc: 'Shop & order from local stores' },
  { id: 'business', icon: '🏪', title: 'Business Owner', desc: 'List your shop & accept orders' },
  { id: 'delivery', icon: '🛵', title: 'Delivery Partner', desc: 'Deliver & earn per order' },
]

export default function SignupPage() {
  const params = useSearchParams()
  const defaultRole = params.get('role') || 'customer'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(defaultRole)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, phone: phone || null } },
    })

    if (authError) {
      setError(authError.message.includes('already registered')
        ? 'Email already registered. Please sign in.'
        : authError.message)
      setLoading(false)
      return
    }

    if (!data.user) { setError('Signup failed — please try again'); setLoading(false); return }

    // Upsert handles duplicate key gracefully
    await supabase.from('users').upsert(
      { id: data.user.id, name, email, role, phone: phone || null },
      { onConflict: 'id' }
    )

    await supabase.from('wallets').upsert(
      { user_id: data.user.id, balance: 0, total_earned: 0 },
      { onConflict: 'user_id' }
    )

    if (role === 'delivery') {
      await supabase.from('delivery_partners').upsert(
        { user_id: data.user.id, is_online: false, total_deliveries: 0 },
        { onConflict: 'user_id' }
      )
    }

    window.location.href = `/dashboard/${role}`
  }

  return (
    <div className="min-h-screen bg-[#fafaf7] flex">
      <div className="hidden lg:flex w-5/12 bg-[#0a0a0a] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-brand-500 rounded-full opacity-15 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center text-white font-black">W</div>
          <span className="font-display font-bold text-2xl text-white">welokl</span>
        </Link>
        <div className="relative space-y-6">
          <p className="text-white/30 text-sm font-semibold tracking-widest uppercase">Join the movement</p>
          <h2 className="font-display text-4xl font-bold text-white leading-tight">Every shop.<br />One app.<br /><span className="text-brand-500">Your city.</span></h2>
          <p className="text-white/40 text-sm leading-relaxed">Welokl connects your neighbourhood shops to your doorstep.</p>
        </div>
        <p className="relative text-white/20 text-xs">Hyperlocal. Honest. Yours.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-sm">W</div>
            <span className="font-display font-bold text-xl">welokl</span>
          </div>

          <h1 className="font-display text-3xl font-bold mb-1">Create account</h1>
          <p className="text-gray-400 text-sm mb-8">It is free, takes 30 seconds</p>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">I want to join as</label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map(r => (
                <button key={r.id} type="button" onClick={() => setRole(r.id)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${role === r.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1">{r.icon}</div>
                  <div className="text-xs font-bold text-gray-800">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-tight hidden sm:block">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Rahul Verma" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min. 8 characters" required />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Creating account...' : `Join as ${roles.find(r => r.id === role)?.title} →`}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account? <Link href="/auth/login" className="text-brand-500 font-semibold hover:text-brand-600">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
