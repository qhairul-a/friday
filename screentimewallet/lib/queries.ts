import { supabase } from './supabase'
import type { ChildName, ReadingSession, ScreentimeSession } from '@/types'

export async function getBalance(child: ChildName): Promise<number> {
  const { data, error } = await supabase
    .from('screentime_balance')
    .select('balance_minutes')
    .eq('child_name', child)
    .single()
  if (error) throw error
  return data.balance_minutes
}

export async function startReadingSession(child: ChildName): Promise<string> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .insert({ child_name: child, started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function endReadingSession(id: string, durationMinutes: number): Promise<void> {
  const { error } = await supabase
    .from('reading_sessions')
    .update({ ended_at: new Date().toISOString(), duration_minutes: durationMinutes })
    .eq('id', id)
  if (error) throw error
}

export async function addToBalance(child: ChildName, minutes: number): Promise<void> {
  const { error } = await supabase.rpc('increment_balance', { p_child: child, p_minutes: minutes })
  if (error) throw error
}

export async function setBalance(child: ChildName, minutes: number): Promise<void> {
  const { error } = await supabase.rpc('set_balance', { p_child: child, p_minutes: minutes })
  if (error) throw error
}

export async function startScreentimeSession(child: ChildName): Promise<string> {
  const { data, error } = await supabase
    .from('screentime_sessions')
    .insert({ child_name: child, started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function endScreentimeSession(id: string, durationUsedMinutes: number): Promise<void> {
  const { error } = await supabase
    .from('screentime_sessions')
    .update({ ended_at: new Date().toISOString(), duration_used_minutes: durationUsedMinutes })
    .eq('id', id)
  if (error) throw error
}

export async function getOpenReadingSession(child: ChildName): Promise<ReadingSession | null> {
  const { data } = await supabase
    .from('reading_sessions')
    .select('*')
    .eq('child_name', child)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getOpenScreentimeSession(child: ChildName): Promise<ScreentimeSession | null> {
  const { data } = await supabase
    .from('screentime_sessions')
    .select('*')
    .eq('child_name', child)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getReadingSessions(child?: ChildName): Promise<ReadingSession[]> {
  let q = supabase
    .from('reading_sessions')
    .select('*')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
  if (child) q = q.eq('child_name', child)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getScreentimeSessions(child?: ChildName): Promise<ScreentimeSession[]> {
  let q = supabase
    .from('screentime_sessions')
    .select('*')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
  if (child) q = q.eq('child_name', child)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
