import { createServerClient } from '@/lib/supabase-server'
import { ParentDashboard } from '@/components/parent/ParentDashboard'
import type { ReadingSession, ScreentimeSession } from '@/types'

export default async function ParentPage() {
  const supabase = createServerClient()

  const [{ data: reading }, { data: screentime }] = await Promise.all([
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
  ])

  return (
    <ParentDashboard
      readingSessions={(reading ?? []) as ReadingSession[]}
      screentimeSessions={(screentime ?? []) as ScreentimeSession[]}
    />
  )
}
