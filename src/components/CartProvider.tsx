// src/components/CartProvider.tsx
// Initialises the cart with the logged-in user's ID so carts are user-specific
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useCart()

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      cart._hydrate(uid)         // loads correct cart for this user
    })

    // Also update cart userId when auth state changes (login/logout)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id
      if (uid) cart._setUserId(uid)
      else cart._hydrate(undefined)   // guest
    })

    return () => subscription.unsubscribe()
  }, [])

  return <>{children}</>
}