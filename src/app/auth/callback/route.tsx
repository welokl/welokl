import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const ROLE_MAP: Record<string, string> = {
  customer:         '/dashboard/customer',
  business:         '/dashboard/business',
  shopkeeper:       '/dashboard/business',
  delivery:         '/dashboard/delivery',
  delivery_partner: '/dashboard/delivery',
  admin:            '/dashboard/admin',
  management:       '/dashboard/management',
}

function redirectWithCookies(url: URL, cookieStore: ReturnType<typeof cookies>) {
  const response = NextResponse.redirect(url)
  // Explicitly copy all cookies (including newly set session tokens) onto the
  // redirect response — without this the session cookies stay in Next.js internal
  // buffer and are not sent to the browser with the 302, causing the session to
  // be invisible to the middleware on the follow-up request.
  cookieStore.getAll().forEach(({ name, value }) => {
    response.cookies.set(name, value, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    })
  })
  return response
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user

      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: existing } = await adminClient
        .from('users').select('id').eq('id', user.id).single()

      if (!existing) {
        // New Google user — send to signup to pick role + phone
        const name  = encodeURIComponent(user.user_metadata?.full_name || user.user_metadata?.name || '')
        const email = encodeURIComponent(user.email || '')
        return redirectWithCookies(
          new URL(`/auth/signup?email=${email}&name=${name}&from=google`, origin),
          cookieStore
        )
      }

      const { data: profile } = await adminClient
        .from('users').select('role').eq('id', user.id).single()
      const role = profile?.role || 'customer'
      return redirectWithCookies(
        new URL(ROLE_MAP[role] ?? '/dashboard/customer', origin),
        cookieStore
      )
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', new URL(request.url).origin))
}