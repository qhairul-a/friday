'use client'
import { useState } from 'react'
import { RecordsTable } from './RecordsTable'
import { AnalyticsView } from './AnalyticsView'
import type { ReadingSession, ScreentimeSession } from '@/types'
import Link from 'next/link'

interface Props {
  readingSessions: ReadingSession[]
  screentimeSessions: ScreentimeSession[]
}

type Tab = 'records' | 'analytics'

export function ParentDashboard({ readingSessions, screentimeSessions }: Props) {
  const [tab, setTab] = useState<Tab>('records')

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
        <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Home
        </Link>
      </div>

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

      {tab === 'records' && <RecordsTable sessions={readingSessions} />}
      {tab === 'analytics' && (
        <AnalyticsView
          readingSessions={readingSessions}
          screentimeSessions={screentimeSessions}
        />
      )}
    </main>
  )
}
