'use client'
import { useEffect, useState } from 'react'

export default function FavouriteButton({ shopId }: { shopId: string }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    setSaved(ids.includes(shopId))
  }, [shopId])

  function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    let updated: string[]
    if (ids.includes(shopId)) {
      updated = ids.filter(id => id !== shopId)
      setSaved(false)
    } else {
      updated = [...ids, shopId]
      setSaved(true)
    }
    localStorage.setItem('welokl_favourites', JSON.stringify(updated))
  }

  return (
    <button
      onClick={toggle}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
        saved ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
      }`}
      title={saved ? 'Remove from saved' : 'Save shop'}
    >
      {saved ? '❤️' : '🤍'}
    </button>
  )
}
