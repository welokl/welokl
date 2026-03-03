'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface SearchResult {
  type: 'shop' | 'product'
  id: string
  name: string
  subtitle: string
  icon: string
  href: string
  price?: number
  shopId?: string
}

const RECENT_KEY = 'welokl_recent_searches'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [popular] = useState(['Butter Chicken', 'Amul Milk', 'Paracetamol', 'Mobile Charger', 'Biryani', 'Eggs'])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    inputRef.current?.focus()
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) setRecent(JSON.parse(saved))
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)

    const supabase = createClient()
    const term = q.trim().toLowerCase()

    const [{ data: shops }, { data: products }] = await Promise.all([
      supabase.from('shops').select('id, name, category_name, area, is_open, rating')
        .ilike('name', `%${term}%`).eq('is_active', true).limit(5),
      supabase.from('products').select('id, name, price, shop_id, shops(name, is_active)')
        .ilike('name', `%${term}%`).eq('is_available', true).limit(10),
    ])

    const shopResults: SearchResult[] = (shops || []).map(s => ({
      type: 'shop',
      id: s.id,
      name: s.name,
      subtitle: `${s.category_name?.split(' ')[0]} · ${s.area} · ★ ${s.rating} · ${s.is_open ? 'Open' : 'Closed'}`,
      icon: s.category_name?.includes('Food') ? '🍔' : s.category_name?.includes('Grocery') ? '🛒' :
            s.category_name?.includes('Pharmacy') ? '💊' : s.category_name?.includes('Electronics') ? '📱' : '🏪',
      href: `/stores/${s.id}`,
    }))

    const productResults: SearchResult[] = (products || [])
      .filter((p: any) => p.shops?.is_active)
      .map((p: any) => ({
        type: 'product',
        id: p.id,
        name: p.name,
        subtitle: `₹${p.price} · from ${p.shops?.name || 'Shop'}`,
        icon: '📦',
        href: `/stores/${p.shop_id}`,
        price: p.price,
        shopId: p.shop_id,
      }))

    setResults([...shopResults, ...productResults])
    setLoading(false)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  function saveRecent(term: string) {
    const updated = [term, ...recent.filter(r => r !== term)].slice(0, 8)
    setRecent(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  }

  function clearRecent() {
    setRecent([])
    localStorage.removeItem(RECENT_KEY)
  }

  const shopResults = results.filter(r => r.type === 'shop')
  const productResults = results.filter(r => r.type === 'product')

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      {/* Search header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => window.history.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-lg flex-shrink-0">
            ←
          </button>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-4 bg-gray-100 border-0 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              placeholder="Search shops, products..."
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* No query — show recent + popular */}
        {!query && (
          <div className="space-y-6">
            {recent.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">Recent searches</h3>
                  <button onClick={clearRecent} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map(r => (
                    <button key={r} onClick={() => setQuery(r)}
                      className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm hover:border-brand-500 transition-colors">
                      <span className="text-gray-400 text-xs">🕐</span> {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-bold text-sm mb-3">Popular searches</h3>
              <div className="flex flex-wrap gap-2">
                {popular.map(p => (
                  <button key={p} onClick={() => setQuery(p)}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm hover:border-brand-500 transition-colors">
                    <span className="text-xs">🔥</span> {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {query && loading && (
          <div className="space-y-3">
            {Array.from({length: 4}).map((_, i) => (
              <div key={i} className="h-16 card shimmer rounded-2xl" />
            ))}
          </div>
        )}

        {/* Results */}
        {query && !loading && results.length === 0 && query.length >= 2 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-bold">No results for "{query}"</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {query && !loading && results.length > 0 && (
          <div className="space-y-5">
            {shopResults.length > 0 && (
              <div>
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">Shops</h3>
                <div className="space-y-2">
                  {shopResults.map(result => (
                    <Link key={result.id} href={result.href} onClick={() => saveRecent(query)}>
                      <div className="card px-4 py-3 flex items-center gap-3 hover:shadow-md active:scale-95 transition-all">
                        <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{result.name}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{result.subtitle}</p>
                        </div>
                        <span className="text-gray-300 text-sm flex-shrink-0">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {productResults.length > 0 && (
              <div>
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">Products</h3>
                <div className="space-y-2">
                  {productResults.map(result => (
                    <Link key={`${result.id}-${result.shopId}`} href={result.href} onClick={() => saveRecent(query)}>
                      <div className="card px-4 py-3 flex items-center gap-3 hover:shadow-md active:scale-95 transition-all">
                        <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                          📦
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{result.name}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{result.subtitle}</p>
                        </div>
                        <span className="font-bold text-sm text-brand-500">₹{result.price}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
