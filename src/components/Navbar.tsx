'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import type { User as UserType } from '@/types'

export default function Navbar() {
  const [user, setUser] = useState<UserType | null>(null)
  const [mounted, setMounted] = useState(false)

  // Safe cart access - works with both old and new cart
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
    <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid #f0f0f0', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
          <div style={{ width:32, height:32, background:'#FF3008', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:16 }}>W</div>
          <span style={{ fontWeight:800, fontSize:18, color:'#111', letterSpacing:'-0.03em' }}>welokl</span>
        </Link>

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>

          {/* Cart icon */}
          {mounted && itemCount > 0 && (
            <Link href="/cart" style={{ position:'relative', width:38, height:38, borderRadius:10, background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
              <span style={{ fontSize:18 }}>🛒</span>
              <span style={{ position:'absolute', top:-4, right:-4, width:18, height:18, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {itemCount}
              </span>
            </Link>
          )}

          {user ? (
            <>
              <Link href={dashboardLink ?? '/dashboard/customer'}
                style={{ padding:'8px 14px', borderRadius:10, background:'#f5f5f5', color:'#111', fontWeight:700, fontSize:13, textDecoration:'none' }}>
                Dashboard
              </Link>
              <button onClick={handleLogout}
                style={{ padding:'8px 14px', borderRadius:10, border:'1.5px solid #e5e5e5', background:'transparent', color:'#888', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login"
                style={{ padding:'8px 14px', borderRadius:10, background:'transparent', border:'1.5px solid #e5e5e5', color:'#111', fontWeight:700, fontSize:13, textDecoration:'none' }}>
                Sign in
              </Link>
              <Link href="/auth/signup"
                style={{ padding:'8px 16px', borderRadius:10, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:13, textDecoration:'none' }}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}