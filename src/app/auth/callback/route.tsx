import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

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
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, opts: CookieOptions) {
            cookieStore.set({ name, value, ...opts })
          },
          remove(name: string, opts: CookieOptions) {
            cookieStore.set({ name, value: '', ...opts })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user

      // Use service role to bypass RLS — guaranteed to work
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: existing } = await adminClient
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existing) {
        // New Google user — send to signup to pick role + phone
        const name  = encodeURIComponent(user.user_metadata?.full_name || user.user_metadata?.name || '')
        const email = encodeURIComponent(user.email || '')
        return NextResponse.redirect(
          new URL(`/auth/signup?email=${email}&name=${name}&from=google`, origin)
        )
      }

      // Existing user — look up role and redirect directly (no client-side flash)
      const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single()
      const role = profile?.role || 'customer'
      const roleMap: Record<string, string> = {
        customer:         '/dashboard/customer',
        business:         '/dashboard/business',
        shopkeeper:       '/dashboard/business',
        delivery:         '/dashboard/delivery',
        delivery_partner: '/dashboard/delivery',
        admin:            '/dashboard/admin',
      }
      return NextResponse.redirect(new URL(roleMap[role] ?? '/dashboard/customer', origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', new URL(request.url).origin))
}