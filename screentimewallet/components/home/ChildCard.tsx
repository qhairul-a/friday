import Link from 'next/link'
import Image from 'next/image'

interface Props {
  name: string
  emoji: string
  color: 'violet' | 'emerald'
  photoUrl?: string | null
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

export function ChildCard({ name, emoji, color, photoUrl }: Props) {
  return (
    <Link href={`/child/${name}`}>
      <div className={`${colorMap[color].card} border-2 rounded-3xl p-12 text-center cursor-pointer transition-all duration-150 active:scale-95 min-w-[180px]`}>
        <div className="flex items-center justify-center mb-4">
          {photoUrl ? (
            <div className="w-20 h-20 rounded-full overflow-hidden relative">
              <Image src={photoUrl} alt={name} fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="text-7xl">{emoji}</div>
          )}
        </div>
        <div className={`text-2xl font-bold ${colorMap[color].text} capitalize`}>{name}</div>
      </div>
    </Link>
  )
}
