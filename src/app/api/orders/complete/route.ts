import { NextRequest, NextResponse } from 'next/server'
import { creditPartnerWallet } from '@/lib/matching'
import { createAdminClient } from '@/lib/supabase/server'
import { PARTNER_PAYOUT } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { orderId, partnerId } = await req.json()
    if (!orderId || !partnerId) return NextResponse.json({ error: 'orderId and partnerId required' }, { status: 400 })

    const supabase = createAdminClient()

    // Verify the order is actually delivered and belongs to this partner
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status, delivery_partner_id')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'delivered') return NextResponse.json({ error: 'Order not delivered yet' }, { status: 400 })
    if (order.delivery_partner_id !== partnerId) return NextResponse.json({ error: 'Partner mismatch' }, { status: 403 })

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
