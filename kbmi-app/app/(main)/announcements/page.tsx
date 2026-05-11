'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pin, MessageCircle, Heart, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useData } from '@/lib/data-context'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Announcement, MediaItem } from '@/lib/mock-data'

function PostMedia({ media }: { media: MediaItem[] }) {
  const [current, setCurrent] = useState(0)

  if (!media || media.length === 0) return null

  const item = media[current]

  return (
    <div className="relative w-full aspect-square bg-gray-100 select-none">
      {item.type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.caption || ''}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <video
          src={item.url}
          className="h-full w-full object-cover"
          controls
          playsInline
        />
      )}

      {/* Prev/Next arrows */}
      {media.length > 1 && current > 0 && (
        <button
          onClick={() => setCurrent(current - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {media.length > 1 && current < media.length - 1 && (
        <button
          onClick={() => setCurrent(current + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Dot indicators */}
      {media.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {media.map((_, i) => (
            <span
              key={i}
              className={`block rounded-full transition-all ${
                i === current ? 'h-1.5 w-4 bg-white' : 'h-1.5 w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ ann, lang, tr }: { ann: Announcement; lang: string; tr: ReturnType<typeof useLang>['tr'] }) {
  const [liked, setLiked] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasMedia = ann.media && ann.media.length > 0
  const caption = ann.content || ''
  const longCaption = caption.length > 120
  const displayCaption = expanded || !longCaption ? caption : caption.slice(0, 120) + '…'

  return (
    <article className="bg-white border-b border-gray-100">
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-bold bg-emerald-100 text-emerald-800">
            {ann.authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 leading-tight">{ann.authorName}</span>
            {ann.isPinned && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] flex items-center gap-0.5 py-0 px-1.5 h-4">
                <Pin className="h-2 w-2" />
                {lang === 'en' ? 'Pinned' : 'Disematkan'}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-gray-400 leading-tight">{ann.createdAt}</div>
        </div>
      </div>

      {/* Media */}
      {hasMedia && <PostMedia media={ann.media} />}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-1">
        <button
          onClick={() => setLiked((v) => !v)}
          className={`transition-colors ${liked ? 'text-red-500' : 'text-gray-700 hover:text-red-400'}`}
          aria-label="Like"
        >
          <Heart className={`h-6 w-6 ${liked ? 'fill-red-500' : ''}`} />
        </button>
        <Link
          href={`/announcements/${ann.id}`}
          className="text-gray-700 hover:text-gray-500 transition-colors"
          aria-label="Comment"
        >
          <MessageCircle className="h-6 w-6" />
        </Link>
      </div>

      {/* Caption + title */}
      <div className="px-4 pb-3 space-y-1">
        {/* Title as bold heading */}
        <Link href={`/announcements/${ann.id}`}>
          <h3 className="text-sm font-bold text-gray-900 leading-snug">{ann.title}</h3>
        </Link>

        {/* Body text */}
        {caption && (
          <p className="text-sm text-gray-700 leading-relaxed">
            {displayCaption}
            {longCaption && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="ml-1 text-gray-400 font-medium text-xs"
              >
                {lang === 'en' ? 'more' : 'lebih'}
              </button>
            )}
          </p>
        )}

        {/* Comments link */}
        {ann.comments.length > 0 && (
          <Link
            href={`/announcements/${ann.id}`}
            className="block text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
          >
            {lang === 'en'
              ? `View all ${ann.comments.length} comment${ann.comments.length !== 1 ? 's' : ''}`
              : `Lihat semua ${ann.comments.length} komen`}
          </Link>
        )}
        {ann.comments.length === 0 && (
          <Link
            href={`/announcements/${ann.id}`}
            className="block text-xs text-gray-400 hover:text-emerald-600 transition-colors mt-1"
          >
            {lang === 'en' ? 'Add a comment…' : 'Tambah komen…'}
          </Link>
        )}
      </div>
    </article>
  )
}

export default function AnnouncementsPage() {
  const { tr, lang } = useLang()
  const { announcements } = useData()

  const sorted = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="-mx-4">
      {/* Header */}
      <div className="bg-[#2D1B5E] mx-0 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden relative mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bulletin.png"
          alt=""
          className="absolute right-0 top-0 h-36 w-auto object-cover object-top pointer-events-none"
        />
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/family" className="text-white/70 hover:text-white shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-white">{tr.announcements}</h2>
            <p className="text-sm text-violet-300 mt-0.5">
              {lang === 'en' ? 'Latest updates from the family' : 'Kemas kini terkini'}
            </p>
          </div>
        </div>
      </div>

      {/* Feed */}
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 px-4">
          {lang === 'en' ? 'No announcements yet.' : 'Tiada pengumuman lagi.'}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map((ann) => (
            <PostCard key={ann.id} ann={ann} lang={lang} tr={tr} />
          ))}
        </div>
      )}
    </div>
  )
}
