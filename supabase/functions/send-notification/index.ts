// supabase/functions/send-notification/index.ts
// Deploy: npx supabase functions deploy send-notification
// NOTE: remove --no-verify-jwt so Supabase validates the caller's JWT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// A05 — restrict CORS to your own domain only
// @ts-ignore — Deno global available at Edge Function runtime
const _appOrigin: string = typeof Deno !== 'undefined' ? (Deno.env.get('APP_ORIGIN') ?? '') : ''
const ALLOWED_ORIGINS = ['https://dwarpar.com', 'https://www.dwarpar.com', _appOrigin].filter(Boolean)

function makeCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : (ALLOWED_ORIGINS[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// ── Get FCM OAuth2 access token ───────────────────────────────
async function getFCMAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss:   serviceAccount.client_email,
    sub:   serviceAccount.client_email,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }

  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const signingInput = `${enc(header)}.${enc(payload)}`

  // Fix private key — handle both literal \n and real newlines
  const rawKey = serviceAccount.private_key
  const fixedKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey
  const pemKey = fixedKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const keyData = Uint8Array.from(atob(pemKey), (c: string) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(sigBytes))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${signingInput}.${sigB64}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) {
    console.error('[FCM] OAuth failed:', JSON.stringify(data))
    throw new Error('FCM OAuth failed: ' + JSON.stringify(data))
  }
  return data.access_token
}

// ── Send one FCM push ─────────────────────────────────────────
async function sendPush(
  token: string,
  title: string,
  body: string,
  extra: Record<string, string> = {}
): Promise<boolean> {
  // @ts-ignore
  const projectId      = Deno.env.get('FCM_PROJECT_ID')!
  // @ts-ignore
  const saRaw          = Deno.env.get('FCM_SERVICE_ACCOUNT')!
  const serviceAccount = JSON.parse(saRaw)
  const accessToken    = await getFCMAccessToken(serviceAccount)

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          data: {
            title,
            body,
            url:      extra.url      || '/',
            tag:      extra.tag      || 'dwarpar',
            order_id: extra.order_id || '',
          },
          webpush: {
            headers: { Urgency: 'high', TTL: '86400' },
            notification: {
              title,
              body,
              icon:              '/icons/icon-192.png',
              badge:             '/icons/badge-72.png',
              tag:               extra.tag || 'dwarpar',
              renotify:          'true',
              requireInteraction:'false',
            },
            fcm_options: { link: extra.url || '/' },
          },
        },
      }),
    }
  )

  const text = await res.text()
  if (!res.ok) console.error('[FCM] sendPush FAILED', res.status, text)
  else         console.log('[FCM] sendPush OK', text.slice(0, 60))
  return res.ok
}

// ── Main ──────────────────────────────────────────────────────
serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const ch = makeCorsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: ch })

  try {
    const body = await req.json()
    const { type, order_id, shop_id, customer_id } = body
    console.log('[notify] received type:', type, 'order:', order_id)

    // A03/A04 — validate inputs before any DB operation
    if (!type || typeof type !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid type' }), { status: 400, headers: { ...ch, 'Content-Type': 'application/json' } })
    }
    if (order_id && (typeof order_id !== 'string' || order_id.length > 100)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid order_id' }), { status: 400, headers: { ...ch, 'Content-Type': 'application/json' } })
    }

    // @ts-ignore — Deno global available at Edge Function runtime
    const sb = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL')!,
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // A01 — verify the order exists and the claimed customer_id/shop_id actually
    // matches the DB record before sending any notification.
    // Prevents an attacker from spamming fake notifications to arbitrary users.
    if (order_id) {
      const { data: orderCheck } = await sb
        .from('orders')
        .select('customer_id, shop_id')
        .eq('id', order_id)
        .single()
      if (!orderCheck) {
        console.warn('[notify] order not found:', order_id)
        return new Response(JSON.stringify({ ok: false, error: 'Order not found' }), { status: 404, headers: { ...ch, 'Content-Type': 'application/json' } })
      }
      // Reject if the claimed IDs don't match the DB
      if (customer_id && orderCheck.customer_id !== customer_id) {
        console.warn('[notify] customer_id mismatch')
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { ...ch, 'Content-Type': 'application/json' } })
      }
      if (shop_id && orderCheck.shop_id !== shop_id) {
        console.warn('[notify] shop_id mismatch')
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { ...ch, 'Content-Type': 'application/json' } })
      }
    }

    const getToken = async (userId: string): Promise<string | null> => {
      const { data, error } = await sb.from('users').select('fcm_token').eq('id', userId).single()
      if (error) console.error('[notify] getToken error for', userId, error.message)
      console.log('[notify] token for', userId, ':', data?.fcm_token ? 'EXISTS' : 'MISSING')
      return data?.fcm_token || null
    }

    switch (type) {

      case 'order_placed': {
        console.log('[notify] looking up shop:', shop_id)
        const { data: shop, error: se } = await sb.from('shops').select('owner_id,name').eq('id', shop_id).single()
        if (se || !shop) { console.error('[notify] shop not found:', se?.message); break }
        console.log('[notify] shop owner_id:', shop.owner_id)
        const token = await getToken(shop.owner_id)
        if (!token) break
        await sendPush(token, '🛒 New Order!', 'A customer just placed an order. Tap to review.',
          { url: '/dashboard/business', tag: 'new-order', order_id })
        break
      }

      case 'order_accepted': {
        if (!customer_id) break
        const token = await getToken(customer_id)
        if (!token) break
        await sendPush(token, '✅ Order Confirmed!', 'Your shop is preparing your order.',
          { url: `/orders/${order_id}`, tag: 'order-update', order_id })
        break
      }

      case 'order_ready': {
        if (customer_id) {
          const t = await getToken(customer_id)
          if (t) await sendPush(t, '📦 Order Ready!', 'Your order is packed. Rider will pick it up soon.',
            { url: `/orders/${order_id}`, tag: 'order-update', order_id })
        }
        const { data: partners } = await sb.from('delivery_partners')
          .select('user_id').eq('is_online', true).eq('verification_status', 'approved')
        for (const p of (partners || [])) {
          const t = await getToken(p.user_id)
          if (t) await sendPush(t, '🛵 New Delivery!', 'An order is ready for pickup near you.',
            { url: '/dashboard/delivery', tag: 'new-delivery', order_id })
        }
        break
      }

      case 'order_picked_up': {
        if (!customer_id) break
        const token = await getToken(customer_id)
        if (!token) break
        await sendPush(token, '🛵 Rider is on the Way!', 'Your order has been picked up.',
          { url: `/orders/${order_id}`, tag: 'order-update', order_id })
        break
      }

      case 'order_delivered': {
        if (!customer_id) break
        const token = await getToken(customer_id)
        if (!token) break
        await sendPush(token, '🎉 Delivered!', 'Your order has been delivered. Enjoy!',
          { url: `/orders/${order_id}`, tag: 'order-delivered', order_id })
        break
      }

      default:
        console.log('[notify] unknown type:', type)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...ch, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[notify] CRASH:', String(err))
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...ch, 'Content-Type': 'application/json' },
    })
  }
})