import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const ROLE_HOME: Record<string, string> = {
  customer:         '/dashboard/customer',
  business:         '/dashboard/business',
  shopkeeper:       '/dashboard/business',
  delivery:         '/dashboard/delivery',
  delivery_partner: '/dashboard/delivery',
  admin:            '/dashboard/admin',
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = cookies()

    // This client handles session exchange + cookie setting
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

      // Use service role client for DB lookup — bypasses RLS completely
      // This ensures the query never fails due to auth/cookie timing issues
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: existing } = await adminClient
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single()

      let redirectPath: string

      if (!existing) {
        // New Google user — send to signup to pick role + enter phone
        const name  = encodeURIComponent(user.user_metadata?.full_name || user.user_metadata?.name || '')
        const email = encodeURIComponent(user.email || '')
        redirectPath = `/auth/signup?email=${email}&name=${name}&from=google`
      } else {
        // Existing user — redirect to their dashboard
        redirectPath = ROLE_HOME[existing.role] || '/dashboard/customer'
      }

      return NextResponse.redirect(new URL(redirectPath, origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', new URL(request.url).origin))
}
