'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageService'

const CATEGORIES = [
  'Food & Restaurants','Grocery','Pharmacy & Health','Electronics',
  'Fashion','Stationery','Hardware','Salon & Beauty','Pet Supplies','Flowers & Gifts',
]

export default function ShopSetupPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', category_name: 'Food & Restaurants',
    address: '', area: '', city: '', phone: '',
    latitude: '', longitude: '',
    delivery_enabled: true,
    min_order_amount: '0', avg_delivery_time: '30',
    opening_time: '09:00', closing_time: '22:00',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/auth/login'; return }
      supabase.from('users').select('role').eq('id', user.id).single().then(({ data }) => {
        if (data?.role !== 'business') { window.location.href = '/dashboard/customer'; return }
        supabase.from('shops').select('id').eq('owner_id', user.id).single().then(({ data: shop }) => {
          if (shop) { window.location.href = '/dashboard/business'; return }
          setUserId(user.id)
        })
      })
    })
  }, [])

  function up(field: string, value: string | boolean) { setForm(p => ({ ...p, [field]: value })) }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setError('Image must be under 3MB'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function detectLocation() {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude.toFixed(6)
        const lng = pos.coords.longitude.toFixed(6)
        up('latitude', lat); up('longitude', lng)
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          const d = await r.json()
          if (d.address) {
            const area = d.address.suburb || d.address.neighbourhood || d.address.village || ''
            const city = d.address.city || d.address.town || d.address.county || ''
            if (area) up('area', area)
            if (city) up('city', city)
          }
        } catch {}
        setLocating(false)
      },
      () => { setError('Could not detect location. Enter manually.'); setLocating(false) },
      { timeout: 8000 }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (!form.name.trim()) { setError('Shop name required'); return }
    if (!form.address.trim()) { setError('Address required'); return }
    if (!form.latitude || !form.longitude) { setError('Please detect or enter your location'); return }
    setLoading(true); setError('')

    const supabase = createClient()
    const { data: shop, error: err } = await supabase.from('shops').insert({
      owner_id: userId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_name: form.category_name,
      address: form.address.trim(),
      area: form.area.trim() || null,
      city: form.city.trim() || 'India',
      phone: form.phone.trim() || null,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      delivery_enabled: form.delivery_enabled,
      pickup_enabled: false,
      min_order_amount: parseInt(form.min_order_amount) || 0,
      avg_delivery_time: parseInt(form.avg_delivery_time) || 30,
      opening_time: form.opening_time,
      closing_time: form.closing_time,
      is_active: false, is_open: false, rating: null, verification_status: 'pending',
    }).select().single()

    if (err || !shop) { setError('Could not create shop: ' + (err?.message || 'unknown')); setLoading(false); return }

    // Upload shop photo if selected
    if (imageFile && shop.id) {
      const compressed = await compressImage(imageFile)
      const path = `${userId}/logo.webp`
      const { error: uploadErr } = await supabase.storage.from('shop-images').upload(path, compressed, { upsert: true, contentType: 'image/webp' })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('shop-images').getPublicUrl(path)
        await supabase.from('shops').update({ image_url: urlData.publicUrl }).eq('id', shop.id)
      }
    }

    setSuccess(true)
    setTimeout(() => { window.location.href = '/dashboard/business' }, 1500)
  }

  if (success) return (
    <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
      <div className="text-center"><div className="text-6xl mb-4">🎉</div>
        <h2 className="font-black text-2xl mb-2">Shop created!</h2>
        <p className="text-gray-400">Taking you to your dashboard...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f8f7f4' }}>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm" style={{ background: '#ff5a1f' }}>W</div>
        <h1 className="font-black text-base">Set up your shop</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="p-4 rounded-2xl mb-6 border" style={{ background: '#fff3ef', borderColor: '#fed7aa' }}>
          <p className="font-bold text-sm" style={{ color: '#c2410c' }}>🏪 Welcome to Welokl for Business</p>
          <p className="text-xs mt-1" style={{ color: '#ea580c' }}>Fill in your shop details below. Your location helps nearby customers find you.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Shop cover photo */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="block font-black text-sm mb-3">Shop Cover Photo</label>
            <label className="block cursor-pointer">
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={imagePreview} alt="Shop preview" className="w-full h-44 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
                    <span className="text-white font-bold text-sm">Change photo</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 hover:border-orange-400 transition-colors" style={{ borderColor: '#e5e7eb', background: '#fafafa' }}>
                  <span className="text-4xl">🏪</span>
                  <span className="font-bold text-sm text-gray-500">Add a cover photo for your shop</span>
                  <span className="text-xs text-gray-300">JPG, PNG · Max 3MB · Recommended 800×400</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-black text-sm text-gray-500 uppercase tracking-wider">Basic Info</h2>
            <div>
              <label className="block text-sm font-bold mb-1.5">Shop Name *</label>
              <input value={form.name} onChange={e => up('name', e.target.value)} className="input-field" placeholder="e.g. Sharma Grocery Store" required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => up('description', e.target.value)} className="input-field resize-none" rows={2} placeholder="What do you sell? What makes you special?" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Category *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => up('category_name', c)}
                    className="py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all text-left"
                    style={form.category_name === c ? { borderColor: '#ff5a1f', background: '#fff3ef', color: '#ff5a1f' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Phone Number</label>
              <input value={form.phone} onChange={e => up('phone', e.target.value)} className="input-field" placeholder="+91 98765 43210" type="tel" />
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-black text-sm text-gray-500 uppercase tracking-wider">Location</h2>
            <button type="button" onClick={detectLocation} disabled={locating}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{ background: locating ? '#f3f4f6' : '#f0fdf4', color: locating ? '#9ca3af' : '#16a34a', border: '1.5px solid', borderColor: locating ? '#e5e7eb' : '#bbf7d0' }}>
              {locating ? '📍 Detecting...' : '📍 Auto-detect my location'}
            </button>
            <div>
              <label className="block text-sm font-bold mb-1.5">Full Address *</label>
              <textarea value={form.address} onChange={e => up('address', e.target.value)} className="input-field resize-none" rows={2} placeholder="Shop no., Building, Street" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-1.5">Area / Locality</label>
                <input value={form.area} onChange={e => up('area', e.target.value)} className="input-field" placeholder="Bandra West" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5">City</label>
                <input value={form.city} onChange={e => up('city', e.target.value)} className="input-field" placeholder="Mumbai" />
              </div>
            </div>
            {form.latitude && (
              <div className="p-2.5 rounded-xl text-xs font-semibold" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                ✓ Location set: {form.latitude}, {form.longitude}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-1.5">Latitude</label>
                <input value={form.latitude} onChange={e => up('latitude', e.target.value)} className="input-field" placeholder="19.0760" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5">Longitude</label>
                <input value={form.longitude} onChange={e => up('longitude', e.target.value)} className="input-field" placeholder="72.8777" />
              </div>
            </div>
          </div>

          {/* Delivery settings */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-black text-sm text-gray-500 uppercase tracking-wider">Delivery Settings</h2>
            <div className="space-y-3">
              {[
                { field: 'delivery_enabled', label: 'Home Delivery', sub: 'Riders will deliver to customers' },
              ].map(({ field, label, sub }) => (
                <div key={field} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#f8f7f4' }}>
                  <div><p className="font-bold text-sm">{label}</p><p className="text-xs text-gray-400">{sub}</p></div>
                  <button type="button" onClick={() => up(field, !(form as any)[field])}
                    className="relative w-12 h-6 rounded-full transition-all"
                    style={{ background: (form as any)[field] ? '#ff5a1f' : '#d1d5db' }}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${(form as any)[field] ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-1.5">Min Order (₹)</label>
                <input type="number" value={form.min_order_amount} onChange={e => up('min_order_amount', e.target.value)} className="input-field" min="0" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5">Avg Delivery Time (min)</label>
                <input type="number" value={form.avg_delivery_time} onChange={e => up('avg_delivery_time', e.target.value)} className="input-field" min="5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-1.5">Opens at</label>
                <input type="time" value={form.opening_time} onChange={e => up('opening_time', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5">Closes at</label>
                <input type="time" value={form.closing_time} onChange={e => up('closing_time', e.target.value)} className="input-field" />
              </div>
            </div>
          </div>

          {error && <div className="p-4 rounded-2xl text-sm font-semibold bg-red-50 text-red-600 border border-red-200">{error}</div>}

          <button type="submit" disabled={loading || !userId}
            className="w-full py-4 rounded-2xl font-black text-base text-white transition-all active:scale-95 disabled:opacity-50"
            style={{ background: '#ff5a1f', boxShadow: '0 4px 20px rgba(255,90,31,0.35)' }}>
            {loading ? 'Creating your shop...' : '🚀 Create My Shop'}
          </button>
        </form>
      </div>
    </div>
  )
}
