'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Plus, Pencil, Trash2, X, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-context'
import { GroupChat } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const platformColors: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700',
  telegram: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-800',
  youtube: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-100 text-gray-800',
  x: 'bg-gray-100 text-gray-900',
  other: 'bg-gray-100 text-gray-600',
}

const EMPTY_FORM = { name: '', platform: 'whatsapp' as GroupChat['platform'], url: '', description: '' }

export default function GroupChatsPage() {
  const { tr } = useLang()
  const { user } = useAuth()
  const { chats, addChat, updateChat, deleteChat, reorderChats } = useData()

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowAdd(true)
  }

  const openEdit = (chat: GroupChat) => {
    setForm({ name: chat.name, platform: chat.platform, url: chat.url, description: chat.description })
    setEditingId(chat.id)
    setShowAdd(false)
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.url.trim()) return
    if (editingId) {
      updateChat(editingId, form)
      setEditingId(null)
    } else {
      addChat(form)
      setShowAdd(false)
    }
    setForm(EMPTY_FORM)
  }

  const handleCancel = () => {
    setShowAdd(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative bg-[#2D1B5E] -mx-4 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden">
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href="/family" className="text-white/70 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h2 className="text-2xl font-black text-white">{tr.groupChats}</h2>
              <p className="text-sm text-violet-300 mt-0.5">Community links & channels</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAdd && isAdmin && (
        <ChatForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={handleCancel}
          title="Add Link"
        />
      )}

      {/* Chat list */}
      <div className="space-y-3">
        {chats.map((chat, index) => (
          <div key={chat.id}>
            {editingId === chat.id ? (
              <ChatForm
                form={form}
                setForm={setForm}
                onSave={handleSave}
                onCancel={handleCancel}
                title="Edit Link"
              />
            ) : (
              <div className="flex items-start gap-2 rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                {isAdmin && (
                  <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                    <button
                      onClick={() => reorderChats(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 rounded-md text-gray-300 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-20 disabled:pointer-events-none"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => reorderChats(index, index + 1)}
                      disabled={index === chats.length - 1}
                      className="p-1 rounded-md text-gray-300 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-20 disabled:pointer-events-none"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <a
                  href={chat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-start gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{chat.name}</span>
                      <Badge className={`text-xs px-2 py-0.5 ${platformColors[chat.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                        {chat.platform.charAt(0).toUpperCase() + chat.platform.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{chat.description}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                </a>
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => openEdit(chat)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteChat(chat.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {chats.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">No links added yet.</p>
        )}
      </div>
    </div>
  )
}

function ChatForm({
  form,
  setForm,
  onSave,
  onCancel,
  title,
}: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  onSave: () => void
  onCancel: () => void
  title: string
}) {
  return (
    <div className="rounded-2xl bg-white border border-violet-100 shadow-md p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <Input
        placeholder="Name (e.g. KBMI WhatsApp Group)"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="text-sm"
      />
      <select
        value={form.platform}
        onChange={(e) => setForm({ ...form, platform: e.target.value as GroupChat['platform'] })}
        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-400"
      >
        {(['whatsapp', 'telegram', 'instagram', 'facebook', 'youtube', 'tiktok', 'x', 'other'] as const).map((p) => (
          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
        ))}
      </select>
      <Input
        placeholder="URL (https://...)"
        value={form.url}
        onChange={(e) => setForm({ ...form, url: e.target.value })}
        className="text-sm"
      />
      <Input
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="text-sm"
      />
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
          <Check className="h-4 w-4" /> Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="gap-1.5">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  )
}
