'use client'
import { useState, FormEvent } from 'react'
import type { ReadingSession, ChildName } from '@/types'

interface Props {
  session?: ReadingSession | null
  onSave: (data: { child_name: ChildName; started_at: string; ended_at: string; duration_minutes: number }) => Promise<void>
  onClose: () => void
}

function toLocalInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 16)
}

function calcDuration(start: string, end: string): number {
  return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

export function SessionModal({ session, onSave, onClose }: Props) {
  const [child, setChild] = useState<ChildName>(session?.child_name ?? 'qasim')
  const [startedAt, setStartedAt] = useState(session?.started_at ? toLocalInput(session.started_at) : '')
  const [endedAt, setEndedAt] = useState(session?.ended_at ? toLocalInput(session.ended_at) : '')
  const [saving, setSaving] = useState(false)

  const duration = startedAt && endedAt ? calcDuration(startedAt, endedAt) : 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!startedAt || !endedAt || duration < 0) return
    setSaving(true)
    await onSave({
      child_name: child,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_minutes: duration,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6">
      <div className="bg-slate-800 border border-slate-600 rounded-3xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-6">{session ? 'Edit Session' : 'Add Session'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">Child</label>
            <select
              value={child}
              onChange={e => setChild(e.target.value as ChildName)}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-white"
            >
              <option value="qasim">Qasim</option>
              <option value="muadz">Muadz</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Reading Start</label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-white"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm block mb-1">Reading End</label>
            <input
              type="datetime-local"
              value={endedAt}
              onChange={e => setEndedAt(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-white"
            />
          </div>
          {startedAt && endedAt && (
            <div className="text-slate-400 text-sm">
              Duration: <span className="text-emerald-400 font-semibold">{duration} min</span>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || duration <= 0}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
