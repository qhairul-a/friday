import { createServerClient } from '@/lib/supabase-server'
import { ChildCard } from '@/components/home/ChildCard'
import Link from 'next/link'
import type { ChildName } from '@/types'

export default async function Home() {
  const supabase = createServerClient()
  const { data } = await supabase.from('child_profiles').select('child_name, photo_url')
  const photos: Record<ChildName, string | null> = { qasim: null, muadz: null }
  if (data) data.forEach((r: { child_name: ChildName; photo_url: string | null }) => { photos[r.child_name] = r.photo_url })

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-bold text-white mb-2">Screentime Wallet</h1>
      <p className="text-slate-400 text-xl mb-16">Who are you?</p>

      <div className="flex gap-8 flex-wrap justify-center">
        <ChildCard name="qasim" emoji="📚" color="violet" photoUrl={photos.qasim} />
        <ChildCard name="muadz" emoji="⭐" color="emerald" photoUrl={photos.muadz} />
      </div>

      <Link
        href="/parent"
        className="mt-20 text-slate-600 hover:text-slate-400 text-sm transition-colors"
      >
        Parent →
      </Link>
    </main>
  )
}
