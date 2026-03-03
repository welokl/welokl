'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function LocationPickerPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [lat, setLat] = useState(19.0760)
  const [lng, setLng] = useState(72.8777)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addressType, setAddressType] = useState<'home'|'work'|'other'>('home')
  const [customLabel, setCustomLabel] = useState('')

  const reverseGeocode = useCallback(async (lt: number, ln: number) => {
    setLat(lt)
    setLng(ln)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lt}&lon=${ln}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      const a = data.address || {}
      const areaVal = a.suburb || a.neighbourhood || a.quarter || a.village || a.town || ''
      const cityVal = a.city || a.town || a.county || 'Mumbai'
      const road = a.road || ''
      const houseNo = a.house_number || ''
      const parts = [houseNo, road, areaVal].filter(Boolean)
      setAddress(parts.join(', ') || data.display_name?.split(',').slice(0,3).join(',') || 'Selected location')
      setArea(areaVal)
      setCity(cityVal)
      setPincode(a.postcode || '')
    } catch {
      setAddress(`${lt.toFixed(4)}, ${ln.toFixed(4)}`)
    }
  }, [])

  useEffect(() => {
    // Load Leaflet CSS from CDN
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS from CDN
    if ((window as any).L) {
      initMap((window as any).L)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => initMap((window as any).L)
    script.onerror = () => setLoading(false)
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  function initMap(L: any) {
    if (!mapRef.current || mapInstanceRef.current) return

    let centerLat = 19.0760
    let centerLng = 72.8777

    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) { centerLat = saved.lat; centerLng = saved.lng }
    } catch {}

    const map = L.map(mapRef.current, { center: [centerLat, centerLng], zoom: 17, zoomControl: false })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const icon = L.divIcon({
      html: `<div style="width:36px;height:36px;background:#f97316;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(249,115,22,0.5)">
               <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);font-size:14px">📍</div>
             </div>`,
      className: '', iconSize: [36, 36], iconAnchor: [18, 36]
    })

    const marker = L.marker([centerLat, centerLng], { icon, draggable: false }).addTo(map)

    reverseGeocode(centerLat, centerLng)

    map.on('movestart', () => setDragging(true))
    map.on('moveend', () => {
      setDragging(false)
      const c = map.getCenter()
      marker.setLatLng(c)
      reverseGeocode(c.lat, c.lng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker
    setLoading(false)
  }

  function detectMyLocation() {
    if (!navigator.geolocation || !mapInstanceRef.current) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { animate: true, duration: 1.2 })
        setDetecting(false)
      },
      () => setDetecting(false),
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  function confirmLocation() {
    setSaving(true)
    const label = addressType === 'other' && customLabel ? customLabel : addressType
    const saved = { lat, lng, address, area, city, pincode, label, savedAt: new Date().toISOString() }
    localStorage.setItem('welokl_location', JSON.stringify(saved))
    const existing = JSON.parse(localStorage.getItem('welokl_addresses') || '[]')
    const updated = [saved, ...existing.filter((a: any) => a.label !== label)].slice(0, 5)
    localStorage.setItem('welokl_addresses', JSON.stringify(updated))
    const returnTo = new URLSearchParams(window.location.search).get('return') || '/stores'
    window.location.href = returnTo
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 z-10">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-lg">←</button>
        <div className="flex-1">
          <p className="text-xs text-gray-400 font-medium">Set delivery location</p>
          <p className="text-sm font-bold truncate">{area || city || 'Move map to select'}</p>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <div ref={mapRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 bg-white flex items-center justify-center z-20">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-bounce">🗺️</div>
              <p className="font-semibold text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {dragging && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white text-xs font-semibold px-4 py-2 rounded-full pointer-events-none">
            Drag to your location
          </div>
        )}

        <button onClick={detectMyLocation} disabled={detecting || loading}
          className="absolute bottom-4 right-4 z-20 bg-white shadow-lg rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all">
          {detecting ? <span className="animate-spin">⏳</span> : <span>🎯</span>}
          <span className="hidden sm:block">{detecting ? 'Detecting...' : 'My location'}</span>
        </button>
      </div>

      {/* Bottom sheet */}
      <div className="bg-white border-t border-gray-100 shadow-2xl flex-shrink-0">
        <div className="max-w-lg mx-auto p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">📍</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{area || city || 'Locating...'}</p>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{address}{pincode ? `, ${pincode}` : ''}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Save as</p>
            <div className="flex gap-2">
              {[{id:'home'as const,icon:'🏠',label:'Home'},{id:'work'as const,icon:'💼',label:'Work'},{id:'other'as const,icon:'📌',label:'Other'}].map(t => (
                <button key={t.id} onClick={() => setAddressType(t.id)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold flex items-center justify-center gap-1 transition-all ${addressType === t.id ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {addressType === 'other' && (
              <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                className="input-field mt-2 text-sm" placeholder="e.g. Parents house, Gym..." />
            )}
          </div>

          <button onClick={confirmLocation} disabled={saving || !address}
            className="btn-primary w-full py-3.5 text-base">
            {saving ? 'Saving...' : `Confirm ${addressType === 'home' ? '🏠 Home' : addressType === 'work' ? '💼 Work' : '📌 Other'} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
