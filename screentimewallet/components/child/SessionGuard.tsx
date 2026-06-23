'use client'
import { useState, useEffect } from 'react'
import {
  getOpenReadingSession,
  getOpenScreentimeSession,
  endReadingSession,
  endScreentimeSession,
  addToBalance,
} from '@/lib/queries'
import type { ChildName, ReadingSession, ScreentimeSession } from '@/types'

interface Props {
  child: ChildName
  onResolved: () => void
}

type OpenSession =
  | { type: 'reading'; session: ReadingSession }
  | { type: 'screentime'; session: ScreentimeSession }

export function SessionGuard({ child, onResolved }: Props) {
  const [open, setOpen] = useState<OpenSession | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function check() {
      const [reading, screentime] = await Promise.all([
        getOpenReadingSession(child),
        getOpenScreentimeSession(child),
      ])
      if (reading) {
        setOpen({ type: 'reading', session: reading })
      } else if (screentime) {
        setOpen({ type: 'screentime', session: screentime })
      } else {
        setChecked(true)
      }
    }
    check()
  }, [child])

  useEffect(() => {
    if (checked) onResolved()
  }, [checked, onResolved])

  async function handleYes() {
    if (!open) return
    if (open.type === 'reading') {
      const started = new Date(open.session.started_at).getTime()
      const minutes = Math.floor((Date.now() - started) / 60000)
      await endReadingSession(open.session.id, minutes)
      await addToBalance(child, minutes)
    } else {
      const started = new Date(open.session.started_at).getTime()
      const used = Math.floor((Date.now() - started) / 60000)
      await endScreentimeSession(open.session.id, used)
    }
    setOpen(null)
    onResolved()
  }

  function handleNo() {
    setOpen(null)
    onResolved()
  }

  if (!open) return null

  const label = open.type === 'reading' ? 'reading' : 'screen time'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6">
      <div className="bg-slate-800 border border-slate-600 rounded-3xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🕐</div>
        <h2 className="text-xl font-bold text-white mb-2">Session in progress</h2>
        <p className="text-slate-400 mb-8">
          You had a {label} session that wasn&apos;t ended. Did you finish?
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleNo}
            className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            No, resume
          </button>
          <button
            onClick={handleYes}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
          >
            Yes, I finished
          </button>
        </div>
      </div>
    </div>
  )
}
