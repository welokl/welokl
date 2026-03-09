import { createBrowserClient } from '@supabase/ssr'

// Browser client — @supabase/ssr uses localStorage by default which persists
// across PWA sessions. Do NOT pass cookieOptions here; that's server-side only
// and breaks the browser cookie adapter with "Cannot read properties of undefined (reading 'get')"
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}





