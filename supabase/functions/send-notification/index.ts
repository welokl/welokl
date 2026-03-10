// supabase/functions/send-notification/index.ts
// Deploy: npx supabase functions deploy send-notification
//
// Required secrets (set once):
//   npx supabase secrets set FCM_PROJECT_ID=welokl-b47d4
//   npx supabase secrets set FCM_SERVICE_ACCOUNT='<paste full JSON from Firebase>'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Get FCM access token via service account JWT ─────────────
async function getFCMAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }

  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const signingInput = `${enc(header)}.${enc(payload)}`

  // Import private key
  const pemKey = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${signingInput}.${sigB64}`

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

// ── Send FCM push to one device token ────────────────────────
async function sendPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const projectId    = Deno.env.get('FCM_PROJECT_ID')!
  const saRaw        = Deno.env.get('FCM_SERVICE_ACCOUNT')!
  const serviceAccount = JSON.parse(saRaw)
  const accessToken  = await getFCMAccessToken(serviceAccount)

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          webpush: {
            notification: {
              title, body,
              icon: '/icons/icon-192.png',
              badge: '/icons/badge-72.png',
              vibrate: [200, 100, 200],
            },
            fcm_options: { link: data.url || '/' }
          }
        }
      })
    }
  )
  return res.ok
}

// ── Main handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, order_id, shop_id, customer_id, delivery_partner_id } = await req.json()

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Helper: get fcm_token for a user
    async function getToken(userId: string): Promise<string | null> {
      const { data } = await sb.from('users').select('fcm_token').eq('id', userId).single()
      return data?.fcm_token || null
    }

    switch (type) {

      // ── New order placed → notify shopkeeper
      case 'order_placed': {
        const { data: shop } = await sb.from('shops').select('user_id, name').eq('id', shop_id).single()
        if (!shop?.user_id) break
        const token = await getToken(shop.user_id)
        if (!token) break
        await sendPush(token,
          '🛒 New order!',
          'A customer just placed an order. Tap to review.',
          { url: '/dashboard/business', tag: 'new-order', order_id }
        )
        break
      }

      // ── Order accepted → notify customer
      case 'order_accepted': {
        if (!customer_id) break
        const token = await getToken(customer_id)
        if (!token) break
        await sendPush(token,
          '✅ Order accepted!',
          'The shop has accepted your order and is preparing it.',
          { url: `/orders/${order_id}`, tag: 'order-update', order_id }
        )
        break
      }

      // ── Order ready → notify delivery partners online
      case 'order_ready': {
        // Notify customer
        if (customer_id) {
          const cToken = await getToken(customer_id)
          if (cToken) await sendPush(cToken,
            '📦 Order ready!',
            'Your order is packed and waiting for a rider.',
            { url: `/orders/${order_id}`, tag: 'order-update', order_id }
          )
        }
        // Notify available online delivery partners
        const { data: partners } = await sb.from('delivery_partners')
          .select('user_id')
          .eq('is_online', true)
          .eq('verification_status', 'approved')
        if (partners) {
          await Promise.all(partners.map(async p => {
            const t = await getToken(p.user_id)
            if (t) await sendPush(t,
              '🛵 New delivery available!',
              'An order is ready for pickup near you. Tap to accept.',
              { url: '/dashboard/delivery', tag: 'new-delivery', order_id }
            )
          }))
        }
        break
      }

      // ── Rider picked up → notify customer
      case 'order_picked_up': {
        if (!customer_id) break
        const token = await getToken(customer_id)
        if (!token) break
        await sendPush(token,
          '🛵 Rider is on the way!',
          'Your order has been picked up and is heading to you.',
          { url: `/orders/${order_id}`, tag: 'order-update', order_id }
        )
        break
      }

      // ── Order delivered
      case 'order_delivered': {
        if (!customer_id) break
        const token = await getToken(customer_id)
        if (!token) break
        await sendPush(token,
          '🎉 Delivered!',
          'Your order has been delivered. Enjoy! Please rate your experience.',
          { url: `/orders/${order_id}`, tag: 'order-delivered', order_id }
        )
        break
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[send-notification]', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})