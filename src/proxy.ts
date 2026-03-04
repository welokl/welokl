import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do NOT use getUser() here — use getSession() to avoid redirect loops
  // getUser() makes a network call and can fail/timeout causing false logouts
  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  const protectedRoutes = ['/dashboard', '/checkout', '/orders']
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r))

  // Only redirect if truly no session
  if (isProtected && !session) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Role-based redirect only for /dashboard root
  if (pathname === '/dashboard' && session) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role) {
      return NextResponse.redirect(new URL(`/dashboard/${profile.role}`, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
