import { NextRequest, NextResponse } from 'next/server'
import { assignNearestPartner } from '@/lib/matching'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // A01 — verify caller is authenticated
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // A01 — verify caller is a shopkeeper or admin (not a customer/delivery partner)
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!profile || !['shopkeeper', 'business', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId, shopLat, shopLng } = await req.json()
    if (!orderId || typeof orderId !== 'string' || orderId.length > 100) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }

    // A01 — verify the order belongs to a shop owned by this user (unless admin)
    if (profile.role !== 'admin') {
      const { data: order } = await admin
        .from('orders')
        .select('shop_id, shops!inner(owner_id)')
        .eq('id', orderId)
        .single()
      if (!order || (order.shops as any)?.owner_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const result = await assignNearestPartner(
      orderId,
      typeof shopLat === 'number' ? shopLat : 19.076,
      typeof shopLng === 'number' ? shopLng : 72.877
    )

    return NextResponse.json({
      partnerId: result.partnerId,
      assigned: !!result.partnerId,
      reason: result.reason
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Assignment failed' }, { status: 500 })
  }
}
