'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { uploadChildPhoto, setChildPhotoUrl } from '@/lib/queries'
import type { ChildName } from '@/types'

const CHILDREN: { name: ChildName; emoji: string; color: string }[] = [
  { name: 'qasim', emoji: '📚', color: 'violet' },
  { name: 'muadz', emoji: '⭐', color: 'emerald' },
]

interface Props {
  initialPhotos: Record<ChildName, string | null>
}

export function ProfileManager({ initialPhotos }: Props) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [loading, setLoading] = useState<ChildName | null>(null)
  const inputRefs = useRef<Record<ChildName, HTMLInputElement | null>>({ qasim: null, muadz: null })

  async function handleFileChange(child: ChildName, file: File) {
    setLoading(child)
    try {
      const url = await uploadChildPhoto(child, file)
      await setChildPhotoUrl(child, url)
      setPhotos(prev => ({ ...prev, [child]: url }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-300 mb-4">Profile Photos</h2>
      <div className="flex gap-6 flex-wrap">
        {CHILDREN.map(({ name, emoji, color }) => (
          <div key={name} className="flex flex-col items-center gap-3">
            <div
              className={`w-20 h-20 rounded-full overflow-hidden border-2 ${
                color === 'violet' ? 'border-violet-600' : 'border-emerald-600'
              } flex items-center justify-center bg-slate-700 cursor-pointer relative`}
              onClick={() => inputRefs.current[name]?.click()}
            >
              {loading === name ? (
                <div className="animate-spin text-2xl">⏳</div>
              ) : photos[name] ? (
                <Image src={photos[name]!} alt={name} fill className="object-cover" unoptimized />
              ) : (
                <span className="text-3xl">{emoji}</span>
              )}
            </div>
            <span className="text-slate-400 text-sm capitalize">{name}</span>
            <input
              ref={el => { inputRefs.current[name] = el }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(name, f) }}
            />
            <button
              onClick={() => inputRefs.current[name]?.click()}
              className={`text-xs px-3 py-1 rounded-lg ${
                color === 'violet'
                  ? 'bg-violet-900/50 text-violet-300 hover:bg-violet-800/50'
                  : 'bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50'
              } transition-colors`}
            >
              {photos[name] ? 'Change photo' : 'Upload photo'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
