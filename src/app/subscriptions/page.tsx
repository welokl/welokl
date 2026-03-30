'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface Subscription {
  id: string
  status: 'active' | 'paused' | 'cancelled'
  delivery_address: string | null
  delivery_time: string | null
  pause_until: string | null
  created_at: string
  plan: { id: string; name: string; description: string | null; price: number; delivery_time: string } | null
  shop: { id: string; name: string; image_url: string | null; area: string } | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomerSubscriptions() {
  const router = useRouter()
  const [subs, setSubs]         = useState<Subscription[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')
  const [acting, setActing]     = useState<string | null>(null)
  const [pauseId, setPauseId]   = useState<string | null>(null)
  const [pauseDate, setPauseDate] = useState('')

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    setUserId(user.id)

    const { data } = await sb
      .from('customer_subscriptions')
      .select('*, plan:subscription_plans(id,name,description,price,delivery_time), shop:shops(id,name,image_url,area)')
      .eq('customer_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    setSubs((data ?? []) as Subscription[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function pauseSub(id: string, until: string) {
    if (!until) return
    setActing(id)
    const sb = createClient()
    await sb.from('customer_subscriptions').update({ status: 'paused', pause_until: until }).eq('id', id)
    setPauseId(null)
    setPauseDate('')
    load()
    setActing(null)
  }

  async function resumeSub(id: string) {
    setActing(id)
    const sb = createClient()
    await sb.from('customer_subscriptions').update({ status: 'active', pause_until: null }).eq('id', id)
    load()
    setActing(null)
  }

  async function cancelSub(id: string, shopName: string) {
    if (!confirm(`Cancel your subscription from ${shopName}? This cannot be undone.`)) return
    setActing(id)
    const sb = createClient()
    await sb.from('customer_subscriptions').update({ status: 'cancelled' }).eq('id', id)
    load()
    setActing(null)
  }

  const active = subs.filter(s => s.status === 'active')
  const paused = subs.filter(s => s.status === 'paused')

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 100, height: 18, borderRadius: 6, background: 'var(--chip-bg)', animation: 'pulse 1.5s infinite' }} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 120, borderRadius: 18, background: 'var(--chip-bg)', animation: 'pulse 1.5s infinite', marginBottom: 12 }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-white)', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--page-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <h1 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', flex: 1 }}>My Subscriptions</h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--chip-bg)', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
            {active.length} active
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '16px 16px 0' }}>

        {subs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card-white)', borderRadius: 24, border: '1px solid var(--divider)', marginTop: 8 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,48,8,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 30 }}>🔁</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>No subscriptions yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Subscribe to daily milk, eggs, tiffin and more from local shops. Never run out again.
            </p>
            <Link href="/dashboard/customer" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: 14, background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(255,48,8,.3)' }}>
              Browse shops
            </Link>
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingLeft: 2 }}>Active ({active.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {active.map(s => (
                    <SubCard key={s.id} sub={s} acting={acting} pauseId={pauseId} pauseDate={pauseDate}
                      setPauseId={setPauseId} setPauseDate={setPauseDate}
                      onPause={pauseSub} onResume={resumeSub} onCancel={cancelSub} />
                  ))}
                </div>
              </div>
            )}

            {/* Paused */}
            {paused.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingLeft: 2 }}>Paused ({paused.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {paused.map(s => (
                    <SubCard key={s.id} sub={s} acting={acting} pauseId={pauseId} pauseDate={pauseDate}
                      setPauseId={setPauseId} setPauseDate={setPauseDate}
                      onPause={pauseSub} onResume={resumeSub} onCancel={cancelSub} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav active="account" />
    </div>
  )
}

function SubCard({ sub, acting, pauseId, pauseDate, setPauseId, setPauseDate, onPause, onResume, onCancel }: {
  sub: Subscription
  acting: string | null
  pauseId: string | null
  pauseDate: string
  setPauseId: (id: string | null) => void
  setPauseDate: (d: string) => void
  onPause: (id: string, until: string) => void
  onResume: (id: string) => void
  onCancel: (id: string, shopName: string) => void
}) {
  const isActive = sub.status === 'active'
  const isPaused = sub.status === 'paused'
  const isActing = acting === sub.id
  const showPauseForm = pauseId === sub.id

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <div style={{ background: 'var(--card-white)', borderRadius: 20, border: `1.5px solid ${isPaused ? 'var(--divider)' : 'var(--divider)'}`, overflow: 'hidden', opacity: isPaused ? 0.8 : 1 }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Shop + plan */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {sub.shop?.image_url ? (
            <img src={sub.shop.image_url} alt={sub.shop.name} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,48,8,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🏪</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 1 }}>{sub.plan?.name}</p>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: isActive ? 'rgba(22,163,74,.1)' : 'rgba(245,158,11,.1)', color: isActive ? '#16a34a' : '#d97706' }}>
                {isActive ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.shop?.name} · {sub.shop?.area}</p>
          </div>
          <p style={{ fontWeight: 900, fontSize: 16, color: '#FF3008', flexShrink: 0 }}>₹{sub.plan?.price}/day</p>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          {(sub.delivery_time || sub.plan?.delivery_time) && (
            <span style={{ background: 'var(--chip-bg)', padding: '3px 10px', borderRadius: 999 }}>
              🕐 Delivery by {sub.delivery_time || sub.plan?.delivery_time}
            </span>
          )}
          {sub.delivery_address && (
            <span style={{ background: 'var(--chip-bg)', padding: '3px 10px', borderRadius: 999, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              📍 {sub.delivery_address}
            </span>
          )}
          <span style={{ background: 'var(--chip-bg)', padding: '3px 10px', borderRadius: 999 }}>
            Since {fmtDate(sub.created_at)}
          </span>
        </div>

        {isPaused && sub.pause_until && (
          <p style={{ fontSize: 12, color: '#d97706', fontWeight: 700, marginTop: 8 }}>
            ⏸ Paused until {fmtDate(sub.pause_until)}
          </p>
        )}
      </div>

      {/* Pause form */}
      {showPauseForm && (
        <div style={{ padding: '12px 18px', background: 'rgba(245,158,11,.06)', borderTop: '1px solid rgba(245,158,11,.2)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginBottom: 10 }}>Pause until when?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="date" value={pauseDate} min={minDate} onChange={e => setPauseDate(e.target.value)}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(245,158,11,.4)', background: 'var(--card-white)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={() => onPause(sub.id, pauseDate)} disabled={!pauseDate || isActing}
              style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: pauseDate ? '#d97706' : 'var(--chip-bg)', color: pauseDate ? '#fff' : 'var(--text-muted)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {isActing ? '…' : 'Pause'}
            </button>
            <button onClick={() => setPauseId(null)} style={{ padding: '9px 12px', borderRadius: 10, border: 'none', background: 'var(--chip-bg)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--divider)' }}>
        {isActive && (
          <button onClick={() => setPauseId(sub.id)} disabled={isActing}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', fontWeight: 700, fontSize: 13, color: '#d97706', cursor: 'pointer', fontFamily: 'inherit', borderRight: '1px solid var(--divider)' }}>
            ⏸ Pause
          </button>
        )}
        {isPaused && (
          <button onClick={() => onResume(sub.id)} disabled={isActing}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', fontWeight: 700, fontSize: 13, color: '#16a34a', cursor: 'pointer', fontFamily: 'inherit', borderRight: '1px solid var(--divider)' }}>
            {isActing ? '…' : '▶ Resume'}
          </button>
        )}
        <button onClick={() => onCancel(sub.id, sub.shop?.name ?? 'this shop')} disabled={isActing}
          style={{ flex: 1, padding: '12px', border: 'none', background: 'none', fontWeight: 700, fontSize: 13, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
