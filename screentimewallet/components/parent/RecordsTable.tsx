'use client'
import { useState } from 'react'
import type { ReadingSession, ChildName } from '@/types'

interface Props {
  sessions: ReadingSession[]
  onAdd: () => void
  onEdit: (session: ReadingSession) => void
  onDelete: (id: string) => void
}

const PAGE_SIZE = 20

function fmt(iso: string | null, mode: 'date' | 'time'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (mode === 'date') return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
  return d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const CHILD_STYLE: Record<ChildName, string> = {
  qasim: 'bg-violet-900/50 text-violet-300 border border-violet-700',
  muadz: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
}

export function RecordsTable({ sessions, onAdd, onEdit, onDelete }: Props) {
  const [filter, setFilter] = useState<ChildName | 'all'>('all')
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.child_name === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page_sessions = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function changeFilter(f: ChildName | 'all') {
    setFilter(f)
    setPage(1)
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      onDelete(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row: filter + add */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'qasim', 'muadz'] as const).map(f => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
        >
          + Add Entry
        </button>
      </div>

      {/* Table */}
      {page_sessions.length === 0 ? (
        <div className="text-slate-500 text-center py-12">No reading sessions yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                {['Date', 'Child', 'Start', 'End', 'Earned', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {page_sessions.map(s => (
                <tr key={s.id} className="bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{fmt(s.started_at, 'date')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold capitalize ${CHILD_STYLE[s.child_name]}`}>
                      {s.child_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{fmt(s.started_at, 'time')}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt(s.ended_at, 'time')}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold">+{s.duration_minutes} min</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(s)}
                        className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                          confirmDelete === s.id
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-700 hover:bg-red-800 text-slate-300'
                        }`}
                      >
                        {confirmDelete === s.id ? 'Confirm?' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
