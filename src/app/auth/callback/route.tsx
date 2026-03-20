// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
          set(name: string, value: string, opts: CookieOptions) { cookieStore.set({ name, value, ...opts }) },
          remove(name: string, opts: CookieOptions) { cookieStore.set({ name, value: '', ...opts }) },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const user = data.user

      // Check if profile exists in our users table
      const { data: existing } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (!existing) {
        // New Google user — keep session alive, send to signup to pick role
        // Signup page will read the active session and just insert profile row
        const name  = encodeURIComponent(user.user_metadata?.full_name || user.user_metadata?.name || '')
        const email = encodeURIComponent(user.email || '')
        return NextResponse.redirect(
          `${origin}/auth/signup?email=${email}&name=${name}&from=google`
        )
      }

      // Existing user — redirect to their dashboard
      const redirects: Record<string, string> = {
        customer:         '/dashboard/customer',
        business:         '/dashboard/business',
        delivery_partner: '/dashboard/delivery',
        admin:            '/dashboard/admin',
      }
      return NextResponse.redirect(
        `${origin}${redirects[existing.role] ?? '/dashboard/customer'}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}