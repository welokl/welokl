'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import type { User as UserType } from '@/types'
import { DwarparLogo } from '@/components/DwarparLogo'

const ROLE_DASH: Record<string, string> = {
  customer:         '/dashboard/customer',
  business:         '/dashboard/business',
  delivery_partner: '/dashboard/delivery',
  admin:            '/dashboard/admin',
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Navbar() {
  const [user,      setUser]      = useState<UserType | null>(null)
  const [mounted,   setMounted]   = useState(false)
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [showDrop,  setShowDrop]  = useState(false)

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
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route navigation
  useEffect(() => { setMenuOpen(false) }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  const dashLink = user ? (ROLE_DASH[user.role] ?? '/dashboard/customer') : null
  const showCart = mounted && itemCount > 0 && (!user || user.role === 'customer')

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--divider, #eee)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        transition: 'box-shadow 200ms ease',
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.08)' : 'none',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 16px',
          height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
            <DwarparLogo height={27} />
          </Link>

          {/* Desktop right side */}
          <div className="nav-desktop-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Cart */}
            {showCart && (
              <Link href="/cart" style={{
                position: 'relative', width: 38, height: 38, borderRadius: 12,
                background: '#FF3008', display: 'flex', alignItems: 'center',
                justifyContent: 'center', textDecoration: 'none',
                transition: 'background 150ms ease, transform 100ms ease',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#CC2600')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FF3008')}
              >
                <svg viewBox="0 0 24 24" fill="none" width={19} height={19}>
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="2"/>
                  <path d="M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  minWidth: 18, height: 18, padding: '0 4px',
                  background: '#fff', border: '2px solid #FF3008',
                  borderRadius: 9999, fontSize: 10, fontWeight: 900,
                  color: '#FF3008', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', lineHeight: 1,
                }}>
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              </Link>
            )}

            {user ? (
              <div style={{ position: 'relative' }}>
                {/* Avatar button */}
                <button
                  onClick={() => setShowDrop(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px 6px 6px',
                    borderRadius: 12,
                    background: showDrop ? '#FFF0EC' : 'transparent',
                    border: '1.5px solid',
                    borderColor: showDrop ? '#FF3008' : 'var(--divider, #eee)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { if (!showDrop) { (e.currentTarget as HTMLButtonElement).style.background = '#f8f8f8' } }}
                  onMouseLeave={e => { if (!showDrop) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' } }}
                >
                  {/* Initials circle */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#FFF0EC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#FF3008',
                    flexShrink: 0,
                  }}>
                    {getInitials(user.name)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #111)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(user.name || '').split(' ')[0] || 'Account'}
                  </span>
                  {/* Chevron */}
                  <svg viewBox="0 0 12 12" fill="none" width={12} height={12} style={{ transform: showDrop ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', flexShrink: 0 }}>
                    <path d="M2 4l4 4 4-4" stroke="var(--text-muted,#888)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Dropdown */}
                {showDrop && (
                  <>
                    {/* Backdrop */}
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowDrop(false)} />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
                      background: 'var(--card-white, #fff)',
                      border: '1px solid var(--divider, #eee)',
                      borderRadius: 14,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      minWidth: 200,
                      overflow: 'hidden',
                      animation: 'ui-fadein 150ms ease',
                    }}>
                      {/* User info */}
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider, #eee)' }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary,#111)', margin: 0 }}>{user.name || 'User'}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted,#888)', margin: '2px 0 0' }}>{user.phone || user.email || ''}</p>
                      </div>
                      {/* Links */}
                      <div style={{ padding: '6px 0' }}>
                        <Link href={dashLink ?? '/dashboard/customer'}
                          onClick={() => setShowDrop(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', textDecoration: 'none', color: 'var(--text-primary,#111)', fontSize: 13, fontWeight: 700, transition: 'background 100ms' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8f8f8')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg viewBox="0 0 20 20" fill="none" width={16} height={16}><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>
                          Dashboard
                        </Link>
                        <button onClick={handleLogout}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg viewBox="0 0 20 20" fill="none" width={16} height={16}><path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l3-4-3-4M16 10H7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login"
                  style={{ padding: '8px 14px', borderRadius: 10, background: 'transparent', border: '1.5px solid var(--divider,#eee)', color: 'var(--text-primary,#111)', fontWeight: 700, fontSize: 13, textDecoration: 'none', transition: 'border-color 150ms, background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#ccc'; (e.currentTarget as HTMLAnchorElement).style.background = '#f8f8f8' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--divider,#eee)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  Sign in
                </Link>
                <Link href="/auth/signup"
                  style={{ padding: '8px 16px', borderRadius: 10, background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', boxShadow: '0 2px 10px rgba(255,48,8,0.25)', transition: 'background 150ms, box-shadow 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#CC2600' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FF3008' }}
                >
                  Sign up free
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display: 'none',
              flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              gap: menuOpen ? 0 : 4,
              width: 38, height: 38,
              background: 'none', border: 'none', cursor: 'pointer', padding: 8,
              borderRadius: 10,
            }}
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg viewBox="0 0 18 18" fill="none" width={18} height={18}>
                <path d="M2 2l14 14M16 2L2 16" stroke="var(--text-primary,#111)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <>
                <span style={{ width: 18, height: 2, background: 'var(--text-primary,#111)', borderRadius: 2, transition: 'all 150ms' }} />
                <span style={{ width: 14, height: 2, background: 'var(--text-primary,#111)', borderRadius: 2, transition: 'all 150ms' }} />
                <span style={{ width: 18, height: 2, background: 'var(--text-primary,#111)', borderRadius: 2, transition: 'all 150ms' }} />
              </>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{
            borderTop: '1px solid var(--divider, #eee)',
            background: 'var(--card-white, #fff)',
            padding: '8px 16px 16px',
            animation: 'ui-fadein 150ms ease',
          }}>
            {showCart && (
              <Link href="/cart" onClick={() => setMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', textDecoration: 'none', color: 'var(--text-primary,#111)', fontSize: 14, fontWeight: 700, borderBottom: '1px solid var(--divider,#eee)' }}>
                <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2"/><path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Cart · {itemCount} item{itemCount !== 1 ? 's' : ''}
              </Link>
            )}
            {user ? (
              <>
                <div style={{ padding: '12px 0 8px', borderBottom: '1px solid var(--divider,#eee)' }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary,#111)', margin: 0 }}>{user.name || 'User'}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted,#888)', margin: '2px 0 0' }}>{user.phone || user.email || ''}</p>
                </div>
                <Link href={dashLink ?? '/dashboard/customer'} onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '12px 0', textDecoration: 'none', color: 'var(--text-primary,#111)', fontSize: 14, fontWeight: 700, borderBottom: '1px solid var(--divider,#eee)' }}>
                  Dashboard
                </Link>
                <button onClick={handleLogout}
                  style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', textAlign: 'left' }}>
                  Sign out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '12px', borderRadius: 12, border: '1.5px solid var(--divider,#eee)', color: 'var(--text-primary,#111)', fontWeight: 700, fontSize: 14, textDecoration: 'none', textAlign: 'center' }}>
                  Sign in
                </Link>
                <Link href="/auth/signup" onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '12px', borderRadius: 12, background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', textAlign: 'center' }}>
                  Create free account
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Responsive: show hamburger on mobile, hide desktop items */}
      <style>{`
        @media (max-width: 640px) {
          .nav-desktop-right { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
