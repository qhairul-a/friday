'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { User } from './mock-data'

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<{ error?: string }>
  signup: (name: string, email: string, password: string, dob?: string, phone?: string) => Promise<{ error?: string }>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SUPER_ADMIN_EMAILS = ['qhairul.asmai@gmail.com']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfile(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    branch: row.branch || 'Cawangan Baru',
    avatar: row.avatar || '',
    joinedAt: row.joined_at || '',
    totalContributed: row.total_contributed || 0,
    isHeadOfFamily: row.is_head_of_family || false,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    dob: row.dob ?? undefined,
    profilePhoto: row.profile_photo ?? undefined,
    familyMembers: row.family_members || [],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setUser(mapProfile(data))
    } else {
      // Profile missing — create it (handles existing auth users from before migration)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const name = (authUser.user_metadata?.name as string) || authUser.email!.split('@')[0]
        const avatar = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        const role = SUPER_ADMIN_EMAILS.includes(authUser.email!) ? 'super_admin' : 'member'
        await supabase.from('profiles').upsert({
          id: userId,
          name,
          email: authUser.email,
          role,
          branch: 'Cawangan Baru',
          avatar,
          joined_at: new Date().toISOString().slice(0, 10),
          total_contributed: 0,
        })
        const { data: fresh } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (fresh) setUser(mapProfile(fresh))
      }
    }
    setIsLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signup = async (name: string, email: string, password: string, dob?: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, dob: dob || null, phone: phone || null } },
    })
    if (error) return { error: error.message }
    return {}
  }

  const logout = () => { supabase.auth.signOut() }

  const updateUser = (updates: Partial<User>) => {
    if (!user) return
    const db: Record<string, unknown> = {}
    if (updates.name !== undefined) db.name = updates.name
    if (updates.avatar !== undefined) db.avatar = updates.avatar
    if (updates.branch !== undefined) db.branch = updates.branch
    if (updates.phone !== undefined) db.phone = updates.phone
    if (updates.address !== undefined) db.address = updates.address
    if (updates.dob !== undefined) db.dob = updates.dob
    if (updates.profilePhoto !== undefined) db.profile_photo = updates.profilePhoto
    if (updates.familyMembers !== undefined) db.family_members = updates.familyMembers
    supabase.from('profiles').update(db).eq('id', user.id).then()
    setUser((prev) => prev ? { ...prev, ...updates } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
