// Server-side Supabase client — safe to use in Server Components and Route Handlers
import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}
