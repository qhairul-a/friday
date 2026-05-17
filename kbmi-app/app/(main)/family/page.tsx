'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GitBranch, MessageCircle, Users, DollarSign, MessageSquare, CalendarDays, ShoppingBag, Megaphone, BarChart3, Pencil, Trash2, Check, X } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function FamilyPage() {
  const { tr, lang } = useLang()
  const { user } = useAuth()
  const { welcomeMessage, saveWelcomeMessage } = useData()

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const startEdit = () => {
    setEditTitle(welcomeMessage?.title ?? '')
    setEditBody(welcomeMessage?.body ?? '')
    setConfirmDelete(false)
    setEditing(true)
  }

  const handleSave = async () => {
    if (!editTitle.trim()) return
    await saveWelcomeMessage({ title: editTitle.trim(), body: editBody.trim() })
    setEditing(false)
  }

  const handleDelete = async () => {
    await saveWelcomeMessage(null)
    setConfirmDelete(false)
  }

  const sections = [
    { href: '/announcements', icon: Megaphone,     labelEn: 'Bulletin',      labelMs: 'Buletin',       color: 'bg-orange-500' },
    { href: '/calendar',      icon: CalendarDays,  labelEn: 'Events',        labelMs: 'Acara',         color: 'bg-rose-500' },
    { href: '/marketplace',   icon: ShoppingBag,   labelEn: 'Marketplace',   labelMs: 'Pasaran',       color: 'bg-purple-500' },
    { href: '/polls',         icon: BarChart3,     labelEn: 'Polls',         labelMs: 'Undian',        color: 'bg-indigo-500' },
    { href: '/family/chats',  icon: MessageCircle, labelEn: 'Social Media',  labelMs: 'Media Sosial',  color: 'bg-green-500' },
    { href: '/family/tree',   icon: GitBranch,     labelEn: 'Family Tree',   labelMs: 'Pokok Keluarga',color: 'bg-emerald-500' },
    { href: '/family/exco',   icon: Users,         labelEn: 'Exco',          labelMs: 'Exco',          color: 'bg-teal-500' },
    { href: '/family/contributions', icon: DollarSign, labelEn: 'Contributions', labelMs: 'Sumbangan', color: 'bg-amber-500' },
    { href: '/family/feedback', icon: MessageSquare, labelEn: 'Feedback',    labelMs: 'Maklum Balas',  color: 'bg-blue-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="relative bg-[#2D1B5E] -mx-4 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kbmi.png" alt="" className="absolute right-0 top-0 h-36 w-auto object-cover object-top pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white">{tr.family}</h2>
          <p className="text-sm text-violet-300 mt-1">{tr.appFull}</p>
        </div>
      </div>

      {/* Welcome card */}
      {(welcomeMessage || isAdmin) && (
        <div className="rounded-2xl bg-white px-5 py-4 shadow-sm border border-gray-100">
          {editing ? (
            <div className="space-y-3">
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder={lang === 'en' ? 'Title' : 'Tajuk'}
                className="font-bold"
              />
              <Textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                placeholder={lang === 'en' ? 'Message body…' : 'Isi mesej…'}
                rows={5}
                className="text-sm resize-none"
              />
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Save' : 'Simpan'}
                </Button>
                <Button onClick={() => setEditing(false)} size="sm" variant="outline" className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Cancel' : 'Batal'}
                </Button>
              </div>
            </div>
          ) : welcomeMessage ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-bold text-gray-900">{welcomeMessage.title}</p>
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={startEdit} className="p-1 text-gray-400 hover:text-violet-600 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDelete ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={handleDelete} className="text-red-600 font-semibold hover:underline">{lang === 'en' ? 'Yes' : 'Ya'}</button>
                        <span className="text-gray-300">/</span>
                        <button onClick={() => setConfirmDelete(false)} className="text-gray-500 hover:underline">{lang === 'en' ? 'No' : 'Tidak'}</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {welcomeMessage.body.split('\n\n').map((para, i) => (
                <p key={i} className={`text-sm leading-relaxed ${i === welcomeMessage.body.split('\n\n').length - 1 ? 'font-semibold text-violet-700' : 'text-gray-600'}`}>
                  {para}
                </p>
              ))}
            </div>
          ) : isAdmin ? (
            /* Message was deleted — show restore prompt for admins */
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 italic">{lang === 'en' ? 'Welcome message hidden.' : 'Mesej aluan disembunyikan.'}</p>
              <button onClick={startEdit} className="text-xs text-violet-600 hover:underline font-medium">
                {lang === 'en' ? 'Restore' : 'Pulihkan'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
        {sections.map(({ href, icon: Icon, labelEn, labelMs, color }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 group">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${color} shadow-md group-active:scale-90 transition-transform`}>
              <Icon className="h-8 w-8 text-white" strokeWidth={1.8} />
            </div>
            <span className="text-center text-xs font-medium text-gray-700 leading-tight">
              {lang === 'en' ? labelEn : labelMs}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
