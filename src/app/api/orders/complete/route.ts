import { NextRequest, NextResponse } from 'next/server'
import { creditPartnerWallet } from '@/lib/matching'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { PARTNER_PAYOUT } from '@/types'

export async function POST(req: NextRequest) {
  try {
    // A01 — verify caller is authenticated
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // A01 — caller must be a delivery partner or admin
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!profile || !['delivery_partner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await req.json()
    if (!orderId || typeof orderId !== 'string' || orderId.length > 100) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }

    // A04 — derive partnerId from verified session, NOT from request body
    // This prevents an attacker from supplying an arbitrary partnerId
    const partnerId = user.id

    // Verify the order is actually delivered and belongs to this partner
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, status, delivery_partner_id')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'delivered') return NextResponse.json({ error: 'Order not delivered yet' }, { status: 400 })
    if (order.delivery_partner_id !== partnerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Idempotency: skip if already credited for this order
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'credit')
      .maybeSingle()

    if (existing) return NextResponse.json({ success: true, amount: 0, note: 'already_credited' })

    await creditPartnerWallet(partnerId, orderId, PARTNER_PAYOUT)
    return NextResponse.json({ success: true, amount: PARTNER_PAYOUT })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Completion failed' }, { status: 500 })
  }
}
