import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { userId, subscription } = await req.json()
    if (!userId || !subscription) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Save subscription to users table
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: JSON.stringify(subscription),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
