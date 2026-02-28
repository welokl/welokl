import { createAdminClient } from './supabase/server'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function assignNearestPartner(orderId: string, shopLat: number, shopLng: number): Promise<string | null> {
  const supabase = createAdminClient()

  // Get all online partners
  const { data: partners } = await supabase
    .from('delivery_partners')
    .select('*, users(id, name)')
    .eq('is_online', true)
    .not('current_lat', 'is', null)

  if (!partners || partners.length === 0) return null

  // Find partners currently busy
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('delivery_partner_id')
    .in('status', ['accepted', 'preparing', 'ready', 'picked_up'])
    .not('delivery_partner_id', 'is', null)

  const busyIds = new Set((activeOrders || []).map((o: { delivery_partner_id: string }) => o.delivery_partner_id))

  // Filter available and sort by distance
  const available = partners
    .filter((p: { user_id: string; current_lat: number; current_lng: number }) => !busyIds.has(p.user_id))
    .map((p: { user_id: string; current_lat: number; current_lng: number }) => ({
      ...p,
      distance: haversine(shopLat, shopLng, p.current_lat, p.current_lng),
    }))
    .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance)

  if (available.length === 0) return null

  const nearest = available[0]

  // Assign
  await supabase.from('orders').update({ delivery_partner_id: nearest.user_id }).eq('id', orderId)
  await supabase.from('order_status_log').insert({
    order_id: orderId,
    status: 'assigned',
    message: `Delivery partner assigned (${nearest.distance.toFixed(1)} km away)`,
  })

  return nearest.user_id
}

export async function creditPartnerWallet(userId: string, orderId: string, amount: number): Promise<void> {
  const supabase = createAdminClient()

  const { data: wallet } = await supabase.from('wallets').select('id, balance, total_earned').eq('user_id', userId).single()
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
    description: `Delivery earnings for order`,
  })

  await supabase.from('delivery_partners').update({
    total_deliveries: supabase.rpc('increment', { row_id: userId }),
  }).eq('user_id', userId)
}
