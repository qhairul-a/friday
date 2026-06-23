'use client'
import { useEffect } from 'react'
import { useScreentimeCountdown } from '@/hooks/useScreentimeCountdown'
import { TimesUpOverlay } from './TimesUpOverlay'
import type { ChildName } from '@/types'

interface Props {
  child: ChildName
  balance: number
  onSetBalance: (minutes: number) => Promise<void>
  readingActive: boolean
  onActiveChange?: (active: boolean) => void
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatBalance(balanceMinutes: number) {
  const totalSeconds = Math.round(balanceMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) return `${hours}h ${mins}m`
  if (secs > 0) return `${mins}m ${secs}s`
  return `${mins}m`
}

export function ScreentimeCountdown({ child, balance, onSetBalance, readingActive, onActiveChange }: Props) {
  const { isActive, remainingSeconds, isLoading, timesUp, start, stop, dismissTimesUp } =
    useScreentimeCountdown(child, balance, onSetBalance)

  useEffect(() => { onActiveChange?.(isActive) }, [isActive, onActiveChange])

  if (isLoading) return <div className="animate-pulse text-slate-500 text-center py-8">Loading...</div>

  const canStart = balance > 0 && !readingActive && !isActive

  return (
    <>
      {timesUp && <TimesUpOverlay childName={child} onDismiss={dismissTimesUp} />}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-4">
        <h2 className="text-lg font-semibold text-slate-300">Screen Time</h2>

        {isActive && (
          <div className="text-center">
            <div className="text-5xl font-mono font-bold text-white">{formatCountdown(remainingSeconds)}</div>
            <div className="text-slate-400 text-sm mt-1">remaining</div>
          </div>
        )}

        {!isActive && (
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-400">{formatBalance(balance)}</div>
            <div className="text-slate-500 text-sm mt-1">available</div>
          </div>
        )}

        {isActive ? (
          <button
            onClick={stop}
            className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-lg transition-all"
          >
            Stop Screen Time
          </button>
        ) : (
          <button
            onClick={start}
            disabled={!canStart}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg transition-all"
          >
            {balance === 0 ? 'No Time — Read to Earn!' : readingActive ? 'Reading in progress...' : 'Start Screen Time'}
          </button>
        )}
      </div>
    </>
  )
}
