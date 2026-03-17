'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import type { User as UserType } from '@/types'

// Welokl logo mark — location pin with W
function WelloklMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 52 52" fill="none" width={size} height={size}>
      <rect width="52" height="52" rx="15" fill="#FF3008"/>
      <path d="M26 11C19.9 11 15 15.9 15 22C15 30.2 26 43 26 43C26 43 37 30.2 37 22C37 15.9 32.1 11 26 11Z"
            stroke="white" strokeWidth="2" fill="rgba(255,255,255,0.18)"/>
      <path d="M20 21L22.8 28L26 23L29.2 28L32 21"
            stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Navbar() {
  const [user,    setUser]    = useState<UserType | null>(null)
  const [mounted, setMounted] = useState(false)

  let itemCount = 0
  try {
    const cart = useCartStore()
    itemCount = cart?.itemCount?.() ?? cart?.count?.() ?? 0
  } catch {}

  useEffect(() => {
    setMounted(true)
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await sb.from('users').select('*').eq('id', data.user.id).single()
        setUser(profile)
      }
    })
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  const dashboardLink = user ? ({
    customer:         '/dashboard/customer',
    business:         '/dashboard/business',
    delivery_partner: '/dashboard/delivery',
    admin:            '/dashboard/admin',
  } as Record<string,string>)[user.role] ?? '/dashboard/customer' : null

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255,255,255,.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--divider, #eee)',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <WelloklMark size={34} />
          <span style={{ fontWeight: 900, fontSize: 18, color: '#111', letterSpacing: '-0.03em', lineHeight: 1 }}>
            welokl
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Cart */}
          {mounted && itemCount > 0 && (
            <Link href="/cart" style={{ position: 'relative', width: 38, height: 38, borderRadius: 12, background: '#FF3008', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="2"/>
                <path d="M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, background: '#fff', border: '2px solid #FF3008', borderRadius: '50%', fontSize: 10, fontWeight: 900, color: '#FF3008', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            </Link>
          )}

          {user ? (
            <>
              <Link href={dashboardLink ?? '/dashboard/customer'}
                style={{ padding: '8px 14px', borderRadius: 12, background: '#F5F5F5', color: '#111', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                Dashboard
              </Link>
              <button onClick={handleLogout}
                style={{ padding: '8px 14px', borderRadius: 12, border: '1.5px solid #eee', background: 'transparent', color: '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login"
                style={{ padding: '8px 14px', borderRadius: 12, background: 'transparent', border: '1.5px solid #eee', color: '#111', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                Sign in
              </Link>
              <Link href="/auth/signup"
                style={{ padding: '8px 16px', borderRadius: 12, background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}