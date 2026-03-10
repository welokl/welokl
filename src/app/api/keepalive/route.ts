import { createClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// GET /api/keepalive — ping DB to prevent Supabase free plan from pausing
// Call this from an external cron (e.g. cron-job.org every 5 days) 
export async function GET() {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('platform_config').select('id').limit(1)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}