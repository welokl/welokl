'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddProductPage() {
  const router = useRouter()
  const [shopId, setShopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    category: '',
    is_veg: '',
    is_available: true,
  })

  useEffect(() => {
    async function getShop() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { router.push('/shop/setup'); return }
      setShopId(shop.id)
    }
    getShop()
  }, [router])

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!shopId) return
    if (!form.name.trim()) { setError('Product name is required'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('Valid price is required'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error: insertError } = await supabase.from('products').insert({
      shop_id: shopId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseInt(form.price),
      original_price: form.original_price ? parseInt(form.original_price) : null,
      category: form.category.trim() || null,
      is_veg: form.is_veg === 'veg' ? true : form.is_veg === 'nonveg' ? false : null,
      is_available: form.is_available,
    })

    if (insertError) {
      setError('Could not add product: ' + insertError.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard/business'
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl">←</button>
        <h1 className="font-bold">Add Product</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product name *</label>
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                className="input-field" placeholder="e.g. Butter Chicken, Amul Milk 1L" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="input-field resize-none" rows={2} placeholder="Brief description..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Selling price (₹) *</label>
                <input type="number" value={form.price} onChange={e => update('price', e.target.value)}
                  className="input-field" placeholder="199" min="0" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Original price (₹)</label>
                <input type="number" value={form.original_price} onChange={e => update('original_price', e.target.value)}
                  className="input-field" placeholder="249 (optional)" min="0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
              <input type="text" value={form.category} onChange={e => update('category', e.target.value)}
                className="input-field" placeholder="e.g. Main Course, Dairy, Medicines" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Veg / Non-Veg</label>
              <div className="flex gap-2">
                {[
                  { val: 'veg', label: '🟢 Veg' },
                  { val: 'nonveg', label: '🔴 Non-Veg' },
                  { val: '', label: 'N/A' },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => update('is_veg', opt.val)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.is_veg === opt.val ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-semibold text-sm">Available to order</p>
                <p className="text-xs text-gray-400">Toggle off to temporarily hide this item</p>
              </div>
              <button type="button" onClick={() => update('is_available', !form.is_available)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.is_available ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.is_available ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Adding product...' : 'Add product →'}
          </button>
        </form>
      </div>
    </div>
  )
}
