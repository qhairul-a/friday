'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import {
  Announcement, Event, User, ContributionDrive, RSVP, Expense, Notification,
  FeedbackItem, MarketplaceListing, GroupChat, ExcoMember, AuditEntry, AuditCategory, Poll,
} from './mock-data'

interface DataContextValue {
  announcements: Announcement[]
  addAnnouncement: (ann: Omit<Announcement, 'id' | 'comments' | 'likedBy'>) => void
  updateAnnouncement: (id: string, updates: Partial<Omit<Announcement, 'id' | 'comments' | 'likedBy'>>) => void
  deleteAnnouncement: (id: string) => void
  addComment: (announcementId: string, comment: Announcement['comments'][0]) => void
  toggleLike: (announcementId: string, userId: string) => void

  events: Event[]
  addEvent: (ev: Omit<Event, 'id' | 'rsvps'>) => void
  updateEvent: (id: string, updates: Partial<Omit<Event, 'id' | 'rsvps'>>) => void
  deleteEvent: (id: string) => void
  updateRSVP: (eventId: string, rsvp: RSVP) => void

  users: User[]
  toggleHeadOfFamily: (userId: string) => void
  setUserRole: (userId: string, role: 'super_admin' | 'admin' | 'member') => void
  deleteUser: (userId: string) => void
  updateUserById: (id: string, updates: Partial<User>) => void

  drives: ContributionDrive[]
  addDrive: (drive: Omit<ContributionDrive, 'id' | 'contributions' | 'status' | 'expenses'>) => void
  updateDrive: (id: string, updates: Partial<Omit<ContributionDrive, 'id' | 'contributions' | 'expenses'>>) => void
  toggleDriveStatus: (id: string) => void
  deleteDrive: (id: string) => void
  confirmContribution: (driveId: string, contribId: string, confirmedBy: string) => void
  toggleContributionConfirm: (driveId: string, contribId: string, confirmedBy: string) => void
  recordContribution: (driveId: string, userId: string, userName: string, amount: number, confirmedBy: string) => void
  removeContribution: (driveId: string, contribId: string) => void
  addExpense: (driveId: string, expense: Omit<Expense, 'id'>) => void

  notifications: Notification[]
  markNotificationRead: (notifId: string, userId: string) => void
  markAllRead: (userId: string) => void

  feedback: FeedbackItem[]
  addFeedback: (item: Omit<FeedbackItem, 'id' | 'status'>) => void
  markFeedbackResolved: (id: string, byName: string) => void
  reopenFeedback: (id: string, byName: string) => void
  deleteFeedback: (id: string) => void

  listings: MarketplaceListing[]
  addListing: (listing: Omit<MarketplaceListing, 'id' | 'createdAt'>) => void
  deleteListing: (id: string) => void
  pushExpiryNotification: (listing: MarketplaceListing) => void
  toggleListingRead: (listingId: string, userId: string) => void

  chats: GroupChat[]
  addChat: (chat: Omit<GroupChat, 'id' | 'sortOrder'>) => void
  updateChat: (id: string, updates: Partial<Omit<GroupChat, 'id' | 'sortOrder'>>) => void
  deleteChat: (id: string) => void
  reorderChats: (fromIndex: number, toIndex: number) => void

  financeStats: { collected: number; spent: number } | null
  setFinanceStats: (stats: { collected: number; spent: number } | null) => void

  excoMembers: ExcoMember[]
  excoTerm: string
  setExcoTerm: (term: string) => void
  addExcoMember: (member: Omit<ExcoMember, 'id'>) => void
  updateExcoMember: (id: string, updates: Partial<Omit<ExcoMember, 'id'>>) => void
  deleteExcoMember: (id: string) => void

  auditLog: AuditEntry[]
  addAuditEntry: (activity: string, initiatedBy: string, category: AuditCategory) => void

  polls: Poll[]
  addPoll: (poll: Omit<Poll, 'id' | 'createdAt'>) => void
  updatePoll: (id: string, updates: Partial<Omit<Poll, 'id' | 'createdAt'>>) => void
  deletePoll: (id: string) => void
  votePoll: (pollId: string, optionIds: string[], userId: string) => void

  welcomeMessage: { title: string; body: string } | null
  saveWelcomeMessage: (msg: { title: string; body: string } | null) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

// ── Row mappers ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAnnouncement(r: any): Announcement {
  return {
    id: r.id, title: r.title, content: r.content || '',
    htmlContent: r.html_content, media: r.media || [],
    authorId: r.author_id || '', authorName: r.author_name || '',
    createdAt: r.created_at || '', isPinned: r.is_pinned || false,
    likedBy: r.liked_by || [],
    comments: (r.comments || []).map(mapComment),
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(r: any) {
  return { id: r.id, authorId: r.author_id || '', authorName: r.author_name || '', content: r.content || '', createdAt: r.created_at || '' }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(r: any): Event {
  return {
    id: r.id, title: r.title, description: r.description || '',
    htmlContent: r.html_content, media: r.media || [],
    date: r.date || '', time: r.time, location: r.location,
    createdBy: r.created_by || '', rsvps: (r.rsvps || []).map(mapRSVP),
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRSVP(r: any): RSVP { return { userId: r.user_id, userName: r.user_name, status: r.status } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(r: any): User {
  return {
    id: r.id, name: r.name, email: r.email, role: r.role,
    branch: r.branch || 'Cawangan Baru', avatar: r.avatar || '',
    joinedAt: r.joined_at || '', totalContributed: r.total_contributed || 0,
    isHeadOfFamily: r.is_head_of_family || false,
    phone: r.phone ?? undefined, address: r.address ?? undefined,
    dob: r.dob ?? undefined, profilePhoto: r.profile_photo ?? undefined,
    familyMembers: r.family_members || [],
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDrive(r: any): ContributionDrive {
  return {
    id: r.id, title: r.title, description: r.description || '',
    amountType: r.amount_type || 'flexible', fixedAmount: r.fixed_amount,
    minimumAmount: r.minimum_amount, targetAmount: r.target_amount || 0,
    payNowName: r.pay_now_name || '', payNowNumber: r.pay_now_number || '',
    deadline: r.deadline || '', specialInstructions: r.special_instructions,
    status: r.status || 'active', hofOnly: r.hof_only || false,
    expenses: r.expenses || [], contributions: (r.contributions || []).map(mapContrib),
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContrib(r: any) {
  return { id: r.id, userId: r.user_id || '', userName: r.user_name || '', amount: r.amount || 0, paidAt: r.paid_at || '', confirmed: r.confirmed || false, confirmedBy: r.confirmed_by }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeedback(r: any): FeedbackItem {
  return {
    id: r.id, userId: r.user_id || '', userName: r.user_name || '',
    content: r.content || '', contactDetails: r.contact_details || '',
    requestFollowUp: r.request_follow_up || false, status: r.status || 'open',
    createdAt: r.created_at || '', lastActionBy: r.last_action_by,
    lastActionAt: r.last_action_at, lastAction: r.last_action,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapListing(r: any): MarketplaceListing {
  return {
    id: r.id, sellerId: r.seller_id || '', sellerName: r.seller_name || '',
    title: r.title || '', description: r.description || '',
    htmlDescription: r.html_description, price: r.price || '',
    category: r.category, createdAt: r.created_at || '',
    expiresAt: r.expires_at || '', photos: r.photos || [], readBy: r.read_by || [],
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChat(r: any): GroupChat { return { id: r.id, name: r.name, platform: r.platform, url: r.url, description: r.description || '', sortOrder: r.sort_order ?? 0 } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapExco(r: any): ExcoMember { return { id: r.id, userId: r.user_id || '', name: r.name, position: r.position, avatar: r.avatar || '', since: r.since } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAudit(r: any): AuditEntry { return { id: r.id, category: r.category, activity: r.activity, initiatedBy: r.initiated_by, timestamp: r.timestamp } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPoll(r: any): Poll {
  return {
    id: r.id, question: r.question, allowMultiple: r.allow_multiple || false,
    createdAt: r.created_at || '', expiresAt: r.expires_at || '',
    createdById: r.created_by_id || '', createdByName: r.created_by_name || '',
    isActive: r.is_active ?? true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: (r.poll_options || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((o: any) => ({ id: o.id, text: o.text, votes: (o.poll_votes || []).map((v: any) => v.user_id) })),
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [drives, setDrives] = useState<ContributionDrive[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [chats, setChats] = useState<GroupChat[]>([])
  const [financeStats, setFinanceStats] = useState<{ collected: number; spent: number } | null>(null)
  const [excoMembers, setExcoMembers] = useState<ExcoMember[]>([])
  const [excoTerm, setExcoTermState] = useState('Term 2025')
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const DEFAULT_WELCOME = { title: 'Welcome to KBMI Hub! 🏡', body: "We're so glad you're here.\n\nThis is your family's very own digital home. Whether you're here to catch up on the latest news, join an upcoming event, or simply stay close to the people who matter most — you belong here.\n\nWelcome home. Let's grow together." }
  const [welcomeMessage, setWelcomeMsgState] = useState<{ title: string; body: string } | null>(DEFAULT_WELCOME)

  useEffect(() => {
    fetchAnnouncements(); fetchEvents(); fetchUsers(); fetchDrives()
    fetchFeedback(); fetchListings(); fetchChats(); fetchExco()
    fetchAuditLog(); fetchPolls(); fetchExcoTerm(); fetchWelcomeMessage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*, comments(*)').order('created_at', { ascending: false })
    if (data) setAnnouncements(data.map(mapAnnouncement))
  }
  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*, rsvps(*)').order('date', { ascending: true })
    if (data) setEvents(data.map(mapEvent))
  }
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('joined_at', { ascending: true })
    if (data) setUsers(data.map(mapUser))
  }
  const fetchDrives = async () => {
    const { data } = await supabase.from('contribution_drives').select('*, contributions(*)').order('created_at', { ascending: false })
    if (data) setDrives(data.map(mapDrive))
  }
  const fetchFeedback = async () => {
    const { data } = await supabase.from('feedback_items').select('*').order('created_at', { ascending: false })
    if (data) setFeedback(data.map(mapFeedback))
  }
  const fetchListings = async () => {
    const { data } = await supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false })
    if (data) setListings(data.map(mapListing))
  }
  const fetchChats = async () => {
    const { data } = await supabase.from('group_chats').select('*').order('sort_order')
    if (data) setChats(data.map(mapChat))
  }
  const fetchExco = async () => {
    const { data } = await supabase.from('exco_members').select('*')
    if (data) setExcoMembers(data.map(mapExco))
  }
  const fetchExcoTerm = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'exco_term').single()
    if (data) setExcoTermState(data.value)
  }
  const fetchAuditLog = async () => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3)
    const { data } = await supabase.from('audit_log').select('*').gte('timestamp', cutoff.toISOString()).order('timestamp', { ascending: false })
    if (data) setAuditLog(data.map(mapAudit))
  }
  const fetchPolls = async () => {
    const { data } = await supabase.from('polls').select('*, poll_options(*, poll_votes(user_id))').order('created_at', { ascending: false })
    if (data) setPolls(data.map(mapPoll))
  }

  // ── Notification helper ─────────────────────────────────────────────────────
  const pushNotification = (notif: Omit<Notification, 'id' | 'readBy'>) =>
    setNotifications((prev) => [{ ...notif, id: `n${Date.now()}`, readBy: [] }, ...prev])

  // ── Announcements ───────────────────────────────────────────────────────────
  const addAnnouncement = async (ann: Omit<Announcement, 'id' | 'comments' | 'likedBy'>) => {
    const { data } = await supabase.from('announcements').insert({
      title: ann.title, content: ann.content, html_content: ann.htmlContent,
      media: ann.media, author_id: ann.authorId, author_name: ann.authorName,
      created_at: ann.createdAt, is_pinned: ann.isPinned,
    }).select().single()
    if (data) {
      setAnnouncements((prev) => [{ ...mapAnnouncement(data), comments: [] }, ...prev])
      pushNotification({ type: 'announcement', title: ann.title, message: ann.content?.slice(0, 100) || ann.title, createdAt: ann.createdAt })
    }
  }
  const updateAnnouncement = async (id: string, updates: Partial<Omit<Announcement, 'id' | 'comments' | 'likedBy'>>) => {
    const db: Record<string, unknown> = {}
    if (updates.title !== undefined) db.title = updates.title
    if (updates.content !== undefined) db.content = updates.content
    if (updates.htmlContent !== undefined) db.html_content = updates.htmlContent
    if (updates.media !== undefined) db.media = updates.media
    if (updates.isPinned !== undefined) db.is_pinned = updates.isPinned
    await supabase.from('announcements').update(db).eq('id', id)
    setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a))
  }
  const deleteAnnouncement = async (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    await supabase.from('announcements').delete().eq('id', id)
  }
  const toggleLike = async (announcementId: string, userId: string) => {
    const ann = announcements.find((a) => a.id === announcementId)
    if (!ann) return
    const newLikedBy = ann.likedBy.includes(userId)
      ? ann.likedBy.filter((id) => id !== userId)
      : [...ann.likedBy, userId]
    setAnnouncements((prev) => prev.map((a) => a.id === announcementId ? { ...a, likedBy: newLikedBy } : a))
    await supabase.from('announcements').update({ liked_by: newLikedBy }).eq('id', announcementId)
  }
  const addComment = async (announcementId: string, comment: Announcement['comments'][0]) => {
    await supabase.from('comments').insert({
      announcement_id: announcementId, author_id: comment.authorId,
      author_name: comment.authorName, content: comment.content, created_at: comment.createdAt,
    })
    setAnnouncements((prev) =>
      prev.map((a) => a.id === announcementId ? { ...a, comments: [...a.comments, comment] } : a)
    )
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  const addEvent = async (ev: Omit<Event, 'id' | 'rsvps'>) => {
    const { data } = await supabase.from('events').insert({
      title: ev.title, description: ev.description, html_content: ev.htmlContent,
      media: ev.media, date: ev.date, time: ev.time, location: ev.location, created_by: ev.createdBy,
    }).select().single()
    if (data) {
      setEvents((prev) => [...prev, { ...mapEvent(data), rsvps: [] }].sort((a, b) => a.date.localeCompare(b.date)))
      pushNotification({ type: 'event', title: ev.title, message: `${ev.date} · ${ev.location || ''}`, createdAt: new Date().toISOString().slice(0, 10) })
    }
  }
  const updateEvent = async (id: string, updates: Partial<Omit<Event, 'id' | 'rsvps'>>) => {
    const db: Record<string, unknown> = {}
    if (updates.title !== undefined) db.title = updates.title
    if (updates.description !== undefined) db.description = updates.description
    if (updates.htmlContent !== undefined) db.html_content = updates.htmlContent
    if (updates.media !== undefined) db.media = updates.media
    if (updates.date !== undefined) db.date = updates.date
    if (updates.time !== undefined) db.time = updates.time
    if (updates.location !== undefined) db.location = updates.location
    await supabase.from('events').update(db).eq('id', id)
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e))
  }
  const deleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    await supabase.from('events').delete().eq('id', id)
  }
  const updateRSVP = async (eventId: string, rsvp: RSVP) => {
    await supabase.from('rsvps').upsert({ event_id: eventId, user_id: rsvp.userId, user_name: rsvp.userName, status: rsvp.status })
    setEvents((prev) => prev.map((ev) => {
      if (ev.id !== eventId) return ev
      const idx = ev.rsvps.findIndex((r) => r.userId === rsvp.userId)
      if (idx >= 0) { const u = [...ev.rsvps]; u[idx] = rsvp; return { ...ev, rsvps: u } }
      return { ...ev, rsvps: [...ev.rsvps, rsvp] }
    }))
  }

  // ── Users ───────────────────────────────────────────────────────────────────
  const toggleHeadOfFamily = async (userId: string) => {
    const cur = users.find((u) => u.id === userId)
    if (!cur) return
    const val = !cur.isHeadOfFamily
    await supabase.from('profiles').update({ is_head_of_family: val }).eq('id', userId)
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isHeadOfFamily: val } : u))
  }
  const setUserRole = async (userId: string, role: 'super_admin' | 'admin' | 'member') => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u))
  }
  const deleteUser = async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId))
    await supabase.from('profiles').delete().eq('id', userId)
  }
  const updateUserById = async (id: string, updates: Partial<User>) => {
    const db: Record<string, unknown> = {}
    if (updates.name !== undefined) db.name = updates.name
    if (updates.branch !== undefined) db.branch = updates.branch
    if (updates.phone !== undefined) db.phone = updates.phone
    if (updates.address !== undefined) db.address = updates.address
    if (updates.familyMembers !== undefined) db.family_members = updates.familyMembers
    if (updates.totalContributed !== undefined) db.total_contributed = updates.totalContributed
    await supabase.from('profiles').update(db).eq('id', id)
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...updates } : u))
  }

  // ── Drives ──────────────────────────────────────────────────────────────────
  const addDrive = async (drive: Omit<ContributionDrive, 'id' | 'contributions' | 'status' | 'expenses'>) => {
    const { data } = await supabase.from('contribution_drives').insert({
      title: drive.title, description: drive.description, amount_type: drive.amountType,
      fixed_amount: drive.fixedAmount, minimum_amount: drive.minimumAmount,
      target_amount: drive.targetAmount, pay_now_name: drive.payNowName,
      pay_now_number: drive.payNowNumber, deadline: drive.deadline,
      special_instructions: drive.specialInstructions, status: 'active',
      hof_only: drive.hofOnly || false, expenses: [],
    }).select().single()
    if (data) {
      setDrives((prev) => [{ ...mapDrive(data), contributions: [] }, ...prev])
      pushNotification({ type: 'drive', title: drive.title, message: drive.description?.slice(0, 100) || drive.title, createdAt: new Date().toISOString().slice(0, 10), hofOnly: drive.hofOnly })
    }
  }
  const updateDrive = async (id: string, updates: Partial<Omit<ContributionDrive, 'id' | 'contributions' | 'expenses'>>) => {
    const db: Record<string, unknown> = {}
    if (updates.title !== undefined) db.title = updates.title
    if (updates.description !== undefined) db.description = updates.description
    if (updates.amountType !== undefined) db.amount_type = updates.amountType
    if (updates.fixedAmount !== undefined) db.fixed_amount = updates.fixedAmount
    if (updates.minimumAmount !== undefined) db.minimum_amount = updates.minimumAmount
    if (updates.targetAmount !== undefined) db.target_amount = updates.targetAmount
    if (updates.payNowName !== undefined) db.pay_now_name = updates.payNowName
    if (updates.payNowNumber !== undefined) db.pay_now_number = updates.payNowNumber
    if (updates.deadline !== undefined) db.deadline = updates.deadline
    if (updates.specialInstructions !== undefined) db.special_instructions = updates.specialInstructions
    if (updates.hofOnly !== undefined) db.hof_only = updates.hofOnly
    await supabase.from('contribution_drives').update(db).eq('id', id)
    setDrives((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d))
  }
  const deleteDrive = async (id: string) => {
    setDrives((prev) => prev.filter((d) => d.id !== id))
    await supabase.from('contributions').delete().eq('drive_id', id)
    await supabase.from('contribution_drives').delete().eq('id', id)
  }
  const toggleDriveStatus = async (id: string) => {
    const drive = drives.find((d) => d.id === id)
    if (!drive) return
    const newStatus = drive.status === 'active' ? 'closed' : 'active'
    await supabase.from('contribution_drives').update({ status: newStatus }).eq('id', id)
    setDrives((prev) => prev.map((d) => d.id === id ? { ...d, status: newStatus } : d))
  }
  const confirmContribution = async (driveId: string, contribId: string, confirmedBy: string) => {
    await supabase.from('contributions').update({ confirmed: true, confirmed_by: confirmedBy }).eq('id', contribId)
    setDrives((prev) => prev.map((d) => d.id === driveId
      ? { ...d, contributions: d.contributions.map((c) => c.id === contribId ? { ...c, confirmed: true, confirmedBy } : c) }
      : d))
  }
  const toggleContributionConfirm = async (driveId: string, contribId: string, confirmedBy: string) => {
    const contrib = drives.find((d) => d.id === driveId)?.contributions.find((c) => c.id === contribId)
    if (!contrib) return
    const confirmed = !contrib.confirmed
    await supabase.from('contributions').update({ confirmed, confirmed_by: confirmed ? confirmedBy : null }).eq('id', contribId)
    setDrives((prev) => prev.map((d) => d.id === driveId
      ? { ...d, contributions: d.contributions.map((c) => c.id === contribId ? { ...c, confirmed, confirmedBy: confirmed ? confirmedBy : undefined } : c) }
      : d))
  }
  const recordContribution = async (driveId: string, userId: string, userName: string, amount: number, confirmedBy: string) => {
    const existing = drives.find((d) => d.id === driveId)?.contributions.find((c) => c.userId === userId && !c.confirmed)
    if (existing) {
      await supabase.from('contributions').update({ confirmed: true, confirmed_by: confirmedBy }).eq('id', existing.id)
      setDrives((prev) => prev.map((d) => d.id === driveId
        ? { ...d, contributions: d.contributions.map((c) => c.id === existing.id ? { ...c, confirmed: true, confirmedBy } : c) }
        : d))
    } else {
      const { data } = await supabase.from('contributions').insert({
        drive_id: driveId, user_id: userId, user_name: userName, amount,
        paid_at: new Date().toISOString().slice(0, 10), confirmed: true, confirmed_by: confirmedBy,
      }).select().single()
      if (data) setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, contributions: [...d.contributions, mapContrib(data)] } : d))
    }
  }
  const removeContribution = async (driveId: string, contribId: string) => {
    setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, contributions: d.contributions.filter((c) => c.id !== contribId) } : d))
    await supabase.from('contributions').delete().eq('id', contribId)
  }
  const addExpense = async (driveId: string, expense: Omit<Expense, 'id'>) => {
    const drive = drives.find((d) => d.id === driveId)
    if (!drive) return
    const newExpenses = [...drive.expenses, { ...expense, id: `ex${Date.now()}` }]
    await supabase.from('contribution_drives').update({ expenses: newExpenses }).eq('id', driveId)
    setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, expenses: newExpenses } : d))
  }

  // ── Notifications (in-memory only) ──────────────────────────────────────────
  const markNotificationRead = (notifId: string, userId: string) =>
    setNotifications((prev) => prev.map((n) => n.id === notifId && !n.readBy.includes(userId) ? { ...n, readBy: [...n.readBy, userId] } : n))
  const markAllRead = (userId: string) =>
    setNotifications((prev) => prev.map((n) => n.readBy.includes(userId) ? n : { ...n, readBy: [...n.readBy, userId] }))

  // ── Feedback ─────────────────────────────────────────────────────────────────
  const addFeedback = async (item: Omit<FeedbackItem, 'id' | 'status'>) => {
    const { data } = await supabase.from('feedback_items').insert({
      user_id: item.userId, user_name: item.userName, content: item.content,
      contact_details: item.contactDetails, request_follow_up: item.requestFollowUp,
      status: 'open', created_at: item.createdAt,
    }).select().single()
    if (data) setFeedback((prev) => [mapFeedback(data), ...prev])
  }
  const markFeedbackResolved = async (id: string, byName: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('feedback_items').update({ status: 'resolved', last_action: 'resolved', last_action_by: byName, last_action_at: today }).eq('id', id)
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, status: 'resolved' as const, lastAction: 'resolved' as const, lastActionBy: byName, lastActionAt: today } : f))
  }
  const reopenFeedback = async (id: string, byName: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('feedback_items').update({ status: 'open', last_action: 'reopened', last_action_by: byName, last_action_at: today }).eq('id', id)
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, status: 'open' as const, lastAction: 'reopened' as const, lastActionBy: byName, lastActionAt: today } : f))
  }
  const deleteFeedback = async (id: string) => {
    setFeedback((prev) => prev.filter((f) => f.id !== id))
    await supabase.from('feedback_items').delete().eq('id', id)
  }

  // ── Marketplace ───────────────────────────────────────────────────────────────
  const addListing = async (listing: Omit<MarketplaceListing, 'id' | 'createdAt'>) => {
    const { data } = await supabase.from('marketplace_listings').insert({
      seller_id: listing.sellerId, seller_name: listing.sellerName, title: listing.title,
      description: listing.description, html_description: listing.htmlDescription,
      price: listing.price, category: listing.category,
      expires_at: listing.expiresAt, photos: listing.photos || [], read_by: [],
    }).select().single()
    if (data) setListings((prev) => [mapListing(data), ...prev])
  }
  const deleteListing = async (id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id))
    await supabase.from('marketplace_listings').delete().eq('id', id)
  }
  const pushExpiryNotification = (listing: MarketplaceListing) =>
    pushNotification({ type: 'listing', title: 'Listing Expired', message: `Your listing "${listing.title}" has expired.`, createdAt: new Date().toISOString().slice(0, 10), targetUserId: listing.sellerId })
  const toggleListingRead = async (listingId: string, userId: string) => {
    const listing = listings.find((l) => l.id === listingId)
    if (!listing) return
    const readBy = listing.readBy ?? []
    const newReadBy = readBy.includes(userId) ? readBy.filter((id) => id !== userId) : [...readBy, userId]
    await supabase.from('marketplace_listings').update({ read_by: newReadBy }).eq('id', listingId)
    setListings((prev) => prev.map((l) => l.id === listingId ? { ...l, readBy: newReadBy } : l))
  }

  // ── Group Chats ───────────────────────────────────────────────────────────────
  const addChat = async (chat: Omit<GroupChat, 'id' | 'sortOrder'>) => {
    const nextOrder = chats.length
    const { data } = await supabase.from('group_chats').insert({ name: chat.name, platform: chat.platform, url: chat.url, description: chat.description, sort_order: nextOrder }).select().single()
    if (data) setChats((prev) => [...prev, mapChat(data)])
  }
  const updateChat = async (id: string, updates: Partial<Omit<GroupChat, 'id' | 'sortOrder'>>) => {
    await supabase.from('group_chats').update(updates).eq('id', id)
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c))
  }
  const deleteChat = async (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('group_chats').delete().eq('id', id)
  }
  const reorderChats = async (fromIndex: number, toIndex: number) => {
    const reordered = [...chats]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const updated = reordered.map((c, i) => ({ ...c, sortOrder: i }))
    setChats(updated)
    await Promise.all(updated.map((c) => supabase.from('group_chats').update({ sort_order: c.sortOrder }).eq('id', c.id)))
  }

  // ── Exco ─────────────────────────────────────────────────────────────────────
  const addExcoMember = async (member: Omit<ExcoMember, 'id'>) => {
    const { data } = await supabase.from('exco_members').insert({ user_id: member.userId, name: member.name, position: member.position, avatar: member.avatar, since: member.since }).select().single()
    if (data) setExcoMembers((prev) => [...prev, mapExco(data)])
  }
  const updateExcoMember = async (id: string, updates: Partial<Omit<ExcoMember, 'id'>>) => {
    const db: Record<string, unknown> = {}
    if (updates.name !== undefined) db.name = updates.name
    if (updates.position !== undefined) db.position = updates.position
    if (updates.avatar !== undefined) db.avatar = updates.avatar
    if (updates.since !== undefined) db.since = updates.since
    await supabase.from('exco_members').update(db).eq('id', id)
    setExcoMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...updates } : m))
  }
  const deleteExcoMember = async (id: string) => {
    setExcoMembers((prev) => prev.filter((m) => m.id !== id))
    await supabase.from('exco_members').delete().eq('id', id)
  }
  const setExcoTerm = async (term: string) => {
    await supabase.from('app_config').upsert({ key: 'exco_term', value: term })
    setExcoTermState(term)
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────────
  const addAuditEntry = async (activity: string, initiatedBy: string, category: AuditCategory) => {
    const { data } = await supabase.from('audit_log').insert({ category, activity, initiated_by: initiatedBy, timestamp: new Date().toISOString() }).select().single()
    if (data) setAuditLog((prev) => [mapAudit(data), ...prev])
  }

  // ── Polls ─────────────────────────────────────────────────────────────────────
  const addPoll = async (poll: Omit<Poll, 'id' | 'createdAt'>) => {
    const { data: pd } = await supabase.from('polls').insert({
      question: poll.question, allow_multiple: poll.allowMultiple,
      expires_at: poll.expiresAt, created_by_id: poll.createdById,
      created_by_name: poll.createdByName, is_active: poll.isActive,
      created_at: new Date().toISOString().slice(0, 10),
    }).select().single()
    if (pd) {
      await supabase.from('poll_options').insert(poll.options.map((opt, i) => ({ poll_id: pd.id, text: opt.text, position: i })))
      await fetchPolls()
    }
  }
  const updatePoll = async (id: string, updates: Partial<Omit<Poll, 'id' | 'createdAt'>>) => {
    const db: Record<string, unknown> = {}
    if (updates.question !== undefined) db.question = updates.question
    if (updates.allowMultiple !== undefined) db.allow_multiple = updates.allowMultiple
    if (updates.expiresAt !== undefined) db.expires_at = updates.expiresAt
    if (updates.isActive !== undefined) db.is_active = updates.isActive
    if (Object.keys(db).length > 0) await supabase.from('polls').update(db).eq('id', id)
    if (updates.options) {
      await supabase.from('poll_options').delete().eq('poll_id', id)
      await supabase.from('poll_options').insert(updates.options.map((opt, i) => ({ poll_id: id, text: opt.text, position: i })))
    }
    await fetchPolls()
  }
  const deletePoll = async (id: string) => {
    setPolls((prev) => prev.filter((p) => p.id !== id))
    await supabase.from('polls').delete().eq('id', id)
  }
  const votePoll = async (pollId: string, optionIds: string[], userId: string) => {
    await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', userId)
    if (optionIds.length > 0) {
      await supabase.from('poll_votes').insert(optionIds.map((optionId) => ({ option_id: optionId, user_id: userId, poll_id: pollId })))
    }
    await fetchPolls()
  }

  const fetchWelcomeMessage = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'welcome_message').single()
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = data.value as any
      setWelcomeMsgState(v.deleted ? null : { title: v.title || '', body: v.body || '' })
    }
  }
  const saveWelcomeMessage = async (msg: { title: string; body: string } | null) => {
    setWelcomeMsgState(msg)
    const value = msg ? { title: msg.title, body: msg.body } : { deleted: true }
    await supabase.from('app_settings').upsert({ key: 'welcome_message', value })
  }

  return (
    <DataContext.Provider value={{
      announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement, addComment, toggleLike,
      events, addEvent, updateEvent, deleteEvent, updateRSVP,
      users, toggleHeadOfFamily, setUserRole, deleteUser, updateUserById,
      drives, addDrive, updateDrive, toggleDriveStatus, deleteDrive, confirmContribution, toggleContributionConfirm, recordContribution, removeContribution, addExpense,
      notifications, markNotificationRead, markAllRead,
      feedback, addFeedback, markFeedbackResolved, reopenFeedback, deleteFeedback,
      listings, addListing, deleteListing, pushExpiryNotification, toggleListingRead,
      chats, addChat, updateChat, deleteChat, reorderChats,
      financeStats, setFinanceStats,
      excoMembers, excoTerm, setExcoTerm, addExcoMember, updateExcoMember, deleteExcoMember,
      auditLog, addAuditEntry,
      polls, addPoll, updatePoll, deletePoll, votePoll,
      welcomeMessage, saveWelcomeMessage,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
