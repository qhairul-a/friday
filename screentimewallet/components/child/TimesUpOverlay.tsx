interface Props {
  childName: string
  onDismiss: () => void
}

export function TimesUpOverlay({ childName, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm">
      <div className="text-8xl mb-6">⏰</div>
      <h1 className="text-5xl font-bold text-red-400 mb-4">Time&apos;s Up!</h1>
      <p className="text-slate-300 text-xl text-center max-w-sm mb-10 capitalize">
        {childName}, your screen time is all used up.<br />
        Read more to earn more time!
      </p>
      <button
        onClick={onDismiss}
        className="px-10 py-4 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-2xl text-white font-semibold text-lg transition-all"
      >
        OK
      </button>
    </div>
  )
}
