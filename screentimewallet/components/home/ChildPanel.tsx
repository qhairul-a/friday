'use client'
import { useState, useCallback } from 'react'
import { useBalance } from '@/hooks/useBalance'
import { BalanceDisplay } from '@/components/child/BalanceDisplay'
import { ReadingTimer } from '@/components/child/ReadingTimer'
import { ScreentimeCountdown } from '@/components/child/ScreentimeCountdown'
import { SessionGuard } from '@/components/child/SessionGuard'
import { ChildPhoto } from '@/components/child/ChildPhoto'
import type { ChildName } from '@/types'

const COLOR_MAP: Record<ChildName, 'violet' | 'emerald'> = {
  qasim: 'violet',
  muadz: 'emerald',
}

const EMOJI_MAP: Record<ChildName, string> = {
  qasim: '📚',
  muadz: '⭐',
}

const PANEL_STYLE: Record<'violet' | 'emerald', string> = {
  violet: 'bg-violet-900/30 border-violet-700',
  emerald: 'bg-emerald-900/30 border-emerald-700',
}

const NAME_STYLE: Record<'violet' | 'emerald', string> = {
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
}

interface Props {
  child: ChildName
  photoUrl: string | null
}

export function ChildPanel({ child, photoUrl }: Props) {
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
    <div className={`${PANEL_STYLE[color]} border-2 rounded-3xl p-5 flex flex-col gap-4`}>
      {!guardDone && (
        <SessionGuard child={child} onResolved={handleGuardResolved} />
      )}

      <div className="flex items-center gap-3 pb-3 border-b border-slate-700/60">
        <ChildPhoto photoUrl={photoUrl} fallbackEmoji={emoji} size={40} />
        <span className={`text-xl font-bold capitalize ${NAME_STYLE[color]}`}>{child}</span>
      </div>

      <BalanceDisplay balance={balance} color={color} />

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
  )
}
