'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  orderId: string
  shopId: string
  shopName: string
  deliveryPartnerId: string | null
  onClose: () => void
}

export default function ReviewModal({ orderId, shopId, shopName, deliveryPartnerId, onClose }: Props) {
  const [shopRating, setShopRating]         = useState(0)
  const [deliveryRating, setDeliveryRating] = useState(0)
  const [comment, setComment]               = useState('')
  const [loading, setLoading]               = useState(false)
  const [done, setDone]                     = useState(false)

  async function submit() {
    if (!shopRating) return
    setLoading(true)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      await sb.from('reviews').upsert({
        order_id: orderId,
        shop_id: shopId,
        customer_id: user.id,
        shop_rating: shopRating,
        delivery_rating: deliveryRating || null,
        comment: comment.trim() || null,
      }, { onConflict: 'order_id' })

      // Update shop average rating
      const { data: reviews } = await sb.from('reviews').select('shop_rating').eq('shop_id', shopId)
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + (r.shop_rating || 0), 0) / reviews.length
        await sb.from('shops').update({ rating: Math.round(avg * 10) / 10 }).eq('id', shopId)
      }

      // Update delivery partner rating if applicable
      if (deliveryPartnerId && deliveryRating) {
        const { data: dReviews } = await sb.from('reviews').select('delivery_rating').eq('delivery_partner_id', deliveryPartnerId).not('delivery_rating', 'is', null)
        if (dReviews && dReviews.length > 0) {
          const davg = dReviews.reduce((s, r) => s + (r.delivery_rating || 0), 0) / dReviews.length
          await sb.from('delivery_partners').update({ rating: Math.round(davg * 10) / 10 }).eq('user_id', deliveryPartnerId)
        }
      }

      setDone(true)
      setTimeout(onClose, 1600)
    } catch (e) {
      console.error('[review] submit error:', e)
    } finally {
      setLoading(false)
    }
  }

  const Star = ({ n, val, set }: { n: number; val: number; set: (v: number) => void }) => (
    <button onClick={() => set(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 30, lineHeight: 1, filter: n <= val ? 'none' : 'grayscale(1) opacity(0.3)', transition: 'transform .1s', transform: n <= val ? 'scale(1.15)' : 'scale(1)' }}>
      ⭐
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>Thanks for the review!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-3)' }}>It helps local shops improve.</p>
          </div>
        ) : (
          <>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />

            <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>Rate your order</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>from {shopName}</p>

            {/* Shop rating */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 8 }}>Shop & food quality</p>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map(n => <Star key={n} n={n} val={shopRating} set={setShopRating} />)}
              </div>
              {shopRating > 0 && (
                <p style={{ fontSize: 12, color: '#FF3008', fontWeight: 700, marginTop: 4 }}>
                  {['','😞 Poor','😐 Average','🙂 Good','😊 Great','🤩 Excellent!'][shopRating]}
                </p>
              )}
            </div>

            {/* Delivery rating */}
            {deliveryPartnerId && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 8 }}>Delivery experience</p>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(n => <Star key={n} n={n} val={deliveryRating} set={setDeliveryRating} />)}
                </div>
              </div>
            )}

            {/* Comment */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 8 }}>Add a comment <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional)</span></p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="What did you like or dislike?"
                maxLength={300}
                rows={3}
                style={{ width: '100%', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Submit */}
            <button
              onClick={submit}
              disabled={!shopRating || loading}
              style={{ width: '100%', padding: '16px', borderRadius: 16, border: 'none', background: shopRating ? '#FF3008' : 'var(--bg-3)', color: shopRating ? '#fff' : 'var(--text-3)', fontWeight: 900, fontSize: 15, fontFamily: 'inherit', cursor: shopRating ? 'pointer' : 'not-allowed', transition: 'background .2s' }}
            >
              {loading ? 'Submitting…' : 'Submit Review'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}