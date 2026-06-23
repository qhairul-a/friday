export type ChildName = 'qasim' | 'muadz'

export interface ReadingSession {
  id: string
  child_name: ChildName
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  created_at: string
}

export interface ScreentimeSession {
  id: string
  child_name: ChildName
  started_at: string
  ended_at: string | null
  duration_used_minutes: number | null
  created_at: string
}

export interface ScreentimeBalance {
  child_name: ChildName
  balance_minutes: number
  updated_at: string
}
