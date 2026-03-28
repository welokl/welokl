import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Called by Vercel cron every 5 minutes.
// Also safe to call manually from admin or any server-side code.
export async function GET(req: NextRequest) {
  // Verify it's Vercel cron (or our own admin secret)
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Load all shops that have a schedule set
  const { data: shops, error } = await admin
    .from('shops')
    .select('id, is_open, opening_time, closing_time, manually_closed')
    .not('opening_time', 'is', null)
    .not('closing_time', 'is', null)

  if (error || !shops) return NextResponse.json({ error: error?.message }, { status: 500 })

  const now = new Date()
  // Use IST (UTC+5:30)
  const istOffset = 5.5 * 60
  const istNow = new Date(now.getTime() + istOffset * 60 * 1000)
  const curMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes()

  let updated = 0
  const updates: Promise<any>[] = []

  for (const shop of shops) {
    const [oh, om] = (shop.opening_time as string).split(':').map(Number)
    const [ch, cm] = (shop.closing_time as string).split(':').map(Number)
    const shouldBeOpen = curMinutes >= oh * 60 + om && curMinutes < ch * 60 + cm

    // Skip: should open but was manually closed — respect the override
    if (shouldBeOpen && shop.manually_closed) continue

    // Skip: already in the correct state
    if (shop.is_open === shouldBeOpen) continue

    const update: Record<string, any> = { is_open: shouldBeOpen }
    // Closing time reached → reset manual override for next day's auto-open
    if (!shouldBeOpen) update.manually_closed = false

    updates.push(
      admin.from('shops').update(update).eq('id', shop.id).then(() => {
        admin.from('shop_activity_log').insert({
          shop_id: shop.id,
          type: shouldBeOpen ? 'shop_opened' : 'shop_closed',
          source: 'auto_schedule',
        })
        updated++
      })
    )
  }

  await Promise.all(updates)

  return NextResponse.json({ ok: true, checked: shops.length, updated })
}
