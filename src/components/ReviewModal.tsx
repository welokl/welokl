'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReviewModalProps {
  orderId: string
  shopId: string
  shopName: string
  deliveryPartnerId?: string
  onClose: () => void
}

export default function ReviewModal({ orderId, shopId, shopName, deliveryPartnerId, onClose }: ReviewModalProps) {
  const [shopRating, setShopRating] = useState(0)
  const [deliveryRating, setDeliveryRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submitReview() {
    if (shopRating === 0) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('reviews').upsert({
      order_id: orderId,
      customer_id: user.id,
      shop_id: shopId,
      delivery_partner_id: deliveryPartnerId || null,
      shop_rating: shopRating,
      delivery_rating: deliveryRating || null,
      comment: comment.trim() || null,
    }, { onConflict: 'order_id' })

    // Update shop average rating
    const { data: reviews } = await supabase
      .from('reviews')
      .select('shop_rating')
      .eq('shop_id', shopId)

    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.shop_rating, 0) / reviews.length
      await supabase.from('shops').update({ rating: Math.round(avg * 10) / 10 }).eq('id', shopId)
    }

    setDone(true)
    setLoading(false)
    setTimeout(onClose, 1500)
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-3">🙏</div>
          <h3 className="font-bold text-lg">Thanks for your feedback!</h3>
          <p className="text-gray-400 text-sm mt-1">Your review helps others make better choices.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-lg">Rate your order</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          {/* Shop rating */}
          <div className="mb-5">
            <p className="font-semibold text-sm mb-3">How was {shopName}?</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setShopRating(star)}
                  className={`text-3xl transition-all active:scale-90 ${star <= shopRating ? 'opacity-100' : 'opacity-30'}`}>
                  ⭐
                </button>
              ))}
            </div>
            <div className="text-center mt-2 text-sm text-gray-500">
              {shopRating === 1 ? 'Poor' : shopRating === 2 ? 'Fair' : shopRating === 3 ? 'Good' : shopRating === 4 ? 'Very Good' : shopRating === 5 ? 'Excellent!' : 'Tap to rate'}
            </div>
          </div>

          {/* Delivery rating */}
          {deliveryPartnerId && (
            <div className="mb-5">
              <p className="font-semibold text-sm mb-3">How was the delivery?</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setDeliveryRating(star)}
                    className={`text-3xl transition-all active:scale-90 ${star <= deliveryRating ? 'opacity-100' : 'opacity-30'}`}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comment */}
          <div className="mb-5">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="input-field resize-none text-sm"
              rows={3}
              placeholder="Tell us more about your experience... (optional)"
            />
          </div>

          {/* Quick tags */}
          <div className="flex flex-wrap gap-2 mb-5">
            {['Great taste!', 'Fast delivery', 'Good packaging', 'Fresh items', 'Value for money'].map(tag => (
              <button key={tag} onClick={() => setComment(prev => prev ? `${prev}, ${tag}` : tag)}
                className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-600 px-3 py-1.5 rounded-full transition-all font-medium">
                + {tag}
              </button>
            ))}
          </div>

          <button
            onClick={submitReview}
            disabled={shopRating === 0 || loading}
            className={`btn-primary w-full py-3 ${shopRating === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
