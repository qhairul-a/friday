'use client'
import { useReadingTimer } from '@/hooks/useReadingTimer'
import type { ChildName } from '@/types'

interface Props {
  child: ChildName
  onEarned: (minutes: number) => void
  screentimeActive: boolean
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function ReadingTimer({ child, onEarned, screentimeActive }: Props) {
  const { isActive, elapsedSeconds, isLoading, start, stop } = useReadingTimer(child, onEarned)

  if (isLoading) return <div className="animate-pulse text-slate-500 text-center py-8">Loading...</div>

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold text-slate-300">Reading Timer</h2>

      {isActive && (
        <div className="text-center">
          <div className="text-5xl font-mono font-bold text-white">{formatTime(elapsedSeconds)}</div>
          <div className="text-emerald-400 text-sm mt-1">
            +{Math.floor(elapsedSeconds / 60)} min earned so far
          </div>
        </div>
      )}

      {isActive ? (
        <button
          onClick={stop}
          className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-lg transition-all"
        >
          Stop Reading
        </button>
      ) : (
        <button
          onClick={start}
          disabled={screentimeActive}
          className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg transition-all"
        >
          Start Reading
        </button>
      )}
    </div>
  )
}
