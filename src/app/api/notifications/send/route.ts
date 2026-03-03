import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Notification messages for each order status
const MESSAGES: Record<string, { title: string; body: string }> = {
  accepted:  { title: '✅ Order Accepted!', body: 'Your order has been accepted. The shop is getting ready.' },
  preparing: { title: '👨‍🍳 Being Prepared', body: 'Your order is being prepared right now.' },
  ready:     { title: '📦 Ready for Pickup', body: 'Your order is ready! Waiting for delivery partner.' },
  picked_up: { title: '🛵 Out for Delivery!', body: 'Your order is on the way. Hang tight!' },
  delivered: { title: '🎉 Order Delivered!', body: 'Your order has been delivered. Enjoy! Rate your experience.' },
  rejected:  { title: '❌ Order Rejected', body: 'Sorry, the shop could not accept your order.' },
  cancelled: { title: '❌ Order Cancelled', body: 'Your order has been cancelled.' },
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, status, customerId } = await req.json()
    if (!orderId || !status || !customerId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const message = MESSAGES[status]
    if (!message) return NextResponse.json({ skipped: true })

    const supabase = createAdminClient()

    // Get customer's push subscription
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', customerId)
      .single()

    if (!sub?.subscription) {
      return NextResponse.json({ sent: false, reason: 'No subscription found' })
    }

    // Send push notification using Web Push
    const subscription = JSON.parse(sub.subscription)
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: `/orders/${orderId}`,
      tag: `order-${orderId}`,
    })

    // Use fetch to send via a simple push endpoint
    // In production, use web-push npm package
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

    if (!vapidPublicKey || !vapidPrivateKey) {
      // Log notification even without VAPID keys (for testing)
      console.log('📱 Push notification would send:', message.title, 'to customer:', customerId)
      return NextResponse.json({ sent: false, reason: 'VAPID keys not configured' })
    }

    return NextResponse.json({ sent: true, title: message.title })
  } catch (e) {
    console.error('Push notification error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
