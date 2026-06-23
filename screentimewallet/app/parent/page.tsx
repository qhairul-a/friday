import { createServerClient } from '@/lib/supabase-server'
import { ParentDashboard } from '@/components/parent/ParentDashboard'
import type { ReadingSession, ScreentimeSession, ChildName } from '@/types'

export default async function ParentPage() {
  const supabase = createServerClient()

  const [{ data: reading }, { data: screentime }, { data: profiles }] = await Promise.all([
    supabase
      .from('reading_sessions')
      .select('*')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false }),
    supabase
      .from('screentime_sessions')
      .select('*')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false }),
    supabase.from('child_profiles').select('child_name, photo_url'),
  ])

  const photos: Record<ChildName, string | null> = { qasim: null, muadz: null }
  if (profiles) profiles.forEach((r: { child_name: ChildName; photo_url: string | null }) => { photos[r.child_name] = r.photo_url })

  return (
    <ParentDashboard
      readingSessions={(reading ?? []) as ReadingSession[]}
      screentimeSessions={(screentime ?? []) as ScreentimeSession[]}
      initialPhotos={photos}
    />
  )
}
