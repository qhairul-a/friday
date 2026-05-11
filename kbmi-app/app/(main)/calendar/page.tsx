'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin, ChevronDown, ChevronUp, Download, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { RSVP } from '@/lib/mock-data'
import { useData } from '@/lib/data-context'
import { sanitizeHtml } from '@/lib/sanitize'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import MonthCalendar from '@/components/MonthCalendar'
import MediaCarousel from '@/components/MediaCarousel'

export default function CalendarPage() {
  const { tr, lang } = useLang()
  const { user } = useAuth()
  const { events, users, updateRSVP, addAuditEntry } = useData()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const handleRSVP = (eventId: string, status: RSVP['status']) => {
    if (!user) return
    const ev = events.find((e) => e.id === eventId)
    const statusLabel = status === 'attending' ? 'Attending' : status === 'not_attending' ? 'Not Attending' : 'Maybe'
    addAuditEntry(`RSVP'd ${statusLabel} to event: "${ev?.title || eventId}"`, user.name, 'Event')
    updateRSVP(eventId, { userId: user.id, userName: user.name, status })
  }

  const exportRSVP = async (ev: typeof events[0]) => {
    const XLSX = await import('xlsx')
    const data = ev.rsvps.map((r) => ({
      [lang === 'en' ? 'Name' : 'Nama']: r.userName,
      [lang === 'en' ? 'Status' : 'Status']: r.status === 'attending'
        ? (lang === 'en' ? 'Attending' : 'Hadir')
        : r.status === 'not_attending'
        ? (lang === 'en' ? 'Not Attending' : 'Tidak Hadir')
        : (lang === 'en' ? 'Maybe' : 'Mungkin'),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RSVP')
    XLSX.writeFile(wb, `RSVP_${ev.title.replace(/\s+/g, '_')}.xlsx`)
  }

  const rsvpButtons = [
    { status: 'attending' as const, icon: CheckCircle, label: tr.attending, activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold' },
    { status: 'maybe' as const, icon: HelpCircle, label: tr.maybe, activeClass: 'border-amber-400 bg-amber-50 text-amber-700 font-bold' },
    { status: 'not_attending' as const, icon: XCircle, label: tr.notAttending, activeClass: 'border-red-300 bg-red-50 text-red-600 font-bold' },
  ]

  const countByStatus = (ev: typeof events[0], s: RSVP['status']) => ev.rsvps.filter((r) => r.status === s).length

  // Filter events for selected day, or show all upcoming
  const filteredEvents = selectedDate
    ? events.filter((ev) => ev.date === selectedDate)
    : events.filter((ev) => ev.date >= new Date().toISOString().slice(0, 10))

  return (
    <div className="space-y-4">
      <div className="relative bg-[#2D1B5E] -mx-4 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/events.png"
          alt=""
          className="absolute right-0 top-0 h-36 w-auto object-cover object-top pointer-events-none"
        />
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/family" className="text-white/70 hover:text-white shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-white">{tr.upcomingEvents}</h2>
            <p className="text-sm text-violet-300 mt-0.5">{lang === 'en' ? 'Plan ahead with the family' : 'Rancang bersama keluarga'}</p>
          </div>
        </div>
      </div>

      {/* Monthly calendar */}
      <MonthCalendar
        events={events}
        onDayClick={(date) => setSelectedDate(selectedDate === date ? null : date)}
        selectedDate={selectedDate}
      />

      {/* Day filter chip */}
      {selectedDate && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {lang === 'en' ? `Events on ${selectedDate}` : `Acara pada ${selectedDate}`}
          </span>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-xs text-emerald-700 hover:underline"
          >
            {lang === 'en' ? 'Show all' : 'Tunjuk semua'}
          </button>
        </div>
      )}

      {/* Events list */}
      <div className="space-y-3">
        {filteredEvents.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">{tr.noData}</div>
        )}

        {filteredEvents.map((ev) => {
          const myRsvp = ev.rsvps.find((r) => r.userId === user?.id)
          const isExpanded = expandedEvent === ev.id

          return (
            <div key={ev.id} className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
              {/* Event header */}
              <div className="bg-emerald-700 px-4 pt-4 pb-3 text-white">
                <h3 className="font-bold text-base leading-snug">{ev.title}</h3>
                <div className="mt-2 flex flex-col gap-1 text-sm opacity-90">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>{ev.date} · {ev.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">{ev.location}</span>
                  </div>
                </div>
              </div>

              {ev.media && ev.media.length > 0 && (
                <MediaCarousel media={ev.media} aspectRatio="landscape" />
              )}

              <div className="p-4 space-y-3">
                {ev.htmlContent ? (
                  <div
                    className="prose prose-sm max-w-none text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(ev.htmlContent) }}
                  />
                ) : (
                  <p className="text-sm text-gray-600">{ev.description}</p>
                )}

                {/* RSVP summary */}
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                    {countByStatus(ev, 'attending')} {lang === 'en' ? 'attending' : 'hadir'}
                  </span>
                  <span className="flex items-center gap-1">
                    <HelpCircle className="h-3 w-3 text-amber-500" />
                    {countByStatus(ev, 'maybe')} {lang === 'en' ? 'maybe' : 'mungkin'}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-400" />
                    {countByStatus(ev, 'not_attending')} {lang === 'en' ? 'not going' : 'tidak hadir'}
                  </span>
                </div>

                {/* RSVP buttons */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{tr.rsvp}</div>
                  <div className="flex gap-2 flex-wrap">
                    {rsvpButtons.map(({ status, icon: Icon, label, activeClass }) => {
                      const active = myRsvp?.status === status
                      return (
                        <button
                          key={status}
                          onClick={() => handleRSVP(ev.id, status)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                            active ? activeClass : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {myRsvp && (
                    <p className="mt-2 text-xs text-gray-400">
                      {lang === 'en' ? 'Your RSVP: ' : 'RSVP anda: '}
                      <span className="font-medium text-gray-600">
                        {rsvpButtons.find((b) => b.status === myRsvp.status)?.label}
                      </span>
                    </p>
                  )}
                </div>

                {/* Admin: RSVP list + export */}
                {isAdmin && (
                  <div className="border-t border-gray-100 pt-3">
                    <div
                      role="button"
                      onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}
                      className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-gray-700"
                    >
                      <span>
                        {lang === 'en' ? 'RSVP Responses' : 'Senarai RSVP'} ({ev.rsvps.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); exportRSVP(ev) }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800 transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          {lang === 'en' ? 'Export Excel' : 'Eksport Excel'}
                        </button>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {ev.rsvps.length === 0 && (
                          <p className="text-xs text-gray-400">{lang === 'en' ? 'No RSVPs yet.' : 'Belum ada RSVP.'}</p>
                        )}
                        {ev.rsvps.map((r) => (
                          <div key={r.userId} className="flex items-center gap-3">
                            <Avatar className="h-7 w-7 bg-gray-100">
                              {users.find((u) => u.id === r.userId)?.profilePhoto && (
                                <AvatarImage src={users.find((u) => u.id === r.userId)!.profilePhoto!} />
                              )}
                              <AvatarFallback className="text-xs text-gray-600">
                                {r.userName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-sm text-gray-700">{r.userName}</span>
                            <Badge className={`text-xs ${
                              r.status === 'attending' ? 'bg-emerald-100 text-emerald-700'
                              : r.status === 'maybe' ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-600'
                            }`}>
                              {rsvpButtons.find((b) => b.status === r.status)?.label}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
