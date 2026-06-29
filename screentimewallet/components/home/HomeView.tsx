'use client'
import { ChildPanel } from '@/components/home/ChildPanel'
import type { ChildName } from '@/types'

interface Props {
  photos: Record<ChildName, string | null>
}

export function HomeView({ photos }: Props) {
  return (
    <div className="grid grid-cols-2 gap-5 w-full max-w-2xl">
      <ChildPanel child="qasim" photoUrl={photos.qasim} />
      <ChildPanel child="muadz" photoUrl={photos.muadz} />
    </div>
  )
}
