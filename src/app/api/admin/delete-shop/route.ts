import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  // Get token from Authorization header (sent by client)
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify the token and get user
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin role
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shopId } = await req.json()
  if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 })

  // Get owner_id for storage cleanup
  const { data: shop } = await admin.from('shops').select('owner_id').eq('id', shopId).single()
  const ownerId = shop?.owner_id as string | undefined

  // Clean up storage files
  if (ownerId) {
    const { data: prods } = await admin.from('products').select('id').eq('shop_id', shopId)
    if (prods?.length) {
      const productPaths = prods.flatMap((p: { id: string }) => [
        `${ownerId}/${p.id}/1.webp`,
        `${ownerId}/${p.id}/2.webp`,
      ])
      await admin.storage.from('product-images').remove(productPaths)
    }
    await admin.storage.from('shop-images').remove([`${ownerId}/logo.webp`, `${ownerId}/banner.webp`])
  }

  // Delete products then shop (service role bypasses RLS + triggers)
  await admin.from('products').delete().eq('shop_id', shopId)
  const { error } = await admin.from('shops').delete().eq('id', shopId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
