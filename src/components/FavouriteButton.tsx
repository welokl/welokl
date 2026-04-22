'use client'
import { useEffect, useState } from 'react'

export default function FavouriteButton({ shopId }: { shopId: string }) {
  const [isFav, setIsFav] = useState(false)

  useEffect(() => {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('dwarpar_favourites') || '[]')
      setIsFav(ids.includes(shopId))
    } catch {}
  }, [shopId])

  function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('dwarpar_favourites') || '[]')
      const next = isFav ? ids.filter(id => id !== shopId) : [...ids, shopId]
      localStorage.setItem('dwarpar_favourites', JSON.stringify(next))
      setIsFav(!isFav)
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={isFav ? 'Remove from saved' : 'Save shop'}
      style={{
        width: 38, height: 38, borderRadius: '50%',
        background: isFav ? 'rgba(239,68,68,.12)' : 'var(--bg-3)',
        border: isFav ? '1.5px solid rgba(239,68,68,.3)' : '1.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 18, transition: 'all .2s',
        flexShrink: 0,
      }}
    >
      {isFav ? '❤️' : '🤍'}
    </button>
  )
}