'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, ShoppingBag, Wrench, HelpCircle, Phone, Clock, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-context'
import { MarketplaceListing } from '@/lib/mock-data'
import { sanitizeHtml } from '@/lib/sanitize'

const categoryConfig = {
  sale: {
    icon: ShoppingBag,
    colorClass:    'bg-emerald-100 text-emerald-700',
    cardBg:        'bg-emerald-50',
    borderUnread:  'border-emerald-300',
    borderRead:    'border-emerald-100',
    titleUnread:   'text-emerald-900',
    titleRead:     'text-emerald-500',
    bodyText:      'text-emerald-800',
    metaText:      'text-emerald-600',
    priceText:     'text-emerald-700',
    contactClass:  'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    en: 'For Sale', ms: 'Untuk Dijual',
  },
  service: {
    icon: Wrench,
    colorClass:    'bg-blue-100 text-blue-700',
    cardBg:        'bg-blue-50',
    borderUnread:  'border-blue-300',
    borderRead:    'border-blue-100',
    titleUnread:   'text-blue-900',
    titleRead:     'text-blue-500',
    bodyText:      'text-blue-800',
    metaText:      'text-blue-600',
    priceText:     'text-blue-700',
    contactClass:  'bg-blue-100 text-blue-700 hover:bg-blue-200',
    en: 'Service', ms: 'Perkhidmatan',
  },
  request: {
    icon: HelpCircle,
    colorClass:    'bg-amber-100 text-amber-700',
    cardBg:        'bg-amber-50',
    borderUnread:  'border-amber-300',
    borderRead:    'border-amber-100',
    titleUnread:   'text-amber-900',
    titleRead:     'text-amber-500',
    bodyText:      'text-amber-800',
    metaText:      'text-amber-600',
    priceText:     'text-amber-700',
    contactClass:  'bg-amber-100 text-amber-700 hover:bg-amber-200',
    en: 'Request', ms: 'Permintaan',
  },
}

const today = new Date().toISOString().slice(0, 10)

export default function MarketplacePage() {
  const { tr, lang } = useLang()
  const { user } = useAuth()
  const { listings, users, pushExpiryNotification, toggleListingRead, deleteListing, addAuditEntry } = useData()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [filter, setFilter] = useState<'all' | MarketplaceListing['category']>('all')
  const notifiedIds = useRef<Set<string>>(new Set())

  // Check for expired listings belonging to current user and notify once
  useEffect(() => {
    if (!user) return
    listings.forEach((l) => {
      if (l.sellerId === user.id && l.expiresAt < today && !notifiedIds.current.has(l.id)) {
        notifiedIds.current.add(l.id)
        pushExpiryNotification(l)
      }
    })
  }, [listings, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter out expired listings, then apply category filter
  const active = listings.filter((l) => l.expiresAt >= today)
  const filtered = filter === 'all' ? active : active.filter((l) => l.category === filter)

  const isUnread = (l: MarketplaceListing) => !(l.readBy ?? []).includes(user?.id ?? '')
  const unreadCount = (cat: 'all' | MarketplaceListing['category']) =>
    active.filter((l) => (cat === 'all' || l.category === cat) && isUnread(l)).length

  const filters = [
    { value: 'all',     en: 'All',      ms: 'Semua' },
    { value: 'sale',    en: 'For Sale', ms: 'Jual' },
    { value: 'service', en: 'Services', ms: 'Servis' },
    { value: 'request', en: 'Requests', ms: 'Permintaan' },
  ] as const

  const daysLeft = (expiresAt: string) => {
    const diff = Math.ceil((new Date(expiresAt).getTime() - new Date(today).getTime()) / 86400000)
    return diff
  }

  return (
    <div className="space-y-4">
      <div className="relative bg-[#2D1B5E] -mx-4 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketplace.png"
          alt=""
          className="absolute right-0 top-0 h-36 w-auto object-cover object-top pointer-events-none"
        />
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/family" className="text-white/70 hover:text-white shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-white">{tr.marketplace}</h2>
            <p className="text-sm text-violet-300 mt-0.5">{lang === 'en' ? 'Buy, sell & swap within the family' : 'Jual beli dalam keluarga'}</p>
          </div>
        </div>
      </div>

      {/* Filter pills + New Listing button */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          {filters.map(({ value, en, ms }) => {
            const count = unreadCount(value)
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`shrink-0 relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === value
                    ? 'bg-[#2D1B5E] text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {lang === 'en' ? en : ms}
                {count > 0 && (
                  <span className={`inline-flex h-4.5 min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                    filter === value ? 'bg-white text-violet-700' : 'bg-violet-600 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <Link
          href="/marketplace/new"
          className="shrink-0 rounded-full bg-violet-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors"
        >
          + {lang === 'en' ? 'New' : 'Baru'}
        </Link>
      </div>

      {/* Listings */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{tr.noData}</div>
        )}
        {filtered.map((listing) => {
          const config = categoryConfig[listing.category]
          const Icon = config.icon
          const days = daysLeft(listing.expiresAt)
          const expiringSoon = days <= 7
          const read = !isUnread(listing)
          const initials = listing.sellerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

          const sellerPhoto = users.find((u) => u.id === listing.sellerId)?.profilePhoto
          return (
            <div key={listing.id} className={`rounded-2xl bg-white shadow-sm overflow-hidden border transition-colors ${read ? 'border-gray-100' : 'border-violet-200'}`}>
              {/* Header — seller info */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <Avatar className={`h-9 w-9 shrink-0 ${config.colorClass}`}>
                  {sellerPhoto && <AvatarImage src={sellerPhoto} />}
                  <AvatarFallback className={`text-xs font-bold ${config.colorClass}`}>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{listing.sellerName}</span>
                    <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.colorClass}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {lang === 'en' ? config.en : config.ms}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{listing.createdAt}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {expiringSoon && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      <Clock className="h-2.5 w-2.5" />
                      {lang === 'en' ? `${days}d left` : `${days} hari`}
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        deleteListing(listing.id)
                        addAuditEntry(`Deleted marketplace listing: "${listing.title}"`, user!.name, 'Marketplace')
                      }}
                      title={lang === 'en' ? 'Delete listing' : 'Padam senarai'}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Photo */}
              {listing.photos && listing.photos.length > 0 && (
                <div className="relative w-full aspect-[4/3] bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={listing.photos[0]} alt="" className="h-full w-full object-cover" />
                  {listing.photos.length > 1 && (
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      {listing.photos.slice(1, 4).map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt="" className="h-12 w-12 rounded-lg object-cover border-2 border-white shadow" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="px-4 pt-3 pb-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-bold text-sm leading-snug flex-1 ${read ? 'text-gray-500' : 'text-gray-900'}`}>{listing.title}</p>
                  <span className={`text-sm font-extrabold shrink-0 ${config.priceText}`}>{listing.price}</span>
                </div>
                {listing.htmlDescription
                  ? <div className="prose prose-sm max-w-none line-clamp-3 text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: sanitizeHtml(listing.htmlDescription) }} />
                  : <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">{listing.description}</p>
                }

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => user && toggleListingRead(listing.id, user.id)}
                    title={read ? (lang === 'en' ? 'Mark as unread' : 'Tandakan belum dibaca') : (lang === 'en' ? 'Mark as read' : 'Tandakan telah dibaca')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      read ? 'bg-gray-100 text-gray-400 hover:bg-gray-200' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                    }`}
                  >
                    {read
                      ? <><CheckCircle2 className="h-3.5 w-3.5" />{lang === 'en' ? 'Read' : 'Dibaca'}</>
                      : <><Circle className="h-3.5 w-3.5" />{lang === 'en' ? 'Unread' : 'Belum Baca'}</>
                    }
                  </button>
                  {(() => {
                    const phone = users.find((u) => u.id === listing.sellerId)?.phone
                    const digits = phone?.replace(/\D/g, '') ?? ''
                    const msg = encodeURIComponent(`Hi, I'm interested in your listing: "${listing.title}"`)
                    const href = digits ? `https://wa.me/${digits}?text=${msg}` : undefined
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={!href}
                        className={`ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${config.contactClass} ${!href ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        <Phone className="h-3 w-3" />
                        {tr.contact}
                      </a>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
