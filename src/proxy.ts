import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MAX_AGE = 60 * 60 * 24 * 365 // 1 year

// ── Role → where they live ────────────────────────────────────
const ROLE_HOME: Record<string, string> = {
  customer:   '/dashboard/customer',
  shopkeeper: '/dashboard/business',
  business:   '/dashboard/business',
  delivery:   '/dashboard/delivery',
  admin:      '/dashboard/admin',
}

// ── Routes each role is BLOCKED from ─────────────────────────
// customer-facing routes: anyone who isn't a customer gets blocked
const CUSTOMER_ROUTES = ['/stores', '/cart', '/checkout', '/orders', '/favourites', '/search', '/location']

function isCustomerRoute(pathname: string) {
  return CUSTOMER_ROUTES.some(r => pathname.startsWith(r))
}
function isDashboard(pathname: string, role: string) {
  return pathname.startsWith(`/dashboard/${role}`)
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

  // ── 1. Auth pages: never touch ─────────────────────────────
  if (pathname.startsWith('/auth')) {
    // If already logged in and visiting login/signup, redirect to their dashboard
    if (user) {
      const role = user.user_metadata?.role || 'customer'
      const home = ROLE_HOME[role] || '/dashboard/customer'
      return NextResponse.redirect(new URL(home, request.url))
    }
    return supabaseResponse
  }

  // ── 2. Not logged in: protect gated routes ──────────────────
  const isProtected =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/favourites') ||
    pathname.startsWith('/dashboard')

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // ── 3. Logged in: enforce role boundaries ───────────────────
  if (user) {
    // Fetch role — try metadata first (fast), fallback to DB
    let role: string = user.user_metadata?.role || ''
    if (!role) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      role = profile?.role || 'customer'
    }

    const home = ROLE_HOME[role] || '/dashboard/customer'

    // Homepage (/): landing page is open to everyone — no redirect
    if (pathname === '/') return supabaseResponse

    // Customer-facing routes: only customers allowed
    if (isCustomerRoute(pathname)) {
      if (role !== 'customer') {
        return NextResponse.redirect(new URL(home, request.url))
      }
      return supabaseResponse
    }

    // Dashboard routes: only the right role can access each one
    if (pathname.startsWith('/dashboard/')) {
      const segment = pathname.split('/')[2] // 'customer' | 'business' | 'delivery' | 'admin'

      const allowed =
        (segment === 'customer'  && role === 'customer') ||
        (segment === 'business'  && (role === 'shopkeeper' || role === 'business')) ||
        (segment === 'delivery'  && role === 'delivery') ||
        (segment === 'admin'     && role === 'admin')

      if (!allowed) {
        return NextResponse.redirect(new URL(home, request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}