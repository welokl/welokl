'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const categories = [
  'Food & Restaurants','Grocery','Pharmacy & Health','Electronics',
  'Fashion','Stationery','Hardware','Salon & Beauty','Pet Supplies','Flowers & Gifts',
]

export default function ShopSetupPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', category_name: 'Food & Restaurants',
    address: '', area: '', city: 'Mumbai', phone: '',
    latitude: '', longitude: '',
    delivery_enabled: true, pickup_enabled: true,
    min_order_amount: '0', avg_delivery_time: '30',
    opens_at: '09:00', closes_at: '22:00',
  })

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role !== 'business') { window.location.href = '/dashboard/customer'; return }
      const { data: existing } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (existing) { window.location.href = '/dashboard/business'; return }
      setUserId(user.id)
    }
    getUser()
  }, [])

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function detectLocation() {
    if (!navigator.geolocation) { setError('Geolocation not supported by your browser'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6)
        const lng = pos.coords.longitude.toFixed(6)
        setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))

        // Reverse geocode using OpenStreetMap (free, no API key)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const data = await res.json()
          const addr = data.address
          const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || ''
          const city = addr.city || addr.town || addr.county || 'Mumbai'
          const road = addr.road || ''
          const houseNumber = addr.house_number || ''
          const fullAddress = [houseNumber, road, area].filter(Boolean).join(', ')
          setForm(prev => ({
            ...prev,
            address: prev.address || fullAddress,
            area: prev.area || area,
            city: prev.city || city,
          }))
        } catch {}
        setLocating(false)
      },
      (err) => {
        setError('Could not get location. Please enter manually.')
        setLocating(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (!form.name.trim()) { setError('Shop name is required'); return }
    if (!form.address.trim()) { setError('Address is required'); return }
    if (!form.latitude || !form.longitude) { setError('Please detect or enter your shop location'); return }

    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('shops').insert({
      owner_id: userId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_name: form.category_name,
      address: form.address.trim(),
      area: form.area.trim() || null,
      city: form.city.trim() || 'Mumbai',
      phone: form.phone.trim() || null,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      delivery_enabled: form.delivery_enabled,
      pickup_enabled: form.pickup_enabled,
      min_order_amount: parseInt(form.min_order_amount) || 0,
      avg_delivery_time: parseInt(form.avg_delivery_time) || 30,
      opens_at: form.opens_at,
      closes_at: form.closes_at,
      is_active: true, is_open: true, rating: 5.0,
    })

    if (err) { setError('Could not create shop: ' + err.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => { window.location.href = '/dashboard/business' }, 1500)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
        <div className="text-center"><div className="text-6xl mb-4">🎉</div>
          <h2 className="font-bold text-2xl mb-2">Shop created!</h2>
          <p className="text-gray-400">Taking you to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafaf7] pb-20">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-sm">W</div>
        <h1 className="font-bold">Set up your shop</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-4 mb-6 bg-brand-50 border-brand-100">
          <p className="font-bold text-brand-700 text-sm">🏪 Welcome to Welokl for Business</p>
          <p className="text-xs text-brand-600 mt-1">Fill in your shop details. Location is important — it helps nearby customers find you.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Basic Info */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold">Basic Info</h2>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Shop name *</label>
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                className="input-field" placeholder="Raj's Kitchen, Daily Fresh Mart..." required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="input-field resize-none" rows={2} placeholder="What do you sell? What makes you special?" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <button key={cat} type="button" onClick={() => update('category_name', cat)}
                    className={`p-2.5 rounded-xl border-2 text-left text-sm transition-all ${form.category_name === cat ? 'border-brand-500 bg-brand-50 font-semibold text-brand-600' : 'border-gray-200 text-gray-600'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location — most important */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Shop Location</h2>
              <span className="text-xs text-gray-400">Precise location = more customers</span>
            </div>

            {/* GPS detect button */}
            <button type="button" onClick={detectLocation} disabled={locating}
              className={`w-full py-3 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                form.latitude ? 'border-green-500 bg-green-50 text-green-700' : 'border-brand-500 bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}>
              {locating ? (
                <><span className="animate-spin">⏳</span> Detecting precise location...</>
              ) : form.latitude ? (
                <><span>✅</span> Location detected — {form.latitude}, {form.longitude} (tap to re-detect)</>
              ) : (
                <><span>📍</span> Detect my shop location (GPS)</>
              )}
            </button>

            {/* Manual lat/lng if GPS fails */}
            {!form.latitude && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Latitude (manual)</label>
                  <input type="number" step="any" value={form.latitude} onChange={e => update('latitude', e.target.value)}
                    className="input-field text-sm" placeholder="e.g. 19.0760" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Longitude (manual)</label>
                  <input type="number" step="any" value={form.longitude} onChange={e => update('longitude', e.target.value)}
                    className="input-field text-sm" placeholder="e.g. 72.8777" />
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">💡 Tip: Open Google Maps, long press your shop location, copy the coordinates shown at top</p>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full address *</label>
              <input type="text" value={form.address} onChange={e => update('address', e.target.value)}
                className="input-field" placeholder="Shop no., building, street name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Area / Locality</label>
                <input type="text" value={form.area} onChange={e => update('area', e.target.value)}
                  className="input-field" placeholder="Bandra, Andheri..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">City</label>
                <input type="text" value={form.city} onChange={e => update('city', e.target.value)}
                  className="input-field" placeholder="Mumbai" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Shop phone</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                className="input-field" placeholder="9876543210" />
            </div>
          </div>

          {/* Operations */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold">Operations</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.delivery_enabled ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                <input type="checkbox" checked={form.delivery_enabled} onChange={e => update('delivery_enabled', e.target.checked)} className="accent-brand-500" />
                <div><p className="font-bold text-sm">🛵 Delivery</p><p className="text-xs text-gray-400">We assign riders</p></div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.pickup_enabled ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                <input type="checkbox" checked={form.pickup_enabled} onChange={e => update('pickup_enabled', e.target.checked)} className="accent-brand-500" />
                <div><p className="font-bold text-sm">🏃 Pickup</p><p className="text-xs text-gray-400">Customer collects</p></div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min order (₹)</label>
                <input type="number" value={form.min_order_amount} onChange={e => update('min_order_amount', e.target.value)} className="input-field" min="0" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Delivery time (min)</label>
                <input type="number" value={form.avg_delivery_time} onChange={e => update('avg_delivery_time', e.target.value)} className="input-field" min="5" max="120" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Opens at</label>
                <input type="time" value={form.opens_at} onChange={e => update('opens_at', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Closes at</label>
                <input type="time" value={form.closes_at} onChange={e => update('closes_at', e.target.value)} className="input-field" />
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Creating shop...' : 'Create shop & go to dashboard →'}
          </button>
        </form>
      </div>
    </div>
  )
}
