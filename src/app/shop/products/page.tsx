'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Variant { label: string; price: string }
interface Category { id: string; name: string; slug: string; is_active: boolean }

// Categories that get the half/full variant option
function isFoodCategory(slug: string) {
  const q = slug.toLowerCase().replace(/[^a-z]/g, '')
  return q.includes('food') || q.includes('restro') || q.includes('restaurant') || q.includes('cafe') || q.includes('biryani') || q.includes('dhaba')
}

const DEFAULT_VARIANTS: Variant[] = [
  { label: 'Half', price: '' },
  { label: 'Full', price: '' },
]

export default function AddProductPage() {
  const router = useRouter()
  const [shopId, setShopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [useVariants, setUseVariants] = useState(false)
  const [variants, setVariants] = useState<Variant[]>(DEFAULT_VARIANTS)

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    category: '',
    is_veg: '',
    is_available: true,
  })

  const showVariantOption = isFoodCategory(form.category)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const [{ data: shop }, { data: cats }] = await Promise.all([
        supabase.from('shops').select('id').eq('owner_id', user.id).single(),
        supabase.from('categories').select('id,name,slug,is_active').eq('is_active', true).order('name'),
      ])
      if (!shop) { router.push('/shop/setup'); return }
      setShopId(shop.id)
      setCategories(cats ?? [])
    }
    init()
  }, [router])

  // Reset variant toggle when category changes away from food
  useEffect(() => {
    if (!showVariantOption) setUseVariants(false)
  }, [showVariantOption])

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateVariant(idx: number, field: keyof Variant, value: string) {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    setVariants(prev => [...prev, { label: '', price: '' }])
  }

  function removeVariant(idx: number) {
    setVariants(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!shopId) return
    if (!form.name.trim()) { setError('Product name is required'); return }

    // Variant mode validation
    if (useVariants) {
      const filled = variants.filter(v => v.label.trim() && v.price && !isNaN(Number(v.price)))
      if (filled.length < 1) { setError('Add at least one variant with a label and price'); return }
    } else {
      if (!form.price || isNaN(Number(form.price))) { setError('Valid price is required'); return }
    }

    setLoading(true)
    setError('')

    const supabase = createClient()

    // Build variants payload
    const variantsPayload = useVariants
      ? variants
          .filter(v => v.label.trim() && v.price && !isNaN(Number(v.price)))
          .map(v => ({ label: v.label.trim(), price: parseInt(v.price) }))
      : null

    // Base price: lowest variant price if using variants, else entered price
    const basePrice = useVariants
      ? Math.min(...variantsPayload!.map(v => v.price))
      : parseInt(form.price)

    const { error: insertError } = await supabase.from('products').insert({
      shop_id: shopId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: basePrice,
      original_price: form.original_price ? parseInt(form.original_price) : null,
      category: form.category || null,
      is_veg: form.is_veg === 'veg' ? true : form.is_veg === 'nonveg' ? false : null,
      is_available: form.is_available,
      variants: variantsPayload,
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

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product name *</label>
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                className="input-field" placeholder="e.g. Butter Chicken, Amul Milk 1L" required />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="input-field resize-none" rows={2} placeholder="Brief description..." />
            </div>

            {/* Category dropdown */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => update('category', e.target.value)}
                className="input-field"
                style={{ appearance: 'auto' }}
              >
                <option value="">Select a category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.slug || c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Price — hidden when using variants */}
            {!useVariants && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Selling price (₹) *</label>
                  <input type="number" value={form.price} onChange={e => update('price', e.target.value)}
                    className="input-field" placeholder="199" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Original price (₹)</label>
                  <input type="number" value={form.original_price} onChange={e => update('original_price', e.target.value)}
                    className="input-field" placeholder="249 (optional)" min="0" />
                </div>
              </div>
            )}

            {/* Variant toggle — only for food/restaurant categories */}
            {showVariantOption && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity options</label>
                <div className="flex gap-2 mb-3">
                  {[
                    { val: false, label: 'N/A — single price' },
                    { val: true,  label: 'Half / Full pricing' },
                  ].map(opt => (
                    <button key={String(opt.val)} type="button"
                      onClick={() => setUseVariants(opt.val)}
                      className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                        useVariants === opt.val ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {useVariants && (
                  <div className="space-y-2">
                    {variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={v.label}
                          onChange={e => updateVariant(idx, 'label', e.target.value)}
                          className="input-field flex-1"
                          placeholder="Label (e.g. Half, Full, Quarter)"
                        />
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                          <input
                            type="number"
                            value={v.price}
                            onChange={e => updateVariant(idx, 'price', e.target.value)}
                            className="input-field pl-7"
                            placeholder="Price"
                            min="0"
                          />
                        </div>
                        {variants.length > 1 && (
                          <button type="button" onClick={() => removeVariant(idx)}
                            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                            <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addVariant}
                      className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
                      + Add another variant
                    </button>
                    <p className="text-xs text-gray-400">Base price shown on listings = lowest variant price</p>
                  </div>
                )}
              </div>
            )}

            {/* Veg / Non-Veg */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Veg / Non-Veg</label>
              <div className="flex gap-2">
                {[
                  { val: 'veg',    label: '🟢 Veg' },
                  { val: 'nonveg', label: '🔴 Non-Veg' },
                  { val: '',       label: 'N/A' },
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

            {/* Available toggle */}
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
