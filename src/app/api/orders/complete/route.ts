import { NextRequest, NextResponse } from 'next/server'
import { creditPartnerWallet } from '@/lib/matching'
import { PARTNER_PAYOUT } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { orderId, partnerId } = await req.json()
    if (!orderId || !partnerId) return NextResponse.json({ error: 'orderId and partnerId required' }, { status: 400 })

    await creditPartnerWallet(partnerId, orderId, PARTNER_PAYOUT)
    return NextResponse.json({ success: true, amount: PARTNER_PAYOUT })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Completion failed' }, { status: 500 })
  }
}
