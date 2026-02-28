'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, CartItem } from '@/types'

interface CartStore {
  items: CartItem[]
  shop_id: string | null
  shop_name: string | null

  addItem: (product: Product, shop_id: string, shop_name: string) => void
  removeItem: (product_id: string) => void
  updateQty: (product_id: string, qty: number) => void
  clear: () => void

  subtotal: () => number
  count: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      shop_id: null,
      shop_name: null,

      addItem: (product, shop_id, shop_name) => {
        const { items, shop_id: currentShop } = get()
        // Different shop — reset cart
        if (currentShop && currentShop !== shop_id) {
          set({ items: [{ product, quantity: 1, shop_id, shop_name }], shop_id, shop_name })
          return
        }
        const existing = items.find(i => i.product.id === product.id)
        if (existing) {
          set({ items: items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) })
        } else {
          set({ items: [...items, { product, quantity: 1, shop_id, shop_name }], shop_id, shop_name })
        }
      },

      removeItem: (product_id) => {
        const items = get().items.filter(i => i.product.id !== product_id)
        set({ items, shop_id: items.length ? get().shop_id : null, shop_name: items.length ? get().shop_name : null })
      },

      updateQty: (product_id, qty) => {
        if (qty <= 0) { get().removeItem(product_id); return }
        set({ items: get().items.map(i => i.product.id === product_id ? { ...i, quantity: qty } : i) })
      },

      clear: () => set({ items: [], shop_id: null, shop_name: null }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'welokl-cart' }
  )
)
