'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface Wallet {
  id: string; balance: number; total_earned: number; total_spent: number
}
interface Transaction {
  id: string; amount: number; type: 'credit' | 'debit'; description: string; created_at: string
}

export default function WalletPage() {
  const router = useRouter()
  const [wallet, setWallet]           = useState<Wallet | null>(null)
  const [txns, setTxns]               = useState<Transaction[]>([])
  const [loading, setLoading]         = useState(true)
  const [userId, setUserId]           = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      setUserId(user.id)

      // Get or create wallet
      let { data: w } = await sb.from('wallets').select('*').eq('user_id', user.id).single()
      if (!w) {
        const { data: newW } = await sb.from('wallets').insert({ user_id: user.id, balance: 0, total_earned: 0, total_spent: 0 }).select().single()
        w = newW
      }
      setWallet(w)

      // Get transactions
      const { data: t } = await sb.from('transactions')
        .select('*')
        .eq('wallet_id', w?.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setTxns(t || [])
    } catch (e) {
      console.error('[wallet] load error:', e)
    } finally {
      setLoading(false)
    }
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', flex: 1 }}>Welokl Wallet</h1>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>

        {/* Balance card */}
        <div style={{ background: 'linear-gradient(135deg, #FF3008, #FF6B00)', borderRadius: 24, padding: '28px 24px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.75)', marginBottom: 8 }}>Available balance</p>
          {loading ? (
            <div style={{ height: 44, width: 120, borderRadius: 10, background: 'rgba(255,255,255,.2)' }} />
          ) : (
            <p style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', marginBottom: 4 }}>₹{wallet?.balance?.toFixed(2) || '0.00'}</p>
          )}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 8 }}>Use at checkout for instant discount</p>
        </div>

        {/* Stats row */}
        {wallet && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>Total earned</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>₹{(wallet.total_earned || 0).toFixed(0)}</p>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>Total spent</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#FF3008' }}>₹{(wallet.total_spent || 0).toFixed(0)}</p>
            </div>
          </div>
        )}

        {/* How to earn */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px', marginBottom: 24 }}>
          <p style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>💡 How to earn credits</p>
          {[
            { icon: '🎁', text: 'First order bonus', val: '₹20 credited' },
            { icon: '⭐', text: 'Leave a review', val: '₹5 per review' },
            { icon: '👫', text: 'Refer a friend', val: '₹30 when they order' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{item.text}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', background: 'rgba(22,163,74,.1)', padding: '3px 10px', borderRadius: 8 }}>{item.val}</span>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <p style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>Transaction history</p>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 64, borderRadius: 14, background: 'var(--bg-3)' }} />)}
          </div>
        ) : txns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💳</div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>No transactions yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Place your first order to earn ₹20 credits!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txns.map(t => (
              <div key={t.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: t.type === 'credit' ? 'rgba(22,163,74,.1)' : 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {t.type === 'credit' ? '⬆️' : '⬇️'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{t.description}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeAgo(t.created_at)}</p>
                </div>
                <span style={{ fontWeight: 900, fontSize: 15, color: t.type === 'credit' ? '#16a34a' : '#ef4444' }}>
                  {t.type === 'credit' ? '+' : '-'}₹{Math.abs(t.amount).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav active="account" />
    </div>
  )
}