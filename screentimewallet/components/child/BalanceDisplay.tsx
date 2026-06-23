interface Props {
  balance: number
  color: 'violet' | 'emerald'
}

const colorMap = {
  violet: { value: 'text-violet-300', label: 'text-violet-500' },
  emerald: { value: 'text-emerald-300', label: 'text-emerald-500' },
}

export function BalanceDisplay({ balance, color }: Props) {
  const totalSeconds = Math.round(balance * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  const display = hours > 0
    ? `${hours}h ${mins}m`
    : secs > 0
    ? `${mins}m ${secs}s`
    : `${mins}m`

  return (
    <div className="text-center">
      <div className={`text-6xl font-bold tabular-nums ${colorMap[color].value}`}>
        {display}
      </div>
      <div className={`text-sm mt-1 ${colorMap[color].label}`}>screen time balance</div>
    </div>
  )
}
