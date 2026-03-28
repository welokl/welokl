/**
 * Computes whether a shop is effectively open right now.
 * Uses schedule fields if available; falls back to is_open.
 * Respects manually_closed override.
 */
export function computeIsOpen(shop: {
  is_open: boolean
  opening_time?: string | null
  closing_time?: string | null
  manually_closed?: boolean | null
}): boolean {
  if (!shop.opening_time || !shop.closing_time) return shop.is_open
  if (shop.manually_closed) return false

  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = shop.opening_time.split(':').map(Number)
  const [ch, cm] = shop.closing_time.split(':').map(Number)
  return cur >= oh * 60 + om && cur < ch * 60 + cm
}
