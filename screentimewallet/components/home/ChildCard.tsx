import Link from 'next/link'

interface Props {
  name: string
  emoji: string
  color: 'violet' | 'emerald'
}

const colorMap = {
  violet: {
    card: 'bg-violet-900/50 border-violet-700 hover:bg-violet-800/50 hover:border-violet-500',
    text: 'text-violet-300',
  },
  emerald: {
    card: 'bg-emerald-900/50 border-emerald-700 hover:bg-emerald-800/50 hover:border-emerald-500',
    text: 'text-emerald-300',
  },
}

export function ChildCard({ name, emoji, color }: Props) {
  return (
    <Link href={`/child/${name}`}>
      <div className={`${colorMap[color].card} border-2 rounded-3xl p-12 text-center cursor-pointer transition-all duration-150 active:scale-95 min-w-[180px]`}>
        <div className="text-7xl mb-4">{emoji}</div>
        <div className={`text-2xl font-bold ${colorMap[color].text} capitalize`}>{name}</div>
      </div>
    </Link>
  )
}
