import { createAdminClient } from './supabase/server'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function assignNearestPartner(orderId: string, shopLat: number, shopLng: number): Promise<{ partnerId: string | null; reason: string }> {
  const supabase = createAdminClient()

  // 1. Get ALL online partners with location
  const { data: partners } = await supabase
    .from('delivery_partners')
    .select('user_id, current_lat, current_lng, rating')
    .eq('is_online', true)
    .not('current_lat', 'is', null)
    .not('current_lng', 'is', null)

  if (!partners || partners.length === 0) {
    // No partners online — log it but DON'T block order
    await supabase.from('order_status_log').insert({
      order_id: orderId,
      status: 'accepted',
      message: 'No delivery partners online right now. Will assign when one comes online.',
    })
    return { partnerId: null, reason: 'no_partners_online' }
  }

  // 2. Find busy partners (already on active deliveries)
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('delivery_partner_id')
    .in('status', ['picked_up']) // only blocked if already picked up
    .not('delivery_partner_id', 'is', null)

  const busyIds = new Set((activeOrders || []).map((o: any) => o.delivery_partner_id))

  // 3. Filter available partners
  const available = partners
    .filter((p: any) => !busyIds.has(p.user_id))
    .map((p: any) => ({
      ...p,
      distance: haversine(shopLat, shopLng, Number(p.current_lat), Number(p.current_lng)),
    }))
    .sort((a: any, b: any) => a.distance - b.distance)

  if (available.length === 0) {
    await supabase.from('order_status_log').insert({
      order_id: orderId,
      status: 'accepted',
      message: 'All delivery partners are currently busy. Will assign soon.',
    })
    return { partnerId: null, reason: 'all_busy' }
  }

  const nearest = available[0]

  // 4. Assign
  await supabase.from('orders').update({
    delivery_partner_id: nearest.user_id
  }).eq('id', orderId)

  await supabase.from('order_status_log').insert({
    order_id: orderId,
    status: 'accepted',
    message: `Delivery partner assigned — ${nearest.distance.toFixed(1)} km away`,
  })

  return { partnerId: nearest.user_id, reason: 'assigned' }
}

export async function creditPartnerWallet(userId: string, orderId: string, amount: number): Promise<void> {
  const supabase = createAdminClient()

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance, total_earned')
    .eq('user_id', userId)
    .single()

  if (!wallet) return

  await supabase.from('wallets').update({
    balance: wallet.balance + amount,
    total_earned: wallet.total_earned + amount,
  }).eq('user_id', userId)

  await supabase.from('transactions').insert({
    wallet_id: wallet.id,
    order_id: orderId,
    amount,
    type: 'credit',
    description: 'Delivery earnings',
  })

  // Increment delivery count safely
  await supabase.rpc('increment_deliveries', { partner_user_id: userId })
}
