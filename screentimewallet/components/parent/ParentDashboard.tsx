'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecordsTable } from './RecordsTable'
import { AnalyticsView } from './AnalyticsView'
import { SessionModal } from './SessionModal'
import { ProfileManager } from './ProfileManager'
import { createReadingSession, updateReadingSession, deleteReadingSession } from '@/lib/queries'
import type { ReadingSession, ScreentimeSession, ChildName } from '@/types'

interface Props {
  readingSessions: ReadingSession[]
  screentimeSessions: ScreentimeSession[]
  initialPhotos: Record<ChildName, string | null>
}

type Tab = 'records' | 'analytics'
type ModalState = null | 'add' | ReadingSession

export function ParentDashboard({ readingSessions, screentimeSessions, initialPhotos }: Props) {
  const [tab, setTab] = useState<Tab>('records')
  const [sessions, setSessions] = useState<ReadingSession[]>(readingSessions)
  const [modal, setModal] = useState<ModalState>(null)
  const router = useRouter()

  async function handleGoHome() {
    await fetch('/api/parent-logout', { method: 'POST' })
    router.push('/')
  }

  async function handleSave(data: { child_name: ChildName; started_at: string; ended_at: string; duration_minutes: number }) {
    if (modal === 'add') {
      await createReadingSession(data)
    } else if (modal && typeof modal === 'object') {
      await updateReadingSession(modal.id, data)
    }
    setModal(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    await deleteReadingSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      {modal !== null && (
        <SessionModal
          session={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
        <button
          onClick={handleGoHome}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Home
        </button>
      </div>

      <ProfileManager initialPhotos={initialPhotos} />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['records', 'analytics'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-medium capitalize transition-colors ${
              tab === t ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'records' && (
        <RecordsTable
          sessions={sessions}
          onAdd={() => setModal('add')}
          onEdit={s => setModal(s)}
          onDelete={handleDelete}
        />
      )}
      {tab === 'analytics' && (
        <AnalyticsView
          readingSessions={sessions}
          screentimeSessions={screentimeSessions}
        />
      )}
    </main>
  )
}
