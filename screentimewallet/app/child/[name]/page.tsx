'use client'
import { use, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBalance } from '@/hooks/useBalance'
import { BalanceDisplay } from '@/components/child/BalanceDisplay'
import { ReadingTimer } from '@/components/child/ReadingTimer'
import { ScreentimeCountdown } from '@/components/child/ScreentimeCountdown'
import { SessionGuard } from '@/components/child/SessionGuard'
import type { ChildName } from '@/types'
import Link from 'next/link'

const VALID_NAMES: ChildName[] = ['qasim', 'muadz']
const COLOR_MAP: Record<ChildName, 'violet' | 'emerald'> = {
  qasim: 'violet',
  muadz: 'emerald',
}
const EMOJI_MAP: Record<ChildName, string> = {
  qasim: '📚',
  muadz: '⭐',
}

interface PageProps {
  params: Promise<{ name: string }>
}

export default function ChildPage({ params }: PageProps) {
  const { name } = use(params)
  const router = useRouter()

  if (!VALID_NAMES.includes(name as ChildName)) {
    router.replace('/')
    return null
  }

  const child = name as ChildName
  return <ChildView child={child} />
}

function ChildView({ child }: { child: ChildName }) {
  const { balance, add, set } = useBalance(child)
  const [guardDone, setGuardDone] = useState(false)
  const [readingActive, setReadingActive] = useState(false)
  const [screentimeActive, setScreentimeActive] = useState(false)

  const handleGuardResolved = useCallback(() => setGuardDone(true), [])

  const handleEarned = useCallback(async (minutes: number) => {
    await add(minutes)
    setReadingActive(false)
  }, [add])

  const handleSetBalance = useCallback(async (minutes: number) => {
    await set(minutes)
    setScreentimeActive(false)
  }, [set])

  const color = COLOR_MAP[child]
  const emoji = EMOJI_MAP[child]

  return (
    <main className="min-h-screen flex flex-col items-center p-6 gap-6 max-w-lg mx-auto">
      {!guardDone && (
        <SessionGuard child={child} onResolved={handleGuardResolved} />
      )}

      <div className="w-full flex items-center justify-between pt-4">
        <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Back
        </Link>
      </div>

      <div className="w-full text-center space-y-4 py-4">
        <h1 className="text-3xl font-bold text-white capitalize">
          Hey, {child} {emoji}
        </h1>
        <BalanceDisplay balance={balance} color={color} />
      </div>

      <div className="w-full space-y-4">
        <ReadingTimer
          child={child}
          onEarned={handleEarned}
          screentimeActive={screentimeActive}
          onActiveChange={setReadingActive}
        />
        <ScreentimeCountdown
          child={child}
          balance={balance}
          onSetBalance={handleSetBalance}
          readingActive={readingActive}
          onActiveChange={setScreentimeActive}
        />
      </div>
    </main>
  )
}
