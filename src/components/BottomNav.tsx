// src/components/BottomNav.tsx
// 5-tab nav: Home, Search, Shops, Orders, Account
'use client'
import Link from 'next/link'

type NavTab = 'home' | 'shops' | 'search' | 'orders' | 'account'

const NAV_ITEMS = [
  {
    id: 'home' as NavTab,
    label: 'Home',
    href: '/dashboard/customer',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          stroke={active ? '#FF3008' : 'currentColor'}
          fill={active ? 'rgba(255,48,8,.12)' : 'none'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'search' as NavTab,
    label: 'Search',
    href: '/search',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
        <circle cx="11" cy="11" r="8"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2"/>
        <path d="m21 21-4.35-4.35"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'shops' as NavTab,
    label: 'Shops',
    href: '/stores',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
        <path d="M3 3h18v4H3z"
          stroke={active ? '#FF3008' : 'currentColor'}
          fill={active ? 'rgba(255,48,8,.12)' : 'none'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 7v11a2 2 0 002 2h10a2 2 0 002-2V7"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 12h4"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'orders' as NavTab,
    label: 'Orders',
    href: '/orders/history',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round"/>
        <rect x="9" y="3" width="6" height="4" rx="2"
          stroke={active ? '#FF3008' : 'currentColor'}
          fill={active ? 'rgba(255,48,8,.12)' : 'none'}
          strokeWidth="2"/>
        <path d="M9 12h6M9 16h4"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'account' as NavTab,
    label: 'Account',
    href: '/profile',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
          stroke={active ? '#FF3008' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="7" r="4"
          stroke={active ? '#FF3008' : 'currentColor'}
          fill={active ? 'rgba(255,48,8,.12)' : 'none'}
          strokeWidth="2"/>
      </svg>
    ),
  },
]

export default function BottomNav({ active }: { active: NavTab }) {
  const resolvedActive = active

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--card-white)',
      borderTop: '1px solid var(--divider)',
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', maxWidth: 480, margin: '0 auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.id === resolvedActive
          return (
            <Link key={item.id} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, flex: 1, padding: '8px 4px',
              textDecoration: 'none',
              color: isActive ? '#FF3008' : 'var(--text-muted)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              {item.icon(isActive)}
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.01em' }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}