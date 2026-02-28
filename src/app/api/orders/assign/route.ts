import { NextRequest, NextResponse } from 'next/server'
import { assignNearestPartner } from '@/lib/matching'

export async function POST(req: NextRequest) {
  try {
    const { orderId, shopLat, shopLng } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const partnerId = await assignNearestPartner(orderId, shopLat || 19.076, shopLng || 72.877)
    return NextResponse.json({ partnerId, assigned: !!partnerId })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Assignment failed' }, { status: 500 })
  }
}
