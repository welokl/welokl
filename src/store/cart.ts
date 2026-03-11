// src/store/cart.ts
//
// NO zustand/persist — that middleware uses the Web Locks API which throws
// "AbortError: Lock broken by another request with the 'steal' option"
// in Next.js 14 SSR. We handle localStorage manually instead.
//
// API:
//   cart.items          CartItem[]
//   cart.shop_id        string | null
//   cart.shop_name      string | null
//   cart.count()        number
//   cart.subtotal()     number
//   cart.addItem(product, shopId, shopName)
//   cart.removeItem(productId)
//   cart.updateQty(productId, qty)
//   cart.clear()

import { create } from 'zustand'

export interface CartProduct {
  id: string
  name: string
  price: number
  original_price?: number | null
  image_url: string | null
  is_veg?: boolean | null
  category?: string | null
  category_name?: string | null
  shop_id?: string
  [key: string]: unknown
}

export interface CartItem {
  product: CartProduct
  quantity: number
}

interface CartStore {
  items: CartItem[]
  shop_id: string | null
  shop_name: string | null
  _hydrated: boolean

  // Methods
  _hydrate: () => void
  addItem: (product: CartProduct, shopId: string, shopName: string) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clear: () => void
  count: () => number
  subtotal: () => number
}

const STORAGE_KEY = 'welokl_cart_v3'

function readStorage(): Pick<CartStore, 'items' | 'shop_id' | 'shop_name'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [], shop_id: null, shop_name: null }
    const parsed = JSON.parse(raw)
    return {
      items:     Array.isArray(parsed.items)  ? parsed.items  : [],
      shop_id:   parsed.shop_id   ?? null,
      shop_name: parsed.shop_name ?? null,
    }
  } catch {
    return { items: [], shop_id: null, shop_name: null }
  }
}

function writeStorage(state: Pick<CartStore, 'items' | 'shop_id' | 'shop_name'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items:     state.items,
      shop_id:   state.shop_id,
      shop_name: state.shop_name,
    }))
  } catch { /* quota exceeded — silently ignore */ }
}

export const useCart = create<CartStore>((set, get) => ({
  // Start empty — _hydrate() fills from localStorage on client
  items:     [],
  shop_id:   null,
  shop_name: null,
  _hydrated: false,

  _hydrate: () => {
    if (get()._hydrated) return
    const saved = readStorage()
    set({ ...saved, _hydrated: true })
  },

  addItem: (product, shopId, shopName) => {
    const { items, shop_id } = get()

    let next: CartItem[]

    // Different shop → wipe cart first
    if (shop_id && shop_id !== shopId && items.length > 0) {
      next = [{ product, quantity: 1 }]
    } else {
      const existing = items.find(i => i.product.id === product.id)
      if (existing) {
        next = items.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      } else {
        next = [...items, { product, quantity: 1 }]
      }
    }

    const state = { items: next, shop_id: shopId, shop_name: shopName }
    set(state)
    writeStorage(state)
  },

  removeItem: (productId) => {
    const items = get().items.filter(i => i.product.id !== productId)
    const state = {
      items,
      shop_id:   items.length === 0 ? null : get().shop_id,
      shop_name: items.length === 0 ? null : get().shop_name,
    }
    set(state)
    writeStorage(state)
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return }
    const items = get().items.map(i =>
      i.product.id === productId ? { ...i, quantity: qty } : i
    )
    const state = { items, shop_id: get().shop_id, shop_name: get().shop_name }
    set(state)
    writeStorage(state)
  },

  clear: () => {
    const state = { items: [], shop_id: null, shop_name: null }
    set(state)
    writeStorage(state)
  },

  count: () => get().items.reduce((s, i) => s + i.quantity, 0),

  subtotal: () => get().items.reduce((s, i) => s + i.product.price * i.quantity, 0),
}))

// ── Backwards-compat alias ─────────────────────────────────────────────────────
export { useCart as useCartStore }