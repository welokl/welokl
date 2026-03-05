import { createBrowserClient } from '@supabase/ssr'

// Simple factory — let @supabase/ssr handle its own singleton internally
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}






