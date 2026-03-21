import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const ROLE_HOME: Record<string, string> = {
  customer:   '/dashboard/customer',
  shopkeeper: '/dashboard/business',
  business:   '/dashboard/business',
  delivery:   '/dashboard/delivery',
  admin:      '/dashboard/admin',
}

const CUSTOMER_ROUTES = ['/stores', '/cart', '/checkout', '/orders', '/favourites', '/search', '/location']

function isCustomerRoute(pathname: string) {
  return CUSTOMER_ROUTES.some(r => pathname.startsWith(r))
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: MAX_AGE,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            })
          )
        },
      },
    }
  )

  // Always call getUser() — refreshes expired access tokens using refresh token
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── 1. Auth pages ───────────────────────────────────────────
  if (pathname.startsWith('/auth')) {
    if (user) {
      const role = user.user_metadata?.role || 'customer'
      const home = ROLE_HOME[role] || '/dashboard/customer'
      return NextResponse.redirect(new URL(home, request.url))
    }
    return supabaseResponse
  }

  // ── 2. Not logged in — protect gated routes ─────────────────
  const isProtected =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/favourites') ||
    pathname.startsWith('/dashboard')

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // ── 3. Logged in ────────────────────────────────────────────
  if (user) {
    let role: string = user.user_metadata?.role || ''
    if (!role) {
      const { data: profile } = await supabase
        .from('users').select('role').eq('id', user.id).single()
      role = profile?.role || 'customer'
    }

    const home = ROLE_HOME[role] || '/dashboard/customer'

    // Root: redirect logged-in users to their dashboard (fixes PWA open behaviour)
    if (pathname === '/') {
      return NextResponse.redirect(new URL(home, request.url))
    }

    // Customer routes: non-customers bounced home
    if (isCustomerRoute(pathname)) {
      if (role !== 'customer') return NextResponse.redirect(new URL(home, request.url))
      return supabaseResponse
    }

    // Dashboard routes: enforce role
    if (pathname.startsWith('/dashboard/')) {
      const segment = pathname.split('/')[2]
      const allowed =
        (segment === 'customer' && role === 'customer') ||
        (segment === 'business' && (role === 'shopkeeper' || role === 'business')) ||
        (segment === 'delivery' && role === 'delivery') ||
        (segment === 'admin'    && role === 'admin')
      if (!allowed) return NextResponse.redirect(new URL(home, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}