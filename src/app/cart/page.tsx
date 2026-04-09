'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'

export default function CartPage() {
  const router  = useRouter()
  const cart    = useCart()
  const [mounted, setMounted] = useState(false)
  const [platformCfg, setPlatformCfg] = useState({ delivery_fee: 30, free_delivery_threshold: 299, platform_fee: 5 })

  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(({ data: { user } }) => {
      if (user) cart._setUserId?.(user.id)
      else cart._hydrate?.()
      setMounted(true)
    })
    client.from('platform_config').select('key,value').then(({ data: cfg }: any) => {
      if (!cfg?.length) return
      const get = (key: string, fb: number) => Number(cfg.find((c: any) => c.key === key)?.value ?? fb)
      setPlatformCfg({
        delivery_fee:            get('delivery_fee_base', 30),
        free_delivery_threshold: get('free_delivery_above', 299),
        platform_fee:            get('platform_fee_flat', 5),
      })
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:36, height:36, border:'3px solid #eee', borderTopColor:'#FF3008', borderRadius:'50%', animation:'sp .7s linear infinite' }} />
    </div>
  )

  const subtotal     = cart.subtotal()
  const delivery_fee = subtotal >= platformCfg.free_delivery_threshold ? 0 : platformCfg.delivery_fee
  const platform_fee = platformCfg.platform_fee
  const total        = subtotal + delivery_fee + platform_fee
  const toFreeDelivery = platformCfg.free_delivery_threshold - subtotal

  if (cart.items.length === 0) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center', padding:24 }}>
        <div style={{ fontSize:72, marginBottom:16 }}>🛒</div>
        <h2 style={{ fontWeight:900, fontSize:22, color:'var(--text-primary)', marginBottom:8, letterSpacing:'-0.03em' }}>Your cart is empty</h2>
        <p style={{ color:'var(--text-muted)', fontSize:15, marginBottom:28, lineHeight:1.6 }}>Add items from a local shop to get started</p>
        <Link href="/stores" style={{ display:'inline-block', padding:'14px 32px', borderRadius:16, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none' }}>
          Browse shops →
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:'calc(90px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:520, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'var(--page-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)' }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
              <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', flex:1, letterSpacing:'-0.02em' }}>Cart</h1>
          <span style={{ fontSize:12, color:'var(--text-muted)', background:'var(--page-bg)', borderRadius:999, padding:'4px 12px', fontWeight:700 }}>
            {cart.shop_name}
          </span>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'16px 12px' }}>

        {/* Free delivery progress */}
        {delivery_fee > 0 && (
          <div style={{ background:'var(--card-white)', borderRadius:18, padding:'14px 16px', marginBottom:10, border:'1px solid var(--divider)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:16 }}>🚚</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>
                Add <span style={{ color:'#FF3008' }}>₹{toFreeDelivery}</span> more for free delivery
              </span>
            </div>
            <div style={{ height:5, background:'var(--page-bg)', borderRadius:999, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.min(100, (subtotal/platformCfg.free_delivery_threshold)*100)}%`, background:'#FF3008', borderRadius:999, transition:'width .4s' }} />
            </div>
          </div>
        )}
        {delivery_fee === 0 && (
          <div style={{ background:'var(--green-light)', borderRadius:16, padding:'12px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>🎉</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>You've unlocked free delivery!</span>
          </div>
        )}

        {/* Cart items */}
        <div style={{ background:'var(--card-white)', borderRadius:20, overflow:'hidden', marginBottom:10, border:'1px solid var(--divider)' }}>
          {cart.items.map((item, i) => (
            <div key={item.product.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
              {/* Image */}
              <div style={{ width:48, height:48, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--page-bg)' }}>
                {(item.product as any).image_url
                  ? <img src={(item.product as any).image_url} alt={item.product.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🛍️</div>
                }
              </div>

              {/* Name + unit × qty = total */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{item.product.name}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>
                  ₹{item.product.price} × {item.quantity}
                  <span style={{ fontWeight:800, color:'var(--text-primary)', marginLeft:6 }}>= ₹{item.product.price * item.quantity}</span>
                </p>
              </div>

              {/* Stepper */}
              <div style={{ display:'flex', alignItems:'center', background:'#FF3008', borderRadius:10, overflow:'hidden', flexShrink:0 }}>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity - 1)} style={{ color:'#fff', padding:'7px 11px', border:'none', background:'none', cursor:'pointer', fontWeight:900, fontSize:15, lineHeight:1 }}>−</button>
                <span style={{ color:'#fff', fontWeight:900, fontSize:13, minWidth:18, textAlign:'center' }}>{item.quantity}</span>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity + 1)} style={{ color:'#fff', padding:'7px 11px', border:'none', background:'none', cursor:'pointer', fontWeight:900, fontSize:15, lineHeight:1 }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Bill summary */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:10, border:'1px solid var(--divider)' }}>
          <p style={{ fontSize:12, fontWeight:800, color:'var(--text-faint)', letterSpacing:'0.08em', marginBottom:16 }}>BILL SUMMARY</p>
          {[
            { label:'Item total',    value: subtotal,     color:'var(--text-secondary)' },
            { label:'Delivery fee',  value: delivery_fee, color: delivery_fee === 0 ? '#16a34a' : '#333', display: delivery_fee === 0 ? 'FREE 🎉' : `₹${delivery_fee}` },
            { label:'Platform fee',  value: platform_fee, color:'var(--text-secondary)' },
          ].map(r => (
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:12, fontSize:14 }}>
              <span style={{ color:'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontWeight:700, color: r.color }}>{(r as any).display ?? `₹${r.value}`}</span>
            </div>
          ))}
          <div style={{ borderTop:'1.5px dashed #f0f0f0', paddingTop:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:900, fontSize:16, color:'var(--text-primary)' }}>To pay</span>
            <span style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)' }}>₹{total}</span>
          </div>
        </div>

        {/* Note */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'14px 16px', background:'var(--info-light)', borderRadius:16, marginBottom:10 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>ℹ️</span>
          <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
            Review your order carefully. Changes cannot be made after placing.
          </p>
        </div>
      </div>

      {/* Checkout bar */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 12px', paddingBottom:'calc(16px + env(safe-area-inset-bottom, 0px))', background:'var(--card-white)', borderTop:'1px solid var(--divider)', zIndex:50 }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <Link href="/checkout" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FF3008', color:'#fff', borderRadius:18, padding:'16px 22px', textDecoration:'none', boxShadow:'0 8px 24px rgba(255,48,8,.3)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:'rgba(255,255,255,.2)', borderRadius:10, padding:'4px 12px', fontWeight:900, fontSize:14 }}>
                {cart.count()} item{cart.count() !== 1 ? 's' : ''}
              </span>
              <span style={{ fontWeight:800, fontSize:15 }}>Proceed to checkout</span>
            </div>
            <span style={{ fontWeight:900, fontSize:16 }}>₹{total}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}