'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BusinessAnalytics from '@/components/BusinessAnalytics'

export default function BusinessSalesPage() {
  const router = useRouter()
  const [shopId, setShopId] = useState<string | null>(null)
  const [shopName, setShopName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: shop } = await sb.from('shops').select('id, name').eq('owner_id', user.id).single()
      if (!shop) { router.push('/dashboard/business'); return }
      setShopId(shop.id)
      setShopName(shop.name)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>Sales Analytics</h1>
            {shopName && <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{shopName}</p>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:12px;}`}</style>
            <div className="sk" style={{ height: 80 }} />
            <div className="sk" style={{ height: 200 }} />
            <div className="sk" style={{ height: 160 }} />
          </div>
        ) : shopId ? (
          <BusinessAnalytics shopId={shopId} />
        ) : null}
      </div>
    </div>
  )
}