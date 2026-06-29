import { createServerClient } from '@/lib/supabase-server'
import { HomeView } from '@/components/home/HomeView'
import Link from 'next/link'
import type { ChildName } from '@/types'

export default async function Home() {
  const supabase = createServerClient()
  const { data } = await supabase.from('child_profiles').select('child_name, photo_url')
  const photos: Record<ChildName, string | null> = { qasim: null, muadz: null }
  if (data) data.forEach((r: { child_name: ChildName; photo_url: string | null }) => { photos[r.child_name] = r.photo_url })

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <h1 className="text-5xl font-bold text-white">Screentime Wallet</h1>

      <HomeView photos={photos} />

      <Link
        href="/parent"
        className="text-slate-600 hover:text-slate-400 text-sm transition-colors"
      >
        Parent →
      </Link>
    </main>
  )
}
