interface Props {
  balance: number
  color: 'violet' | 'emerald'
}

const colorMap = {
  violet: { value: 'text-violet-300', label: 'text-violet-500' },
  emerald: { value: 'text-emerald-300', label: 'text-emerald-500' },
}

export function BalanceDisplay({ balance, color }: Props) {
  const hours = Math.floor(balance / 60)
  const mins = balance % 60

  return (
    <div className="text-center">
      <div className={`text-6xl font-bold tabular-nums ${colorMap[color].value}`}>
        {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
      </div>
      <div className={`text-sm mt-1 ${colorMap[color].label}`}>screen time balance</div>
    </div>
  )
}
