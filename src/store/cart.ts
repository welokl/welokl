// src/store/cart.ts
// User-specific cart — each user gets their own localStorage key
// Key format: welokl_cart_{userId} or welokl_cart_guest

import { create } from 'zustand'

export interface CartProduct {
  id: string; name: string; price: number
  original_price?: number | null; image_url: string | null
  is_veg?: boolean | null; category?: string | null
  category_name?: string | null; shop_id?: string
  [key: string]: unknown
}

export interface CartItem {
  product: CartProduct
  quantity: number
  note?: string          // per-item special instructions (DoorDash style)
}

interface CartStore {
  items: CartItem[]; shop_id: string | null; shop_name: string | null
  _hydrated: boolean; _userId: string | null
  _hydrate:    (userId?: string) => void
  _setUserId:  (userId: string)  => void
  addItem:     (product: CartProduct, shopId: string, shopName: string) => void
  removeItem:  (productId: string) => void
  updateQty:   (productId: string, qty: number) => void
  setNote:     (productId: string, note: string) => void
  clear:       () => void
  count:       () => number
  subtotal:    () => number
  itemCount:   () => number
  total:       () => number
}

function storageKey(userId: string | null) {
  return userId ? `welokl_cart_${userId}` : 'welokl_cart_guest'
}

function read(userId: string | null): Pick<CartStore, 'items'|'shop_id'|'shop_name'> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { items: [], shop_id: null, shop_name: null }
    const p = JSON.parse(raw)
    return { items: Array.isArray(p.items) ? p.items : [], shop_id: p.shop_id ?? null, shop_name: p.shop_name ?? null }
  } catch { return { items: [], shop_id: null, shop_name: null } }
}

function write(userId: string | null, state: Pick<CartStore,'items'|'shop_id'|'shop_name'>) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(state)) } catch {}
}

export const useCart = create<CartStore>((set, get) => ({
  items: [], shop_id: null, shop_name: null, _hydrated: false, _userId: null,

  _hydrate: (userId?: string) => {
    if (get()._hydrated && get()._userId === (userId ?? null)) return
    const uid = userId ?? null
    const saved = read(uid)
    set({ ...saved, _hydrated: true, _userId: uid })
  },

  _setUserId: (userId: string) => {
    if (get()._userId === userId) return
    const guestKey = storageKey(null)
    const userKey  = storageKey(userId)
    try {
      const guestRaw = localStorage.getItem(guestKey)
      const userRaw  = localStorage.getItem(userKey)
      if (guestRaw && !userRaw) {
        localStorage.setItem(userKey, guestRaw)
        localStorage.removeItem(guestKey)
      } else if (guestRaw) {
        localStorage.removeItem(guestKey)
      }
    } catch {}
    const saved = read(userId)
    set({ ...saved, _userId: userId })
  },

  addItem: (product, shopId, shopName) => {
    const { items, shop_id, _userId } = get()
    let next: CartItem[]
    if (shop_id && shop_id !== shopId && items.length > 0) {
      next = [{ product, quantity: 1 }]
    } else {
      const ex = items.find(i => i.product.id === product.id)
      if (ex) next = items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity+1 } : i)
      else next = [...items, { product, quantity: 1 }]
    }
    const state = { items: next, shop_id: shopId, shop_name: shopName }
    set(state); write(_userId, state)
  },

  removeItem: (productId) => {
    const { _userId } = get()
    const items = get().items.filter(i => i.product.id !== productId)
    const state = { items, shop_id: items.length ? get().shop_id : null, shop_name: items.length ? get().shop_name : null }
    set(state); write(_userId, state)
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return }
    const { _userId } = get()
    const items = get().items.map(i => i.product.id === productId ? { ...i, quantity: qty } : i)
    const state = { items, shop_id: get().shop_id, shop_name: get().shop_name }
    set(state); write(_userId, state)
  },

  setNote: (productId, note) => {
    const { _userId } = get()
    const items = get().items.map(i =>
      i.product.id === productId ? { ...i, note: note.trim() || undefined } : i
    )
    const state = { items, shop_id: get().shop_id, shop_name: get().shop_name }
    set(state); write(_userId, state)
  },

  clear: () => {
    const { _userId } = get()
    const state = { items: [], shop_id: null, shop_name: null }
    set(state); write(_userId, state)
  },

  count:     () => get().items.reduce((s,i) => s + i.quantity, 0),
  subtotal:  () => get().items.reduce((s,i) => s + i.product.price * i.quantity, 0),
  itemCount: () => get().items.reduce((s,i) => s + i.quantity, 0),
  total:     () => get().items.reduce((s,i) => s + i.product.price * i.quantity, 0),
}))

export { useCart as useCartStore }
