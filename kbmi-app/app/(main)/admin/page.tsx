'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Megaphone, CalendarDays, DollarSign, Users, BarChart2,
  Check, CheckCircle, Clock, ShieldAlert, ImagePlus, X,
  Pencil, Trash2, Plus, Pin, PinOff, Crown,
  Receipt, TrendingUp, TrendingDown, Wallet, Phone, MessageSquare,
  MapPin, Mail, Cake, UserCircle, Download, FileSpreadsheet, ClipboardList,
} from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-context'
import { supabase } from '@/lib/supabase'
import { Announcement, Event, MediaItem, ContributionDrive, Expense, FeedbackItem, User, Poll, PollOption, computeScores } from '@/lib/mock-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false })
const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), { ssr: false })
const DriveBarChart = dynamic(() => import('@/components/DriveBarChart'), { ssr: false })

type Tab = 'dashboard' | 'users' | 'announcements' | 'events' | 'finance' | 'feedback' | 'audit' | 'polls'

// ─── Form types ───────────────────────────────────────────────────────────────
interface AnnForm { title: string; htmlContent: string; content: string; media: MediaItem[]; isPinned: boolean }
interface EvForm  { title: string; description: string; htmlContent: string; media: MediaItem[]; date: string; time: string; location: string }
interface DriveForm {
  title: string; description: string
  amountType: 'fixed' | 'flexible'
  fixedAmount: string; minimumAmount: string; targetAmount: string
  payNowName: string; payNowNumber: string; deadline: string
  specialInstructions: string
  hofOnly: boolean
}
interface ExpForm { description: string; amount: string; date: string; category: Expense['category'] }

const emptyAnn   = (): AnnForm    => ({ title: '', htmlContent: '', content: '', media: [], isPinned: false })
const emptyEv    = (): EvForm     => ({ title: '', description: '', htmlContent: '', media: [], date: '', time: '', location: '' })
const emptyDrive = (): DriveForm  => ({
  title: '', description: '', amountType: 'fixed',
  fixedAmount: '', minimumAmount: '', targetAmount: '',
  payNowName: 'KBMI Fund', payNowNumber: '', deadline: '',
  specialInstructions: '',
  hofOnly: false,
})
const emptyExp   = (): ExpForm    => ({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), category: 'other' })

export default function AdminPage() {
  const { lang } = useLang()
  const { user } = useAuth()
  const {
    announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement,
    events, addEvent, updateEvent, deleteEvent,
    users, toggleHeadOfFamily, setUserRole, deleteUser, updateUserById,
    drives, addDrive, updateDrive, toggleDriveStatus, deleteDrive, confirmContribution, toggleContributionConfirm, recordContribution, removeContribution, addExpense,
    feedback, markFeedbackResolved, reopenFeedback, deleteFeedback,
    listings,
    polls, addPoll, updatePoll, deletePoll,
    financeStats, setFinanceStats,
    auditLog, addAuditEntry,
  } = useData()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<Tab>('dashboard')
  const [financeTab, setFinanceTab] = useState<'overview' | 'contributors' | 'drives'>('overview')
  const [showFeedbackExportMenu, setShowFeedbackExportMenu] = useState(false)
  const [showFinanceExportMenu, setShowFinanceExportMenu] = useState(false)
  const [showAuditExportMenu, setShowAuditExportMenu] = useState(false)
  const [showUsersExportMenu, setShowUsersExportMenu] = useState(false)
  const [showPollForm, setShowPollForm] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [deletePollId, setDeletePollId] = useState<string | null>(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<{ id: string; text: string }[]>([{ id: 'o1', text: '' }, { id: 'o2', text: '' }])
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false)
  const [pollExpiresAt, setPollExpiresAt] = useState('')
  const [pollIsActive, setPollIsActive] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteUserConfirmId, setDeleteUserConfirmId] = useState<string | null>(null)
  const [editingUserProfile, setEditingUserProfile] = useState(false)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', phone: '', dob: '', address: '', familyMembers: [] as { name: string; relationship: string }[] })
  const [newFamName, setNewFamName] = useState('')
  const [newFamRel, setNewFamRel] = useState('husband')
  const [showCreateAnn, setShowCreateAnn] = useState(false)
  const [showCreateDrive, setShowCreateDrive] = useState(false)
  const [showCreateEv, setShowCreateEv] = useState(false)
  const [selectedDrive, setSelectedDrive] = useState<ContributionDrive | null>(null)
  const [paymentInput, setPaymentInput] = useState<{ userId: string; amount: string } | null>(null)
  const [editingDrive, setEditingDrive] = useState<ContributionDrive | null>(null)
  const [confirmDeleteDriveId, setConfirmDeleteDriveId] = useState<string | null>(null)
  const [editDriveForm, setEditDriveForm] = useState<DriveForm>(emptyDrive())

  // Announcement state
  const [annForm, setAnnForm]         = useState<AnnForm>(emptyAnn())
  const [annPosted, setAnnPosted]     = useState(false)
  const [editingAnn, setEditingAnn]   = useState<Announcement | null>(null)
  const [editAnnForm, setEditAnnForm] = useState<AnnForm>(emptyAnn())
  const [deleteAnnId, setDeleteAnnId] = useState<string | null>(null)

  // Event state
  const [evForm, setEvForm]         = useState<EvForm>(emptyEv())
  const [evPosted, setEvPosted]     = useState(false)
  const [editingEv, setEditingEv]   = useState<Event | null>(null)
  const [editEvForm, setEditEvForm] = useState<EvForm>(emptyEv())

  // Drive state
  const [driveForm, setDriveForm]     = useState<DriveForm>(emptyDrive())
  const [drivePosted, setDrivePosted] = useState(false)

  // Expense state
  const [expenseDrive, setExpenseDrive] = useState<ContributionDrive | null>(null)
  const [expForm, setExpForm]           = useState<ExpForm>(emptyExp())

  const isSuperAdmin = user?.role === 'super_admin'
  const isAdmin      = user?.role === 'admin' || isSuperAdmin

  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null
    if (t) setTab(t)
  }, [searchParams])

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ShieldAlert className="h-16 w-16 text-red-400" />
        <h3 className="text-lg font-bold">{lang === 'en' ? 'Access Denied' : 'Akses Ditolak'}</h3>
        <p className="text-sm text-gray-500">{lang === 'en' ? 'You do not have admin privileges.' : 'Tiada kebenaran admin.'}</p>
      </div>
    )
  }

  // ── Computed finance figures ────────────────────────────────────────────────
  const autoCollected = drives.reduce(
    (s, d) => s + d.contributions.filter((c) => c.confirmed).reduce((ss, c) => ss + c.amount, 0), 0
  )
  const autoSpent = drives.reduce(
    (s, d) => s + d.expenses.reduce((ss, e) => ss + e.amount, 0), 0
  )
  const totalCollected = financeStats?.collected ?? autoCollected
  const totalSpent = financeStats?.spent ?? autoSpent
  const netBalance = totalCollected - totalSpent

  // ── Media helpers ───────────────────────────────────────────────────────────
  const ALLOWED_MIME = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime']
  const uploadToStorage = async (file: File): Promise<MediaItem | null> => {
    if (!ALLOWED_MIME.includes(file.type)) return null
    const ext = file.type.split('/')[1].replace('quicktime', 'mov')
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('media').upload(path, file)
    if (error || !data) return null
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(data.path)
    return { type: file.type.startsWith('video') ? 'video' : 'image', url: publicUrl }
  }

  const handleMediaUpload = async <T extends { media: MediaItem[] }>(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<T>>
  ) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const file of files) {
      setMediaUploading(true)
      const item = await uploadToStorage(file)
      setMediaUploading(false)
      if (item) setter((prev) => ({ ...prev, media: [...prev.media, item] }))
    }
  }

  const removeMedia = <T extends { media: MediaItem[] }>(
    index: number,
    setter: React.Dispatch<React.SetStateAction<T>>
  ) => setter((prev) => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }))

  function MediaGrid<T extends { media: MediaItem[] }>({
    form, setForm,
  }: { form: T; setForm: React.Dispatch<React.SetStateAction<T>> }) {
    return (
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
          <ImagePlus className="h-4 w-4" />
          {lang === 'en' ? 'Attach Photos / Videos' : 'Lampirkan Foto / Video'}
        </label>
        {form.media.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {form.media.map((m, i) => (
              <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden bg-gray-100">
                {m.type === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={m.url} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">Video</div>}
                <button type="button" onClick={() => removeMedia(i, setForm)}
                  className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition-colors ${mediaUploading ? 'border-emerald-400 bg-emerald-50 text-emerald-600 cursor-wait' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-emerald-400 hover:bg-emerald-50'}`}>
          <ImagePlus className="h-4 w-4" />
          {mediaUploading
            ? (lang === 'en' ? 'Uploading…' : 'Memuat naik…')
            : (lang === 'en' ? 'Click to upload photos or videos' : 'Klik untuk muat naik')}
          <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={mediaUploading}
            onChange={(e) => handleMediaUpload(e, setForm)} />
        </label>
      </div>
    )
  }

  // ── Announcement handlers ───────────────────────────────────────────────────
  const handlePostAnn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!annForm.title.trim() || !user) return
    addAnnouncement({
      title: annForm.title,
      content: annForm.content || annForm.title,
      htmlContent: annForm.htmlContent,
      media: annForm.media,
      isPinned: annForm.isPinned,
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString().slice(0, 10),
    })
    addAuditEntry(`Published announcement: "${annForm.title}"`, user.name, 'Announcement')
    setAnnForm(emptyAnn())
    setAnnPosted(true)
    setTimeout(() => { setAnnPosted(false); setShowCreateAnn(false) }, 1800)
  }

  const openEditAnn = (ann: Announcement) => {
    setEditingAnn(ann)
    setEditAnnForm({ title: ann.title, htmlContent: ann.htmlContent || '', content: ann.content, media: [...ann.media], isPinned: ann.isPinned })
  }

  const saveEditAnn = () => {
    if (!editingAnn || !user) return
    updateAnnouncement(editingAnn.id, {
      title: editAnnForm.title,
      content: editAnnForm.content || editAnnForm.title,
      htmlContent: editAnnForm.htmlContent,
      media: editAnnForm.media,
      isPinned: editAnnForm.isPinned,
    })
    addAuditEntry(`Edited announcement: "${editAnnForm.title}"`, user.name, 'Announcement')
    setEditingAnn(null)
  }

  // ── Event handlers ──────────────────────────────────────────────────────────
  const handlePostEv = (e: React.FormEvent) => {
    e.preventDefault()
    if (!evForm.title.trim() || !evForm.date || !user) return
    addEvent({
      title: evForm.title,
      description: evForm.description || evForm.title,
      htmlContent: evForm.htmlContent,
      media: evForm.media,
      date: evForm.date,
      time: evForm.time || '12:00 PM',
      location: evForm.location,
      createdBy: user.id,
    })
    addAuditEntry(`Published event: "${evForm.title}"`, user.name, 'Event')
    setEvForm(emptyEv())
    setEvPosted(true)
    setTimeout(() => { setEvPosted(false); setShowCreateEv(false) }, 1800)
  }

  const openEditEv = (ev: Event) => {
    setEditingEv(ev)
    setEditEvForm({ title: ev.title, description: ev.description, htmlContent: ev.htmlContent || '', media: [...ev.media], date: ev.date, time: ev.time, location: ev.location })
  }

  const saveEditEv = () => {
    if (!editingEv || !user) return
    updateEvent(editingEv.id, {
      title: editEvForm.title,
      description: editEvForm.description || editEvForm.title,
      htmlContent: editEvForm.htmlContent,
      media: editEvForm.media,
      date: editEvForm.date,
      time: editEvForm.time,
      location: editEvForm.location,
    })
    addAuditEntry(`Edited event: "${editEvForm.title}"`, user.name, 'Event')
    setEditingEv(null)
  }

  // ── Drive handlers ──────────────────────────────────────────────────────────
  const handlePostDrive = (e: React.FormEvent) => {
    e.preventDefault()
    if (!driveForm.title.trim() || !driveForm.targetAmount || !driveForm.deadline || !user) return
    addDrive({
      title: driveForm.title,
      description: driveForm.description,
      amountType: driveForm.amountType,
      fixedAmount: driveForm.amountType === 'fixed' ? Number(driveForm.fixedAmount) : undefined,
      minimumAmount: driveForm.amountType === 'flexible' ? Number(driveForm.minimumAmount) : undefined,
      targetAmount: Number(driveForm.targetAmount),
      payNowName: driveForm.payNowName,
      payNowNumber: driveForm.payNowNumber,
      deadline: driveForm.deadline,
      specialInstructions: driveForm.specialInstructions || undefined,
      hofOnly: driveForm.hofOnly,
    })
    addAuditEntry(`Created fund collection: "${driveForm.title}"`, user.name, 'Finance')
    setDriveForm(emptyDrive())
    setDrivePosted(true)
    setTimeout(() => { setDrivePosted(false); setShowCreateDrive(false) }, 1800)
  }

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseDrive || !expForm.description.trim() || !expForm.amount || !user) return
    addExpense(expenseDrive.id, {
      description: expForm.description,
      amount: Number(expForm.amount),
      date: expForm.date,
      category: expForm.category,
    })
    addAuditEntry(`Added expense: "${expForm.description}" (SGD ${expForm.amount}) for "${expenseDrive.title}"`, user.name, 'Finance')
    setExpForm(emptyExp())
    // refresh local reference
    setExpenseDrive((prev) => prev ? { ...prev, expenses: [...prev.expenses] } : prev)
  }

  const downloadCsv = (rows: Record<string, string | number | boolean>[], filename: string) => {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const lines = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ]
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const feedbackRows = () => feedback.map((f) => ({
    [lang === 'en' ? 'Sender' : 'Penghantar']: f.userName,
    [lang === 'en' ? 'Date Submitted' : 'Tarikh Dihantar']: f.createdAt,
    [lang === 'en' ? 'Contact Details' : 'Maklumat Hubungi']: f.contactDetails || '—',
    [lang === 'en' ? 'Follow-up Requested' : 'Minta Tindak Balas']: f.requestFollowUp ? (lang === 'en' ? 'Yes' : 'Ya') : (lang === 'en' ? 'No' : 'Tidak'),
    [lang === 'en' ? 'Status' : 'Status']: f.status === 'open' ? (lang === 'en' ? 'Open' : 'Terbuka') : (lang === 'en' ? 'Resolved' : 'Selesai'),
    [lang === 'en' ? 'Last Action' : 'Tindakan Terakhir']: f.lastAction ? (f.lastAction === 'resolved' ? (lang === 'en' ? 'Resolved' : 'Diselesaikan') : (lang === 'en' ? 'Reopened' : 'Dibuka Semula')) : '—',
    [lang === 'en' ? 'Action By' : 'Tindakan Oleh']: f.lastActionBy || '—',
    [lang === 'en' ? 'Action Date' : 'Tarikh Tindakan']: f.lastActionAt || '—',
    [lang === 'en' ? 'Feedback' : 'Maklum Balas']: f.content,
  }))

  const exportFeedbackExcel = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(feedbackRows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Feedback')
    XLSX.writeFile(wb, 'KBMI_Feedback.xlsx')
  }

  const exportFeedbackCsv = () => downloadCsv(feedbackRows(), 'KBMI_Feedback.csv')

  const userRows = () => users.flatMap((u) => {
    if (!u.familyMembers || u.familyMembers.length === 0) {
      return [{ 'Full Name': u.name, 'Email': u.email, 'Family Member': '', 'Relationship': '' }]
    }
    return u.familyMembers.map((m) => ({
      'Full Name': u.name,
      'Email': u.email,
      'Family Member': m.name,
      'Relationship': m.relationship,
    }))
  })

  const exportUsersExcel = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(userRows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Members')
    XLSX.writeFile(wb, 'KBMI_Members.xlsx')
  }

  const exportUsersCsv = () => downloadCsv(userRows(), 'KBMI_Members.csv')

  const auditRows = () => auditLog.map((e) => {
    const d = new Date(e.timestamp)
    return {
      'Category':     e.category,
      'Activity':     e.activity,
      'Initiated by': e.initiatedBy,
      'Date':         d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Time':         d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
  })

  const exportAuditExcel = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(auditRows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log')
    XLSX.writeFile(wb, 'KBMI_Audit_Log.xlsx')
  }

  const exportAuditCsv = () => downloadCsv(auditRows(), 'KBMI_Audit_Log.csv')

  const exportFinanceReport = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Sheet 1 – Collections overview
    const ws1 = XLSX.utils.json_to_sheet(drives.map((d) => {
      const collected = d.contributions.filter((c) => c.confirmed).reduce((s, c) => s + c.amount, 0)
      const spent = d.expenses.reduce((s, e) => s + e.amount, 0)
      return {
        'Collection': d.title,
        'Status': d.status === 'active' ? 'Open' : 'Closed',
        'Amount Type': d.amountType === 'fixed' ? `Fixed SGD ${d.fixedAmount}` : `Flexible (min SGD ${d.minimumAmount})`,
        'Target (SGD)': d.targetAmount,
        'Collected (SGD)': collected,
        'Spent (SGD)': spent,
        'Balance (SGD)': collected - spent,
        'Deadline': d.deadline,
        'HoF Only': d.hofOnly ? 'Yes' : 'No',
      }
    }))
    XLSX.utils.book_append_sheet(wb, ws1, 'Collections')

    // Sheet 2 – Contributions
    const ws2 = XLSX.utils.json_to_sheet(drives.flatMap((d) =>
      d.contributions.map((c) => ({
        'Collection': d.title,
        'Member': c.userName,
        'Amount (SGD)': c.amount,
        'Paid At': c.paidAt,
        'Confirmed': c.confirmed ? 'Yes' : 'No',
        'Confirmed By': c.confirmedBy || '',
      }))
    ))
    XLSX.utils.book_append_sheet(wb, ws2, 'Contributions')

    // Sheet 3 – Expenses
    const ws3 = XLSX.utils.json_to_sheet(drives.flatMap((d) =>
      d.expenses.map((e) => ({
        'Collection': d.title,
        'Description': e.description,
        'Category': e.category,
        'Amount (SGD)': e.amount,
        'Date': e.date,
      }))
    ))
    XLSX.utils.book_append_sheet(wb, ws3, 'Expenses')

    XLSX.writeFile(wb, 'KBMI_Finance_Report.xlsx')
  }

  const exportFinanceCsv = () => {
    const rows = drives.flatMap((d) => {
      const collected = d.contributions.filter((c) => c.confirmed).reduce((s, c) => s + c.amount, 0)
      const spent = d.expenses.reduce((s, e) => s + e.amount, 0)
      const driveRow = {
        'Section': 'Collection',
        'Collection': d.title,
        'Status': d.status === 'active' ? 'Open' : 'Closed',
        'Amount Type': d.amountType === 'fixed' ? `Fixed SGD ${d.fixedAmount}` : `Flexible (min SGD ${d.minimumAmount})`,
        'Target (SGD)': d.targetAmount,
        'Collected (SGD)': collected,
        'Spent (SGD)': spent,
        'Balance (SGD)': collected - spent,
        'Deadline': d.deadline || '',
        'HoF Only': d.hofOnly ? 'Yes' : 'No',
        'Member / Description': '',
        'Date': '',
        'Category': '',
      }
      const contribRows = d.contributions.filter((c) => c.confirmed).map((c) => ({
        'Section': 'Contribution',
        'Collection': d.title,
        'Status': '',
        'Amount Type': '',
        'Target (SGD)': '',
        'Collected (SGD)': c.amount,
        'Spent (SGD)': '',
        'Balance (SGD)': '',
        'Deadline': '',
        'HoF Only': '',
        'Member / Description': c.userName,
        'Date': c.paidAt,
        'Category': '',
      }))
      const expenseRows = d.expenses.map((e) => ({
        'Section': 'Expense',
        'Collection': d.title,
        'Status': '',
        'Amount Type': '',
        'Target (SGD)': '',
        'Collected (SGD)': '',
        'Spent (SGD)': e.amount,
        'Balance (SGD)': '',
        'Deadline': '',
        'HoF Only': '',
        'Member / Description': e.description,
        'Date': e.date,
        'Category': e.category,
      }))
      return [driveRow, ...contribRows, ...expenseRows]
    })
    downloadCsv(rows, 'KBMI_Finance_Report.csv')
  }

  const pendingContribs = drives.flatMap((d) =>
    d.contributions.filter((c) => !c.confirmed).map((c) => ({ ...c, driveTitle: d.title, driveId: d.id }))
  )

  const roleColors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    member: 'bg-gray-100 text-gray-600',
  }
  const roleLabel = (r: string) =>
    r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : (lang === 'en' ? 'Member' : 'Ahli')

  const expCatLabel = (c: Expense['category']) => ({
    event: lang === 'en' ? 'Event' : 'Acara',
    admin: lang === 'en' ? 'Admin' : 'Pentadbiran',
    charity: lang === 'en' ? 'Charity' : 'Kebajikan',
    other: lang === 'en' ? 'Other' : 'Lain-lain',
  }[c])

  const tabs = [
    { id: 'dashboard' as Tab,     label: lang === 'en' ? 'Dashboard' : 'Papan Pemuka' },
    { id: 'users' as Tab,         label: lang === 'en' ? 'Users' : 'Pengguna' },
    { id: 'announcements' as Tab, label: lang === 'en' ? 'Bulletin' : 'Buletin' },
    { id: 'events' as Tab,        label: lang === 'en' ? 'Events' : 'Acara' },
    { id: 'polls' as Tab,         label: lang === 'en' ? 'Polls' : 'Undian' },
    { id: 'feedback' as Tab,      label: lang === 'en' ? 'Feedback' : 'Maklum Balas' },
    ...(isSuperAdmin ? [{ id: 'finance' as Tab, label: lang === 'en' ? 'Finance' : 'Kewangan' }] : []),
    ...(isSuperAdmin ? [{ id: 'audit' as Tab,   label: lang === 'en' ? 'Audit' : 'Audit' }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="relative bg-[#2D1B5E] -mx-4 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/adminpanel.png"
          alt=""
          className="absolute right-0 top-0 h-36 w-auto object-cover object-top pointer-events-none"
        />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white">{lang === 'en' ? 'Admin Panel' : 'Panel Admin'}</h2>
          <p className="text-sm text-violet-300 mt-1">
            {isSuperAdmin ? (lang === 'en' ? 'Super Admin — full access' : 'Super Admin — akses penuh') : 'Admin'}
          </p>
        </div>
      </div>

      {/* Tab bar — always at top */}
      <div className="flex rounded-xl bg-gray-100 p-1 gap-1 overflow-x-auto">
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`shrink-0 flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${tab === id ? 'bg-[#2D1B5E] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ──────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">

          {/* ── Hub Overview ── */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Users className="h-4 w-4 text-violet-500" />
              {lang === 'en' ? 'Hub Overview' : 'Gambaran Hub'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { n: users.length,         label: lang === 'en' ? 'Members' : 'Ahli',                         color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { n: announcements.length, label: lang === 'en' ? 'Announcements' : 'Pengumuman',              color: 'text-orange-600',  bg: 'bg-orange-50' },
                { n: events.length,        label: lang === 'en' ? 'Events Published' : 'Acara Diterbitkan',    color: 'text-blue-600',    bg: 'bg-blue-50' },
                { n: feedback.length,      label: lang === 'en' ? 'Feedback Received' : 'Maklum Balas Diterima', color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(({ n, label, color, bg }) => (
                <div key={label} className={`rounded-2xl ${bg} p-4 shadow-sm border border-gray-100`}>
                  <div className={`text-2xl font-bold ${color}`}>{n}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Finance ── */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Wallet className="h-4 w-4 text-emerald-600" />
              {lang === 'en' ? 'Finance' : 'Kewangan'}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-emerald-700 p-3 text-white">
                <TrendingUp className="h-4 w-4 opacity-70 mb-1" />
                <div className="text-lg font-bold">SGD {totalCollected.toLocaleString()}</div>
                <div className="text-xs opacity-80">{lang === 'en' ? 'Collected' : 'Dikutip'}</div>
              </div>
              <div className="rounded-2xl bg-red-500 p-3 text-white">
                <TrendingDown className="h-4 w-4 opacity-70 mb-1" />
                <div className="text-lg font-bold">SGD {totalSpent.toLocaleString()}</div>
                <div className="text-xs opacity-80">{lang === 'en' ? 'Spent' : 'Dibelanjakan'}</div>
              </div>
              <div className={`rounded-2xl p-3 text-white ${netBalance >= 0 ? 'bg-blue-600' : 'bg-orange-500'}`}>
                <Wallet className="h-4 w-4 opacity-70 mb-1" />
                <div className="text-lg font-bold">{netBalance < 0 ? '-' : ''}SGD {Math.abs(netBalance).toLocaleString()}</div>
                <div className="text-xs opacity-80">{lang === 'en' ? 'Current Balance' : 'Baki Semasa'}</div>
              </div>
            </div>

          {/* ── Contribution Drives chart ── */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {lang === 'en' ? 'Contribution Drives — Collected vs Target (SGD)' : 'Kutipan Dana — Terkumpul vs Sasaran (SGD)'}
            </p>
            <DriveBarChart lang={lang} drives={drives} />
          </div>
          </div>

          {/* ── Interactivity ── */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              {lang === 'en' ? 'Interactivity' : 'Interaktiviti'}
            </h3>
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <DashboardCharts lang={lang} announcements={announcements} events={events} listings={listings} polls={polls} drives={drives} />
            </div>
          </div>

        </div>
      )}

      {/* ── USERS ──────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs text-gray-400">
              {lang === 'en' ? 'Toggle the crown to mark a member as Head of Family.' : 'Togol mahkota untuk tandakan Ketua Keluarga.'}
            </p>
            {isSuperAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowUsersExportMenu((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Export' : 'Eksport'}
                </button>
                {showUsersExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUsersExportMenu(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowUsersExportMenu(false); exportUsersExcel() }}
                      >
                        <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        {lang === 'en' ? 'Export as Excel' : 'Eksport sebagai Excel'}
                      </button>
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowUsersExportMenu(false); exportUsersCsv() }}
                      >
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                        {lang === 'en' ? 'Export for Google Sheets' : 'Eksport untuk Google Sheets'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {[...users].sort((a, b) => a.name.localeCompare(b.name)).map((u) => {
            const canToggleHoF = u.role === 'member'
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
                <div className="relative">
                  <Avatar className="h-10 w-10 bg-emerald-100">
                    {u.profilePhoto && <AvatarImage src={u.profilePhoto} />}
                    <AvatarFallback className="text-sm font-semibold text-emerald-800">{u.avatar}</AvatarFallback>
                  </Avatar>
                  {u.isHeadOfFamily && (
                    <Crown className="absolute -top-1.5 -right-1.5 h-4 w-4 text-amber-500 fill-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="text-sm font-semibold text-gray-900 hover:text-emerald-700 hover:underline transition-colors text-left"
                    >
                      {u.name}
                    </button>
                    <Badge className={`text-xs ${roleColors[u.role]}`}>{roleLabel(u.role)}</Badge>
                    {u.isHeadOfFamily && (
                      <Badge className="text-xs bg-amber-100 text-amber-700">
                        {lang === 'en' ? 'Head of Family' : 'Ketua Keluarga'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {u.dob ? (() => {
                      const today = new Date()
                      const birth = new Date(u.dob)
                      let age = today.getFullYear() - birth.getFullYear()
                      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
                      return lang === 'en' ? `Age ${age}` : `Umur ${age}`
                    })() : (lang === 'en' ? 'Age not provided' : 'Umur tidak dinyatakan')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* 3-way role selector — super admin only */}
                  {isSuperAdmin && (
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-semibold">
                      {(['super_admin', 'admin', 'member'] as const).map((role) => {
                        const labels: Record<string, string> = { super_admin: 'S.Admin', admin: 'Admin', member: 'Off' }
                        const activeColors: Record<string, string> = { super_admin: 'bg-indigo-600 text-white', admin: 'bg-violet-500 text-white', member: 'bg-gray-100 text-gray-500' }
                        const isActive = u.role === role
                        return (
                          <button
                            key={role}
                            onClick={() => {
                              const label = role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Member'
                              addAuditEntry(`Changed role of ${u.name} to ${label}`, user?.name || '', 'User')
                              setUserRole(u.id, role)
                            }}
                            className={`px-2 py-1 transition-colors ${isActive ? activeColors[role] : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                          >
                            {labels[role]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Head of Family toggle */}
                  {canToggleHoF && (
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => {
                          addAuditEntry(`${u.isHeadOfFamily ? 'Removed' : 'Set'} ${u.name} as Head of Family`, user?.name || '', 'User')
                          toggleHeadOfFamily(u.id)
                        }}
                        title={lang === 'en' ? 'Toggle Head of Family' : 'Togol Ketua Keluarga'}
                        className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${u.isHeadOfFamily ? 'bg-amber-400' : 'bg-gray-200'}`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${u.isHeadOfFamily ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className="text-[9px] text-gray-400">{lang === 'en' ? 'HoF' : 'KK'}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ANNOUNCEMENTS ──────────────────────────────────────────────────── */}
      {tab === 'announcements' && (
        <div className="space-y-3">
          {/* Published header with + button */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {lang === 'en' ? `Published (${announcements.length})` : `Diterbitkan (${announcements.length})`}
            </h3>
            <button
              onClick={() => { setAnnForm(emptyAnn()); setShowCreateAnn(true) }}
              title={lang === 'en' ? 'Post New Announcement' : 'Hantar Pengumuman Baru'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-emerald-500 hover:text-emerald-700 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {announcements.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                {lang === 'en' ? 'No posts yet. Tap + to create one.' : 'Tiada pos. Tekan + untuk buat pos.'}
              </div>
            )}
            {announcements.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  {a.media[0] && <img src={a.media[0].url} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {a.isPinned && <Pin className="h-3 w-3 text-emerald-600 shrink-0" />}
                      <span className="text-sm font-semibold text-gray-800 line-clamp-1">{a.title}</span>
                    </div>
                    <div className="text-xs text-gray-400">{a.createdAt} · {a.media.length} media · {a.comments.length} {lang === 'en' ? 'comments' : 'komen'}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditAnn(a)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeleteAnnId(a.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EVENTS ─────────────────────────────────────────────────────────── */}
      {tab === 'events' && (
        <div className="space-y-3">
          {/* All events header with + button */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {lang === 'en' ? `All Events (${events.length})` : `Semua Acara (${events.length})`}
            </h3>
            <button
              onClick={() => { setEvForm(emptyEv()); setShowCreateEv(true) }}
              title={lang === 'en' ? 'Create New Event' : 'Buat Acara Baru'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-emerald-500 hover:text-emerald-700 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {events.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                {lang === 'en' ? 'No events yet. Tap + to create one.' : 'Tiada acara. Tekan + untuk buat acara.'}
              </div>
            )}
            {events.slice().sort((a, b) => a.date.localeCompare(b.date)).map((ev) => (
              <div key={ev.id} className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  {ev.media[0] && <img src={ev.media[0].url} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 line-clamp-1">{ev.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{ev.date} · {ev.time}</div>
                    <div className="text-xs text-gray-400 line-clamp-1">{ev.location}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{ev.rsvps.length} RSVPs · {ev.media.length} media</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditEv(ev)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { addAuditEntry(`Deleted event: "${ev.title}"`, user?.name || '', 'Event'); deleteEvent(ev.id) }} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FEEDBACK ───────────────────────────────────────────────────────── */}
      {tab === 'feedback' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {lang === 'en' ? `Submitted Feedback (${feedback.length})` : `Maklum Balas (${feedback.length})`}
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {feedback.filter((f) => f.status === 'open').length} {lang === 'en' ? 'open' : 'terbuka'}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {feedback.filter((f) => f.status === 'resolved').length} {lang === 'en' ? 'resolved' : 'selesai'}
                </span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowFeedbackExportMenu((v) => !v)}
                  title={lang === 'en' ? 'Export' : 'Eksport'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
                {showFeedbackExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFeedbackExportMenu(false)} />
                    <div className="absolute right-0 top-10 z-20 w-52 rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowFeedbackExportMenu(false); exportFeedbackExcel() }}
                      >
                        <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        {lang === 'en' ? 'Export to Excel' : 'Eksport ke Excel'}
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowFeedbackExportMenu(false); exportFeedbackCsv() }}
                      >
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                        {lang === 'en' ? 'Export to Google Sheets' : 'Eksport ke Google Sheets'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {feedback.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              {lang === 'en' ? 'No feedback submitted yet.' : 'Tiada maklum balas lagi.'}
            </div>
          )}

          {feedback.map((f) => (
            <div key={f.id} className={`rounded-2xl bg-white p-4 shadow-sm border ${f.status === 'open' ? 'border-amber-100' : 'border-gray-100'}`}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{f.userName}</span>
                  {f.requestFollowUp && (
                    <Badge className="text-xs bg-blue-100 text-blue-700 flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" />
                      {lang === 'en' ? 'Follow-up requested' : 'Minta tindak balas'}
                    </Badge>
                  )}
                  <Badge className={`text-xs ${f.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {f.status === 'open' ? (lang === 'en' ? 'Open' : 'Terbuka') : (lang === 'en' ? 'Resolved' : 'Selesai')}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {f.status === 'open' ? (
                    <button
                      onClick={() => { addAuditEntry(`Marked feedback from ${f.userName} as resolved`, user?.name || '', 'Feedback'); markFeedbackResolved(f.id, user?.name || '') }}
                      className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs text-white hover:bg-emerald-800 transition-colors">
                      <CheckCircle className="h-3 w-3" />
                      {lang === 'en' ? 'Resolve' : 'Selesai'}
                    </button>
                  ) : (
                    <button
                      onClick={() => { addAuditEntry(`Reopened feedback from ${f.userName}`, user?.name || '', 'Feedback'); reopenFeedback(f.id, user?.name || '') }}
                      className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                      <Clock className="h-3 w-3" />
                      {lang === 'en' ? 'Reopen' : 'Buka Semula'}
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      onClick={() => { addAuditEntry(`Deleted feedback from ${f.userName}`, user?.name || '', 'Feedback'); deleteFeedback(f.id) }}
                      className="flex items-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Feedback content */}
              <p className="text-sm text-gray-700 mb-3">{f.content}</p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 border-t border-gray-100 pt-2">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {f.createdAt}
                </span>
                {f.contactDetails && (
                  <span className="flex items-center gap-1 text-gray-600 font-medium">
                    <Phone className="h-3 w-3" />
                    {f.contactDetails}
                  </span>
                )}
                {!f.contactDetails && (
                  <span className="italic">{lang === 'en' ? 'No contact details provided' : 'Tiada maklumat hubungi'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── POLLS ──────────────────────────────────────────────────────────── */}
      {tab === 'polls' && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {lang === 'en' ? `Polls (${polls.length})` : `Undian (${polls.length})`}
            </h3>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3 gap-1"
              onClick={() => {
                setEditingPoll(null)
                setPollQuestion('')
                setPollOptions([{ id: 'o1', text: '' }, { id: 'o2', text: '' }])
                setPollAllowMultiple(false)
                setPollExpiresAt('')
                setPollIsActive(true)
                setShowPollForm(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {lang === 'en' ? 'New Poll' : 'Undian Baru'}
            </Button>
          </div>

          {/* Create / Edit form */}
          {showPollForm && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-indigo-100 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">
                {editingPoll
                  ? (lang === 'en' ? 'Edit Poll' : 'Edit Undian')
                  : (lang === 'en' ? 'Create Poll' : 'Cipta Undian')}
              </h4>

              {/* Question */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {lang === 'en' ? 'Question' : 'Soalan'}
                </label>
                <Input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder={lang === 'en' ? 'Ask the family something...' : 'Tanya sesuatu kepada keluarga...'}
                  className="h-10"
                />
              </div>

              {/* Options */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {lang === 'en' ? 'Options' : 'Pilihan'}
                </label>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <Input
                        value={opt.text}
                        onChange={(e) => setPollOptions((prev) => prev.map((o, j) => j === i ? { ...o, text: e.target.value } : o))}
                        placeholder={`${lang === 'en' ? 'Option' : 'Pilihan'} ${i + 1}`}
                        className="h-9 flex-1"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPollOptions((prev) => [...prev, { id: `o${Date.now()}`, text: '' }])}
                  className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Add option' : 'Tambah pilihan'}
                </button>
              </div>

              {/* Settings row */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPollAllowMultiple((v) => !v)}
                    className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${pollAllowMultiple ? 'bg-indigo-500' : 'bg-gray-200'}`}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${pollAllowMultiple ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-gray-600">{lang === 'en' ? 'Allow multiple choice' : 'Benarkan pilihan berbilang'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPollIsActive((v) => !v)}
                    className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${pollIsActive ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${pollIsActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-gray-600">{lang === 'en' ? 'Active' : 'Aktif'}</span>
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {lang === 'en' ? 'Expiry Date' : 'Tarikh Tamat'}
                </label>
                <Input
                  type="date"
                  value={pollExpiresAt}
                  onChange={(e) => setPollExpiresAt(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-9"
                  onClick={() => {
                    if (!pollQuestion.trim() || pollOptions.some((o) => !o.text.trim()) || !pollExpiresAt || !user) return
                    const opts: PollOption[] = pollOptions.map((o) => ({ id: o.id, text: o.text.trim(), votes: [] }))
                    if (editingPoll) {
                      updatePoll(editingPoll.id, {
                        question: pollQuestion.trim(),
                        options: opts.map((o) => {
                          const existing = editingPoll.options.find((e) => e.id === o.id)
                          return existing ? { ...existing, text: o.text } : o
                        }),
                        allowMultiple: pollAllowMultiple,
                        expiresAt: pollExpiresAt,
                        isActive: pollIsActive,
                      })
                      addAuditEntry(`Edited poll: "${pollQuestion.trim()}"`, user.name, 'Announcement')
                    } else {
                      addPoll({
                        question: pollQuestion.trim(),
                        options: opts,
                        allowMultiple: pollAllowMultiple,
                        expiresAt: pollExpiresAt,
                        isActive: pollIsActive,
                        createdById: user.id,
                        createdByName: user.name,
                      })
                      addAuditEntry(`Created poll: "${pollQuestion.trim()}"`, user.name, 'Announcement')
                    }
                    setShowPollForm(false)
                    setEditingPoll(null)
                  }}
                >
                  {editingPoll ? (lang === 'en' ? 'Save Changes' : 'Simpan') : (lang === 'en' ? 'Create Poll' : 'Cipta Undian')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => { setShowPollForm(false); setEditingPoll(null) }}
                >
                  {lang === 'en' ? 'Cancel' : 'Batal'}
                </Button>
              </div>
            </div>
          )}

          {/* Poll list */}
          {polls.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              {lang === 'en' ? 'No polls yet.' : 'Tiada undian lagi.'}
            </div>
          )}

          {polls.map((poll) => {
            const today = new Date().toISOString().slice(0, 10)
            const closed = !poll.isActive || poll.expiresAt < today
            const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)
            return (
              <div key={poll.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{poll.question}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {poll.allowMultiple ? (lang === 'en' ? 'Multiple choice · ' : 'Berbilang · ') : ''}
                      {lang === 'en' ? `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}` : `${totalVotes} undian`}
                      {' · '}{lang === 'en' ? 'Expires' : 'Tamat'} {poll.expiresAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${closed ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {closed ? (lang === 'en' ? 'Closed' : 'Ditutup') : (lang === 'en' ? 'Active' : 'Aktif')}
                    </span>
                    <button
                      onClick={() => {
                        setEditingPoll(poll)
                        setPollQuestion(poll.question)
                        setPollOptions(poll.options.map((o) => ({ id: o.id, text: o.text })))
                        setPollAllowMultiple(poll.allowMultiple)
                        setPollExpiresAt(poll.expiresAt)
                        setPollIsActive(poll.isActive)
                        setShowPollForm(true)
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletePollId(poll.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {/* Option bars */}
                <div className="space-y-1.5">
                  {poll.options.map((opt) => {
                    const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0
                    return (
                      <div key={opt.id}>
                        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                          <span>{opt.text}</span>
                          <span className="font-medium">{opt.votes.length} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100">
                          <div className="h-1.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Delete confirm */}
          {deletePollId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl">
                <p className="text-sm font-semibold text-gray-900 mb-1">{lang === 'en' ? 'Delete this poll?' : 'Padam undian ini?'}</p>
                <p className="text-xs text-gray-500 mb-4">{lang === 'en' ? 'All votes will be lost.' : 'Semua undian akan hilang.'}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white h-9"
                    onClick={() => {
                      const poll = polls.find((p) => p.id === deletePollId)
                      deletePoll(deletePollId)
                      if (user && poll) addAuditEntry(`Deleted poll: "${poll.question}"`, user.name, 'Announcement')
                      setDeletePollId(null)
                    }}
                  >
                    {lang === 'en' ? 'Delete' : 'Padam'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => setDeletePollId(null)}>
                    {lang === 'en' ? 'Cancel' : 'Batal'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FINANCE (Super Admin only) ─────────────────────────────────────── */}
      {tab === 'finance' && isSuperAdmin && (
        <div className="space-y-4">
          {/* Finance sub-tabs */}
          <div className="flex gap-2">
            {([
              { id: 'overview',     label: lang === 'en' ? 'Overview'          : 'Ringkasan' },
              { id: 'contributors', label: lang === 'en' ? 'Top Contributors'  : 'Penyumbang' },
              { id: 'drives',       label: lang === 'en' ? 'Fund Drives'       : 'Kutipan' },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => setFinanceTab(id)}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                  financeTab === id
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Overview sub-tab: per-drive charts ── */}
          {financeTab === 'overview' && (
            <div className="space-y-3">
              {/* ── Finance summary card ── */}
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                <div className="mb-3">
                  <span className="text-sm font-semibold text-gray-700">{lang === 'en' ? 'Treasury Summary' : 'Ringkasan Kewangan'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-700 p-3 text-white">
                    <TrendingUp className="h-4 w-4 opacity-70 mb-1" />
                    <div className="text-base font-bold">SGD {totalCollected.toLocaleString()}</div>
                    <div className="text-xs opacity-80">{lang === 'en' ? 'Collected' : 'Dikutip'}</div>
                  </div>
                  <div className="rounded-xl bg-red-500 p-3 text-white">
                    <TrendingDown className="h-4 w-4 opacity-70 mb-1" />
                    <div className="text-base font-bold">SGD {totalSpent.toLocaleString()}</div>
                    <div className="text-xs opacity-80">{lang === 'en' ? 'Spent' : 'Dibelanjakan'}</div>
                  </div>
                  <div className={`rounded-xl p-3 text-white ${netBalance >= 0 ? 'bg-blue-600' : 'bg-orange-500'}`}>
                    <Wallet className="h-4 w-4 opacity-70 mb-1" />
                    <div className="text-base font-bold">{netBalance < 0 ? '-' : ''}SGD {Math.abs(netBalance).toLocaleString()}</div>
                    <div className="text-xs opacity-80">{lang === 'en' ? 'Balance' : 'Baki'}</div>
                  </div>
                </div>
              </div>

              {drives.map((d) => {
                const collected = d.contributions.filter((c) => c.confirmed).reduce((s, c) => s + c.amount, 0)
                const spent = d.expenses.reduce((s, e) => s + e.amount, 0)
                const collectedPct = d.targetAmount > 0 ? Math.min((collected / d.targetAmount) * 100, 100) : 0
                const spentPct = d.targetAmount > 0 ? Math.min((spent / d.targetAmount) * 100, 100) : 0
                const balance = collected - spent
                return (
                  <div key={d.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-800 line-clamp-1 flex-1 mr-2">{d.title}</span>
                      <Badge className={d.status === 'active' ? 'bg-emerald-100 text-emerald-700 text-xs shrink-0' : 'bg-gray-100 text-gray-500 text-xs shrink-0'}>
                        {d.status === 'active' ? (lang === 'en' ? 'Active' : 'Aktif') : (lang === 'en' ? 'Closed' : 'Tutup')}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-18 shrink-0 text-gray-400">{lang === 'en' ? 'Target' : 'Sasaran'}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className="h-2 w-full bg-gray-200 rounded-full" />
                        </div>
                        <span className="text-gray-500 font-medium shrink-0 w-20 text-right">SGD {d.targetAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-18 shrink-0 text-emerald-600">{lang === 'en' ? 'Collected' : 'Dikutip'}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className="h-2 bg-emerald-500 rounded-full transition-all" style={{ width: `${collectedPct}%` }} />
                        </div>
                        <span className="text-emerald-700 font-medium shrink-0 w-20 text-right">SGD {collected.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-18 shrink-0 text-red-500">{lang === 'en' ? 'Spent' : 'Dibelanjakan'}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className="h-2 bg-red-400 rounded-full transition-all" style={{ width: `${spentPct}%` }} />
                        </div>
                        <span className="text-red-600 font-medium shrink-0 w-20 text-right">SGD {spent.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-xs">
                      <span className="text-gray-400">{Math.round(collectedPct)}% {lang === 'en' ? 'of target' : 'dari sasaran'}</span>
                      <span className={`font-semibold ${balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                        {lang === 'en' ? 'Balance' : 'Baki'}: SGD {balance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Top Contributors sub-tab ── */}
          {financeTab === 'contributors' && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 space-y-3">
              {(() => {
                const scores: Record<string, { name: string; total: number }> = {}
                drives.forEach((d) =>
                  d.contributions.filter((c) => c.confirmed).forEach((c) => {
                    scores[c.userId] = { name: c.userName, total: (scores[c.userId]?.total || 0) + c.amount }
                  })
                )
                const ranked = Object.values(scores).sort((a, b) => b.total - a.total)
                const maxTotal = ranked[0]?.total || 1
                const medals = ['🥇', '🥈', '🥉']
                if (ranked.length === 0) {
                  return <p className="text-center text-sm text-gray-400 py-4">{lang === 'en' ? 'No confirmed contributions yet.' : 'Tiada sumbangan disahkan.'}</p>
                }
                return ranked.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 text-center text-base">
                      {i < 3 ? medals[i] : <span className="text-sm font-bold text-gray-400">#{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate">{r.name}</span>
                        <span className="text-sm font-bold text-emerald-700 shrink-0 ml-2">SGD {r.total.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className="h-2 bg-emerald-500 rounded-full transition-all" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

          {/* ── Fund Drives sub-tab ── */}
          {financeTab === 'drives' && (
            <div className="space-y-4">

          {/* All collections header with + and export buttons */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {lang === 'en' ? `All Collections (${drives.length})` : `Semua Kutipan (${drives.length})`}
            </h3>
            <div className="flex items-center gap-2">
              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFinanceExportMenu((v) => !v)}
                  title={lang === 'en' ? 'Export' : 'Eksport'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
                {showFinanceExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFinanceExportMenu(false)} />
                    <div className="absolute right-0 top-10 z-20 w-52 rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowFinanceExportMenu(false); exportFinanceReport() }}
                      >
                        <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        {lang === 'en' ? 'Export to Excel' : 'Eksport ke Excel'}
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowFinanceExportMenu(false); exportFinanceCsv() }}
                      >
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                        {lang === 'en' ? 'Export to Google Sheets' : 'Eksport ke Google Sheets'}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {/* Add new collection button */}
              <button
                onClick={() => { setDriveForm(emptyDrive()); setShowCreateDrive(true) }}
                title={lang === 'en' ? 'Create New Collection' : 'Buat Kutipan Baru'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-emerald-500 hover:text-emerald-700 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {drives.map((d) => {
              const total = d.contributions.filter((c) => c.confirmed).reduce((s, c) => s + c.amount, 0)
              const spent = d.expenses.reduce((s, e) => s + e.amount, 0)
              const amountLabel = d.amountType === 'fixed'
                ? `SGD ${d.fixedAmount} ${lang === 'en' ? 'fixed' : 'tetap'}`
                : `SGD ${d.minimumAmount} ${lang === 'en' ? 'min.' : 'min.'}`
              return (
                <div key={d.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isSuperAdmin ? (
                          <button
                            onClick={() => setSelectedDrive(d)}
                            className="text-sm font-semibold text-emerald-700 hover:underline text-left"
                          >
                            {d.title}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{d.title}</span>
                        )}
                        {isSuperAdmin && (confirmDeleteDriveId === d.id ? (
                          <span className="flex items-center gap-1 ml-1">
                            <span className="text-xs text-red-500 font-medium">{lang === 'en' ? 'Delete?' : 'Padam?'}</span>
                            <button
                              onClick={() => {
                                deleteDrive(d.id)
                                addAuditEntry(`Deleted fund drive: "${d.title}"`, user?.name || '', 'Finance')
                                setConfirmDeleteDriveId(null)
                              }}
                              className="rounded px-2 py-0.5 text-xs bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                              {lang === 'en' ? 'Yes' : 'Ya'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteDriveId(null)}
                              className="rounded px-2 py-0.5 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              {lang === 'en' ? 'No' : 'Tidak'}
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 ml-0.5">
                            <button
                              onClick={() => {
                                setEditingDrive(d)
                                setEditDriveForm({
                                  title: d.title,
                                  description: d.description,
                                  amountType: d.amountType,
                                  fixedAmount: d.fixedAmount != null ? String(d.fixedAmount) : '',
                                  minimumAmount: d.minimumAmount != null ? String(d.minimumAmount) : '',
                                  targetAmount: String(d.targetAmount),
                                  payNowName: d.payNowName,
                                  payNowNumber: d.payNowNumber,
                                  specialInstructions: d.specialInstructions || '',
                                  deadline: d.deadline,
                                  hofOnly: d.hofOnly ?? false,
                                })
                              }}
                              className="text-gray-400 hover:text-emerald-700 transition-colors shrink-0"
                              title={lang === 'en' ? 'Edit' : 'Edit'}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteDriveId(d.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              title={lang === 'en' ? 'Delete' : 'Padam'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      {d.hofOnly && (
                        <Badge className="mt-1 text-xs bg-amber-100 text-amber-700">
                          {lang === 'en' ? 'Head of Family only' : 'Ketua Keluarga sahaja'}
                        </Badge>
                      )}
                    </div>
                    {/* Status toggle switch */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">
                        {d.status === 'active' ? (lang === 'en' ? 'Open' : 'Buka') : (lang === 'en' ? 'Closed' : 'Tutup')}
                      </span>
                      <button
                        onClick={() => {
                          addAuditEntry(`${d.status === 'active' ? 'Closed' : 'Reopened'} fund collection: "${d.title}"`, user?.name || '', 'Finance')
                          toggleDriveStatus(d.id)
                        }}
                        className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${d.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${d.status === 'active' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-2">
                    {amountLabel} · {lang === 'en' ? 'Target' : 'Sasaran'}: SGD {d.targetAmount.toLocaleString()} · {lang === 'en' ? 'Deadline' : 'Tarikh akhir'}: {d.deadline}
                  </div>

                  <div className="flex justify-between text-xs mb-1 text-gray-500">
                    <span className="text-emerald-700 font-medium">SGD {total.toLocaleString()} {lang === 'en' ? 'collected' : 'dikutip'}</span>
                    <span className="text-red-500">SGD {spent.toLocaleString()} {lang === 'en' ? 'spent' : 'dibelanjakan'}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 mb-3">
                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min((total / d.targetAmount) * 100, 100)}%` }} />
                  </div>

                  {/* Expense sheet button */}
                  <button
                    onClick={() => { setExpenseDrive(d); setExpForm(emptyExp()) }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-700 transition-colors">
                    <Receipt className="h-3.5 w-3.5" />
                    {lang === 'en' ? `Expense Sheet (${d.expenses.length})` : `Lembaran Perbelanjaan (${d.expenses.length})`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG (Super Admin only) ───────────────────────────────────── */}
      {tab === 'audit' && isSuperAdmin && (() => {
        const fmt = (iso: string) => {
          const d = new Date(iso)
          const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          return `${date}, ${time}`
        }
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                {lang === 'en' ? `Activity Log (${auditLog.length})` : `Log Aktiviti (${auditLog.length})`}
              </h3>
              <div className="relative">
                <button
                  onClick={() => setShowAuditExportMenu((v) => !v)}
                  title={lang === 'en' ? 'Export' : 'Eksport'}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-violet-500 hover:text-violet-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
                {showAuditExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAuditExportMenu(false)} />
                    <div className="absolute right-0 top-10 z-20 w-52 rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowAuditExportMenu(false); exportAuditExcel() }}
                      >
                        <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        {lang === 'en' ? 'Export to Excel' : 'Eksport ke Excel'}
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => { setShowAuditExportMenu(false); exportAuditCsv() }}
                      >
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                        {lang === 'en' ? 'Export to Google Sheets' : 'Eksport ke Google Sheets'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {auditLog.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                {lang === 'en' ? 'No activity recorded yet.' : 'Tiada aktiviti direkodkan.'}
              </div>
            ) : (() => {
              const catStyle: Record<string, string> = {
                Announcement: 'bg-orange-100 text-orange-700',
                Event:        'bg-blue-100 text-blue-700',
                Finance:      'bg-emerald-100 text-emerald-700',
                User:         'bg-violet-100 text-violet-700',
                Feedback:     'bg-amber-100 text-amber-700',
                Marketplace:  'bg-pink-100 text-pink-700',
              }
              return (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                  <table className="min-w-[640px] w-full border-collapse">
                    <thead>
                      <tr className="bg-[#2D1B5E]">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/80 uppercase tracking-wide whitespace-nowrap w-32">{lang === 'en' ? 'Category' : 'Kategori'}</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/80 uppercase tracking-wide">{lang === 'en' ? 'Activity' : 'Aktiviti'}</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/80 uppercase tracking-wide whitespace-nowrap">{lang === 'en' ? 'Initiated by' : 'Oleh'}</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/80 uppercase tracking-wide whitespace-nowrap">{lang === 'en' ? 'Date & Time' : 'Tarikh & Masa'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((entry, i) => (
                        <tr key={entry.id} className={`border-b border-gray-50 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                          <td className="px-4 py-3 align-top">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${catStyle[entry.category] ?? 'bg-gray-100 text-gray-600'}`}>
                              {entry.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 leading-snug align-top">{entry.activity}</td>
                          <td className="px-4 py-3 text-sm font-medium text-violet-700 whitespace-nowrap align-top">{entry.initiatedBy}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap align-top">{fmt(entry.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── EDIT DRIVE DIALOG ────────────────────────────────────────────── */}
      <Dialog open={!!editingDrive} onOpenChange={(open) => !open && setEditingDrive(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Edit Collection' : 'Edit Kutipan'}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Title' : 'Tajuk'}</label>
              <Input value={editDriveForm.title} onChange={(e) => setEditDriveForm((p) => ({ ...p, title: e.target.value }))} className="h-11" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Description' : 'Penerangan'}</label>
              <Textarea value={editDriveForm.description} onChange={(e) => setEditDriveForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="resize-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Amount Type' : 'Jenis Amaun'}</label>
              <div className="flex gap-2">
                {(['fixed', 'flexible'] as const).map((type) => (
                  <button key={type} type="button" onClick={() => setEditDriveForm((p) => ({ ...p, amountType: type }))}
                    className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${editDriveForm.amountType === type ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                    {type === 'fixed' ? (lang === 'en' ? 'Fixed' : 'Tetap') : (lang === 'en' ? 'Flexible' : 'Fleksibel')}
                  </button>
                ))}
              </div>
            </div>
            {editDriveForm.amountType === 'fixed' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Fixed Amount (SGD)' : 'Amaun Tetap (SGD)'}</label>
                <Input type="number" value={editDriveForm.fixedAmount} onChange={(e) => setEditDriveForm((p) => ({ ...p, fixedAmount: e.target.value }))} className="h-11" />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Minimum Amount (SGD)' : 'Amaun Minimum (SGD)'}</label>
                <Input type="number" value={editDriveForm.minimumAmount} onChange={(e) => setEditDriveForm((p) => ({ ...p, minimumAmount: e.target.value }))} className="h-11" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Target Amount (SGD)' : 'Amaun Sasaran (SGD)'}</label>
              <Input type="number" value={editDriveForm.targetAmount} onChange={(e) => setEditDriveForm((p) => ({ ...p, targetAmount: e.target.value }))} className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'PayNow Name' : 'Nama PayNow'}</label>
                <Input value={editDriveForm.payNowName} onChange={(e) => setEditDriveForm((p) => ({ ...p, payNowName: e.target.value }))} className="h-11" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'PayNow Number' : 'Nombor PayNow'}</label>
                <Input value={editDriveForm.payNowNumber} onChange={(e) => setEditDriveForm((p) => ({ ...p, payNowNumber: e.target.value }))} className="h-11" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Special Instructions' : 'Arahan Khas'}</label>
              <Textarea value={editDriveForm.specialInstructions} onChange={(e) => setEditDriveForm((p) => ({ ...p, specialInstructions: e.target.value }))} rows={3} className="resize-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Deadline' : 'Tarikh Akhir'}</label>
              <Input type="date" value={editDriveForm.deadline} onChange={(e) => setEditDriveForm((p) => ({ ...p, deadline: e.target.value }))} className="h-11" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-700">{lang === 'en' ? 'Head of Family only' : 'Ketua Keluarga sahaja'}</div>
              </div>
              <button type="button" onClick={() => setEditDriveForm((p) => ({ ...p, hofOnly: !p.hofOnly }))}
                className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${editDriveForm.hofOnly ? 'bg-amber-400' : 'bg-gray-200'}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${editDriveForm.hofOnly ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditingDrive(null)}>{lang === 'en' ? 'Cancel' : 'Batal'}</Button>
              <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={() => {
                if (!editingDrive) return
                updateDrive(editingDrive.id, {
                  title: editDriveForm.title,
                  description: editDriveForm.description,
                  amountType: editDriveForm.amountType,
                  fixedAmount: editDriveForm.amountType === 'fixed' ? Number(editDriveForm.fixedAmount) : undefined,
                  minimumAmount: editDriveForm.amountType === 'flexible' ? Number(editDriveForm.minimumAmount) : undefined,
                  targetAmount: Number(editDriveForm.targetAmount),
                  payNowName: editDriveForm.payNowName,
                  payNowNumber: editDriveForm.payNowNumber,
                  specialInstructions: editDriveForm.specialInstructions || undefined,
                  deadline: editDriveForm.deadline,
                  hofOnly: editDriveForm.hofOnly,
                })
                addAuditEntry(`Updated fund collection: "${editDriveForm.title}"`, user?.name || '', 'Finance')
                setEditingDrive(null)
              }}>
                {lang === 'en' ? 'Save Changes' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DRIVE CONTRIBUTIONS DIALOG ───────────────────────────────────── */}
      <Dialog open={!!selectedDrive} onOpenChange={(open) => { if (!open) { setSelectedDrive(null); setPaymentInput(null) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedDrive && (() => {
            const drive = drives.find((d) => d.id === selectedDrive.id) ?? selectedDrive
            const confirmed = drive.contributions.filter((c) => c.confirmed)
            const confirmedUserIds = new Set(confirmed.map((c) => c.userId))
            const notYet = users.filter((u) => !confirmedUserIds.has(u.id))
            const defaultAmount = drive.amountType === 'fixed' ? (drive.fixedAmount ?? 0) : (drive.minimumAmount ?? 0)

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="leading-snug">{drive.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-2">
                      <div className="text-lg font-bold text-emerald-700">{confirmed.length}</div>
                      <div className="text-xs text-gray-500">{lang === 'en' ? 'Contributed' : 'Telah Sumbang'}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-2">
                      <div className="text-lg font-bold text-gray-500">{notYet.length}</div>
                      <div className="text-xs text-gray-500">{lang === 'en' ? 'Yet to Contribute' : 'Belum Sumbang'}</div>
                    </div>
                  </div>

                  {/* Contributed */}
                  {confirmed.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {lang === 'en' ? 'Contributed' : 'Telah Menyumbang'}
                      </h4>
                      <div className="space-y-1.5">
                        {confirmed.map((c) => (
                          <div key={c.id} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{c.userName}</div>
                              <div className="text-xs text-gray-400">SGD {c.amount} · {c.paidAt}</div>
                            </div>
                            <button
                              onClick={() => {
                                addAuditEntry(`Removed contribution of ${c.userName} (SGD ${c.amount}) from "${drive.title}"`, user?.name || '', 'Finance')
                                removeContribution(drive.id, c.id)
                              }}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
                              title={lang === 'en' ? 'Undo' : 'Batal'}
                            >
                              <X className="h-3 w-3" />
                              {lang === 'en' ? 'Undo' : 'Batal'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Yet to contribute */}
                  {notYet.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {lang === 'en' ? 'Yet to Contribute' : 'Belum Menyumbang'}
                      </h4>
                      <div className="space-y-1.5">
                        {notYet.map((u) => (
                          <div key={u.id} className="rounded-xl bg-gray-50 px-3 py-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                                  {u.avatar}
                                </div>
                                <span className="text-sm text-gray-700">{u.name}</span>
                              </div>
                              {paymentInput?.userId === u.id ? (
                                <button
                                  onClick={() => setPaymentInput(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  {lang === 'en' ? 'Cancel' : 'Batal'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setPaymentInput({ userId: u.id, amount: defaultAmount > 0 ? String(defaultAmount) : '' })}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {lang === 'en' ? 'Payment Received' : 'Bayaran Diterima'}
                                </button>
                              )}
                            </div>
                            {paymentInput?.userId === u.id && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 shrink-0">SGD</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={paymentInput.amount}
                                  onChange={(e) => setPaymentInput({ userId: u.id, amount: e.target.value })}
                                  placeholder="0.00"
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (!paymentInput.amount) return
                                    addAuditEntry(`Recorded payment for ${u.name} (SGD ${paymentInput.amount}) in "${drive.title}"`, user?.name || '', 'Finance')
                                    recordContribution(drive.id, u.id, u.name, Number(paymentInput.amount), user?.id || '')
                                    setPaymentInput(null)
                                  }}
                                  className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
                                >
                                  {lang === 'en' ? 'Confirm' : 'Sahkan'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button variant="outline" className="w-full" onClick={() => setSelectedDrive(null)}>
                    {lang === 'en' ? 'Close' : 'Tutup'}
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ── MEMBER DETAIL DIALOG ──────────────────────────────────────────── */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) { setSelectedUser(null); setEditingUserProfile(false) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedUser && (() => {
            const relLabel = (v: string) => ({
              husband: lang === 'en' ? 'Husband' : 'Suami',
              wife: lang === 'en' ? 'Wife' : 'Isteri',
              son: lang === 'en' ? 'Son' : 'Anak Lelaki',
              daughter: lang === 'en' ? 'Daughter' : 'Anak Perempuan',
              grandfather: lang === 'en' ? 'Grandfather' : 'Datuk',
              grandmother: lang === 'en' ? 'Grandmother' : 'Nenek',
              'son-in-law': lang === 'en' ? 'Son-in-law' : 'Menantu Lelaki',
              'daughter-in-law': lang === 'en' ? 'Daughter-in-law' : 'Menantu Perempuan',
              'father-in-law': lang === 'en' ? 'Father-in-law' : 'Bapa Mertua',
              'mother-in-law': lang === 'en' ? 'Mother-in-law' : 'Ibu Mertua',
            }[v] ?? v)

            const relationships = ['husband','wife','son','daughter','grandfather','grandmother','son-in-law','daughter-in-law','father-in-law','mother-in-law']

            const saveEdit = () => {
              updateUserById(selectedUser.id, {
                name: editUserForm.name,
                email: editUserForm.email,
                phone: editUserForm.phone,
                dob: editUserForm.dob,
                address: editUserForm.address,
                familyMembers: editUserForm.familyMembers,
                avatar: editUserForm.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2),
              })
              addAuditEntry(`Updated profile of ${editUserForm.name}`, user?.name || '', 'User')
              setSelectedUser((prev) => prev ? { ...prev, ...editUserForm } : prev)
              setEditingUserProfile(false)
            }

            if (editingUserProfile) {
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{lang === 'en' ? 'Edit Profile' : 'Edit Profil'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{lang === 'en' ? 'Full Name' : 'Nama Penuh'}</label>
                      <Input value={editUserForm.name} onChange={(e) => setEditUserForm((f) => ({ ...f, name: e.target.value }))} className="h-10" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{lang === 'en' ? 'Email' : 'E-mel'}</label>
                      <Input type="email" value={editUserForm.email} onChange={(e) => setEditUserForm((f) => ({ ...f, email: e.target.value }))} className="h-10" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{lang === 'en' ? 'Date of Birth' : 'Tarikh Lahir'}</label>
                      <Input type="date" value={editUserForm.dob} onChange={(e) => setEditUserForm((f) => ({ ...f, dob: e.target.value }))} className="h-10" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{lang === 'en' ? 'Contact Number' : 'Nombor Telefon'}</label>
                      <Input value={editUserForm.phone} onChange={(e) => setEditUserForm((f) => ({ ...f, phone: e.target.value }))} className="h-10" />
                    </div>
                    {/* Family members */}
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-600">{lang === 'en' ? 'Family Members' : 'Ahli Keluarga'}</label>
                      <div className="space-y-1.5 mb-2">
                        {editUserForm.familyMembers.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                            <span className="flex-1 text-sm text-gray-800">{m.name}</span>
                            <select
                              value={m.relationship}
                              onChange={(e) => setEditUserForm((f) => ({ ...f, familyMembers: f.familyMembers.map((fm, j) => j === i ? { ...fm, relationship: e.target.value } : fm) }))}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
                            >
                              {relationships.map((r) => <option key={r} value={r}>{relLabel(r)}</option>)}
                            </select>
                            <button type="button" onClick={() => setEditUserForm((f) => ({ ...f, familyMembers: f.familyMembers.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input value={newFamName} onChange={(e) => setNewFamName(e.target.value)} placeholder={lang === 'en' ? 'Name' : 'Nama'} className="h-9 flex-1 text-sm" />
                        <select
                          value={newFamRel}
                          onChange={(e) => setNewFamRel(e.target.value)}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-600"
                        >
                          {relationships.map((r) => <option key={r} value={r}>{relLabel(r)}</option>)}
                        </select>
                        <Button type="button" size="sm" variant="outline" className="h-9 px-3"
                          onClick={() => { if (newFamName.trim()) { setEditUserForm((f) => ({ ...f, familyMembers: [...f.familyMembers, { name: newFamName.trim(), relationship: newFamRel }] })); setNewFamName('') } }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1" onClick={() => setEditingUserProfile(false)}>
                        {lang === 'en' ? 'Cancel' : 'Batal'}
                      </Button>
                      <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={saveEdit}>
                        {lang === 'en' ? 'Save Changes' : 'Simpan'}
                      </Button>
                    </div>
                  </div>
                </>
              )
            }

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{lang === 'en' ? 'Member Profile' : 'Profil Ahli'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {selectedUser.profilePhoto
                        ? <img src={selectedUser.profilePhoto} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xl font-bold text-emerald-800">{selectedUser.avatar}</span>
                      }
                    </div>
                    <div>
                      <div className="text-base font-bold text-gray-900">{selectedUser.name}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-xs ${roleColors[selectedUser.role]}`}>{roleLabel(selectedUser.role)}</Badge>
                        {selectedUser.isHeadOfFamily && (
                          <Badge className="text-xs bg-amber-100 text-amber-700">{lang === 'en' ? 'Head of Family' : 'Ketua Keluarga'}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {lang === 'en' ? 'Contact Details' : 'Maklumat Hubungi'}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{selectedUser.email}</span>
                    </div>
                    {selectedUser.phone ? (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{selectedUser.phone}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400 italic">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{lang === 'en' ? 'No contact number' : 'Tiada nombor telefon'}</span>
                      </div>
                    )}
                    {selectedUser.dob ? (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Cake className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{selectedUser.dob}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Family members */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {lang === 'en' ? 'Family Members' : 'Ahli Keluarga'}
                    </h4>
                    {selectedUser.familyMembers && selectedUser.familyMembers.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedUser.familyMembers.map((m, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <UserCircle className="h-4 w-4 text-gray-400 shrink-0" />
                              <span className="text-sm text-gray-800">{m.name}</span>
                            </div>
                            <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                              {relLabel(m.relationship)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        {lang === 'en' ? 'No family members listed.' : 'Tiada ahli keluarga disenaraikan.'}
                      </p>
                    )}
                  </div>

                  {/* Contribution stats — super admin only */}
                  {isSuperAdmin && (() => {
                    const scores = computeScores(users, drives)
                    const grandTotal = Object.values(scores).reduce((s, v) => s + v, 0)
                    const allEntries = drives.flatMap((d) => d.contributions.filter((c) => c.confirmed))
                    const avgPerContrib = allEntries.length > 0 ? grandTotal / allEntries.length : 0
                    const userAmount = scores[selectedUser.id] || 0
                    const pct = grandTotal > 0 ? (userAmount / grandTotal) * 100 : 0
                    const diffFromAvg = Math.round(userAmount - avgPerContrib)
                    return (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          {lang === 'en' ? 'Contribution Data' : 'Data Sumbangan'}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                            <div className="text-lg font-bold text-emerald-800">{pct.toFixed(1)}%</div>
                            <div className="text-xs text-emerald-600 mt-0.5">
                              {lang === 'en' ? 'of total collected' : 'drpd. jumlah dikutip'}
                            </div>
                          </div>
                          <div className={`rounded-xl px-3 py-2.5 ${
                            diffFromAvg >= 1 ? 'bg-blue-100 border border-blue-200' : diffFromAvg < 0 ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-200'
                          }`}>
                            <div className={`text-xs font-medium mb-1 ${diffFromAvg >= 1 ? 'text-blue-700' : diffFromAvg < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {lang === 'en' ? 'vs avg. contribution' : 'vs purata sumbangan'}
                            </div>
                            <div className={`text-lg font-bold ${diffFromAvg >= 1 ? 'text-blue-800' : diffFromAvg < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                              {diffFromAvg > 0 ? '+' : ''}{diffFromAvg < 0 ? '-' : ''}${Math.abs(diffFromAvg)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {isSuperAdmin && selectedUser.id !== user?.id ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditUserForm({
                            name: selectedUser.name,
                            email: selectedUser.email,
                            phone: selectedUser.phone || '',
                            dob: selectedUser.dob || '',
                            address: selectedUser.address || '',
                            familyMembers: selectedUser.familyMembers ? [...selectedUser.familyMembers] : [],
                          })
                          setNewFamName('')
                          setNewFamRel('husband')
                          setEditingUserProfile(true)
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {lang === 'en' ? 'Edit Profile' : 'Edit Profil'}
                      </Button>
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => setDeleteUserConfirmId(selectedUser.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {lang === 'en' ? 'Delete' : 'Padam'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => setSelectedUser(null)}>
                      {lang === 'en' ? 'Close' : 'Tutup'}
                    </Button>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ── DELETE USER CONFIRM DIALOG ────────────────────────────────────── */}
      <Dialog open={!!deleteUserConfirmId} onOpenChange={(open) => !open && setDeleteUserConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{lang === 'en' ? 'Delete User?' : 'Padam Pengguna?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 pt-1">
            {lang === 'en'
              ? 'This will permanently remove the member and all their data. This action cannot be undone.'
              : 'Ini akan memadamkan ahli dan semua data mereka secara kekal. Tindakan ini tidak boleh dibatalkan.'}
          </p>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteUserConfirmId(null)}>
              {lang === 'en' ? 'Cancel' : 'Batal'}
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                const target = users.find((u) => u.id === deleteUserConfirmId)
                addAuditEntry(`Deleted user: ${target?.name || deleteUserConfirmId}`, user?.name || '', 'User')
                deleteUser(deleteUserConfirmId!)
                setDeleteUserConfirmId(null)
                setSelectedUser(null)
              }}
            >
              {lang === 'en' ? 'Delete' : 'Padam'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CREATE ANNOUNCEMENT DIALOG ────────────────────────────────────── */}
      <Dialog open={showCreateAnn} onOpenChange={(open) => { if (!open) { setShowCreateAnn(false); setAnnPosted(false) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Post New Announcement' : 'Hantar Pengumuman Baru'}</DialogTitle></DialogHeader>
          <form onSubmit={handlePostAnn} className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <Input value={annForm.title} onChange={(e) => setAnnForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={lang === 'en' ? 'Title' : 'Tajuk'} className="h-11 flex-1" required />
              <button type="button" onClick={() => setAnnForm((p) => ({ ...p, isPinned: !p.isPinned }))}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${annForm.isPinned ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-400'}`}>
                {annForm.isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            </div>
            <RichTextEditor content={annForm.htmlContent}
              onChange={(html) => setAnnForm((p) => ({ ...p, htmlContent: html, content: html.replace(/<[^>]+>/g, ' ').trim() }))}
              placeholder={lang === 'en' ? 'Write your announcement...' : 'Tulis pengumuman anda...'} />
            {annPosted && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4" />{lang === 'en' ? 'Published!' : 'Diterbitkan!'}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateAnn(false)}>
                {lang === 'en' ? 'Cancel' : 'Batal'}
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">
                {lang === 'en' ? 'Publish' : 'Terbitkan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT ANNOUNCEMENT DIALOG ───────────────────────────────────────── */}
      <Dialog open={!!editingAnn} onOpenChange={(open) => !open && setEditingAnn(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Edit Announcement' : 'Edit Pengumuman'}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Input value={editAnnForm.title} onChange={(e) => setEditAnnForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={lang === 'en' ? 'Title' : 'Tajuk'} className="h-11 flex-1" />
              <button type="button" onClick={() => setEditAnnForm((p) => ({ ...p, isPinned: !p.isPinned }))}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${editAnnForm.isPinned ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-400'}`}>
                {editAnnForm.isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            </div>
            <RichTextEditor content={editAnnForm.htmlContent}
              onChange={(html) => setEditAnnForm((p) => ({ ...p, htmlContent: html, content: html.replace(/<[^>]+>/g, ' ').trim() }))} />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingAnn(null)}>{lang === 'en' ? 'Cancel' : 'Batal'}</Button>
              <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={saveEditAnn}>{lang === 'en' ? 'Save Changes' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE ANNOUNCEMENT DIALOG ─────────────────────────────────────── */}
      <Dialog open={!!deleteAnnId} onOpenChange={(open) => !open && setDeleteAnnId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Delete Announcement?' : 'Padam Pengumuman?'}</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 pt-1">{lang === 'en' ? 'This action cannot be undone.' : 'Tindakan ini tidak boleh dibatalkan.'}</p>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteAnnId(null)}>{lang === 'en' ? 'Cancel' : 'Batal'}</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              const ann = announcements.find((a) => a.id === deleteAnnId)
              addAuditEntry(`Deleted announcement: "${ann?.title || deleteAnnId}"`, user?.name || '', 'Announcement')
              deleteAnnouncement(deleteAnnId!); setDeleteAnnId(null)
            }}>{lang === 'en' ? 'Delete' : 'Padam'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── EDIT EVENT DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={!!editingEv} onOpenChange={(open) => !open && setEditingEv(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Edit Event' : 'Edit Acara'}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input value={editEvForm.title} onChange={(e) => setEditEvForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={lang === 'en' ? 'Event title' : 'Tajuk acara'} className="h-11" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Date' : 'Tarikh'}</label>
                <Input type="date" value={editEvForm.date} onChange={(e) => setEditEvForm((p) => ({ ...p, date: e.target.value }))} className="h-11" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Time' : 'Masa'}</label>
                <Input type="time" value={editEvForm.time} onChange={(e) => setEditEvForm((p) => ({ ...p, time: e.target.value }))} className="h-11" />
              </div>
            </div>
            <Input value={editEvForm.location} onChange={(e) => setEditEvForm((p) => ({ ...p, location: e.target.value }))}
              placeholder={lang === 'en' ? 'Location' : 'Lokasi'} className="h-11" />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Details' : 'Butiran'}</label>
              <RichTextEditor content={editEvForm.htmlContent}
                onChange={(html) => setEditEvForm((p) => ({ ...p, htmlContent: html, description: html.replace(/<[^>]+>/g, ' ').trim() }))} />
            </div>
            <MediaGrid form={editEvForm} setForm={setEditEvForm} />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingEv(null)}>{lang === 'en' ? 'Cancel' : 'Batal'}</Button>
              <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={saveEditEv}>{lang === 'en' ? 'Save Changes' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CREATE EVENT DIALOG ──────────────────────────────────────────── */}
      <Dialog open={showCreateEv} onOpenChange={(open) => { if (!open) { setShowCreateEv(false); setEvPosted(false) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Create New Event' : 'Buat Acara Baru'}</DialogTitle></DialogHeader>
          <form onSubmit={handlePostEv} className="space-y-3 pt-1">
            <Input value={evForm.title} onChange={(e) => setEvForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={lang === 'en' ? 'Event title' : 'Tajuk acara'} className="h-11" required />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Date' : 'Tarikh'} *</label>
                <Input type="date" value={evForm.date} onChange={(e) => setEvForm((p) => ({ ...p, date: e.target.value }))} className="h-11" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Time' : 'Masa'}</label>
                <Input type="time" value={evForm.time} onChange={(e) => setEvForm((p) => ({ ...p, time: e.target.value }))} className="h-11" />
              </div>
            </div>
            <Input value={evForm.location} onChange={(e) => setEvForm((p) => ({ ...p, location: e.target.value }))}
              placeholder={lang === 'en' ? 'Location' : 'Lokasi'} className="h-11" />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Details' : 'Butiran'}</label>
              <RichTextEditor content={evForm.htmlContent}
                onChange={(html) => setEvForm((p) => ({ ...p, htmlContent: html, description: html.replace(/<[^>]+>/g, ' ').trim() }))}
                placeholder={lang === 'en' ? 'Describe the event...' : 'Huraikan acara...'} />
            </div>
            <MediaGrid form={evForm} setForm={setEvForm} />
            {evPosted && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4" />{lang === 'en' ? 'Event created!' : 'Acara dibuat!'}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateEv(false)}>
                {lang === 'en' ? 'Cancel' : 'Batal'}
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">
                <Plus className="h-4 w-4 mr-1" />{lang === 'en' ? 'Create Event' : 'Buat Acara'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CREATE COLLECTION DIALOG ─────────────────────────────────────── */}
      <Dialog open={showCreateDrive} onOpenChange={(open) => { if (!open) { setShowCreateDrive(false); setDrivePosted(false) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === 'en' ? 'Create New Collection' : 'Buat Kutipan Baru'}</DialogTitle></DialogHeader>
          <form onSubmit={handlePostDrive} className="space-y-3 pt-1">
            <Input value={driveForm.title} onChange={(e) => setDriveForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={lang === 'en' ? 'Name of Collection' : 'Nama Kutipan'} className="h-11" required />
            <Textarea value={driveForm.description} onChange={(e) => setDriveForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={lang === 'en' ? 'What is this collection for?' : 'Apakah tujuan kutipan ini?'} rows={2} />

            {/* Amount type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Contribution Amount' : 'Jumlah Sumbangan'}</label>
              <div className="flex gap-2 mb-3">
                {(['fixed', 'flexible'] as const).map((type) => (
                  <button key={type} type="button"
                    onClick={() => setDriveForm((p) => ({ ...p, amountType: type }))}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${driveForm.amountType === type ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {type === 'fixed' ? (lang === 'en' ? 'Fixed Amount' : 'Amaun Tetap') : (lang === 'en' ? 'Flexible (Min.)' : 'Fleksibel (Min.)')}
                  </button>
                ))}
              </div>
              {driveForm.amountType === 'fixed' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Fixed amount per member (SGD)' : 'Amaun tetap setiap ahli (SGD)'}</label>
                  <Input type="number" min="1" value={driveForm.fixedAmount}
                    onChange={(e) => setDriveForm((p) => ({ ...p, fixedAmount: e.target.value }))}
                    placeholder="e.g. 50" className="h-11" required />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">{lang === 'en' ? 'Minimum amount per member (SGD)' : 'Amaun minimum setiap ahli (SGD)'}</label>
                  <Input type="number" min="1" value={driveForm.minimumAmount}
                    onChange={(e) => setDriveForm((p) => ({ ...p, minimumAmount: e.target.value }))}
                    placeholder="e.g. 20" className="h-11" required />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Target Amount (SGD)' : 'Sasaran Kutipan (SGD)'}</label>
              <Input type="number" min="1" value={driveForm.targetAmount}
                onChange={(e) => setDriveForm((p) => ({ ...p, targetAmount: e.target.value }))}
                placeholder="e.g. 5000" className="h-11" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">PayNow {lang === 'en' ? 'Name' : 'Nama'}</label>
                <Input value={driveForm.payNowName} onChange={(e) => setDriveForm((p) => ({ ...p, payNowName: e.target.value }))}
                  placeholder="KBMI Fund" className="h-11" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">PayNow {lang === 'en' ? 'Number' : 'Nombor'}</label>
                <Input value={driveForm.payNowNumber} onChange={(e) => setDriveForm((p) => ({ ...p, payNowNumber: e.target.value }))}
                  placeholder="9123 4567" className="h-11" required />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === 'en' ? 'Special Instructions' : 'Arahan Khas'}
              </label>
              <Textarea
                value={driveForm.specialInstructions}
                onChange={(e) => setDriveForm((p) => ({ ...p, specialInstructions: e.target.value }))}
                placeholder={lang === 'en' ? 'e.g. Payment reference, bank transfer steps, notes for payees...' : 'cth. Rujukan bayaran, langkah pindahan bank, nota untuk pembayar...'}
                rows={3}
                className="resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === 'en' ? 'Deadline' : 'Tarikh Akhir'}</label>
              <Input type="date" value={driveForm.deadline} onChange={(e) => setDriveForm((p) => ({ ...p, deadline: e.target.value }))}
                className="h-11" required />
            </div>

            {/* HoF only toggle */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-700">{lang === 'en' ? 'Head of Family only' : 'Ketua Keluarga sahaja'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{lang === 'en' ? 'Visible only to designated Heads of Family' : 'Hanya kelihatan kepada Ketua Keluarga'}</div>
              </div>
              <button type="button" onClick={() => setDriveForm((p) => ({ ...p, hofOnly: !p.hofOnly }))}
                className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${driveForm.hofOnly ? 'bg-amber-400' : 'bg-gray-200'}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${driveForm.hofOnly ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {drivePosted && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4" />{lang === 'en' ? 'Collection created!' : 'Kutipan dibuat!'}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateDrive(false)}>
                {lang === 'en' ? 'Cancel' : 'Batal'}
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">
                <Plus className="h-4 w-4 mr-1" />{lang === 'en' ? 'Launch Collection' : 'Lancarkan Kutipan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EXPENSE SHEET DIALOG ──────────────────────────────────────────── */}
      <Dialog open={!!expenseDrive} onOpenChange={(open) => !open && setExpenseDrive(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {lang === 'en' ? 'Expense Sheet' : 'Lembaran Perbelanjaan'}
              {expenseDrive && <span className="block text-xs font-normal text-gray-500 mt-0.5">{expenseDrive.title}</span>}
            </DialogTitle>
          </DialogHeader>

          {expenseDrive && (() => {
            const liveD = drives.find((d) => d.id === expenseDrive.id) || expenseDrive
            const totalEx = liveD.expenses.reduce((s, e) => s + e.amount, 0)
            return (
              <div className="space-y-4 pt-1">
                {/* Summary */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-red-50 p-3 text-center">
                    <div className="text-lg font-bold text-red-600">SGD {totalEx.toLocaleString()}</div>
                    <div className="text-xs text-red-400">{lang === 'en' ? 'Total Spent' : 'Jumlah Dibelanjakan'}</div>
                  </div>
                  <div className="flex-1 rounded-xl bg-gray-50 p-3 text-center">
                    <div className="text-lg font-bold text-gray-700">{liveD.expenses.length}</div>
                    <div className="text-xs text-gray-400">{lang === 'en' ? 'Entries' : 'Rekod'}</div>
                  </div>
                </div>

                {/* Expense list */}
                {liveD.expenses.length > 0 && (
                  <div className="space-y-2">
                    {liveD.expenses.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800">{e.description}</div>
                          <div className="text-xs text-gray-400">{e.date} · {expCatLabel(e.category)}</div>
                        </div>
                        <span className="text-sm font-bold text-red-600 shrink-0">SGD {e.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {liveD.expenses.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-3">
                    {lang === 'en' ? 'No expenses recorded yet.' : 'Tiada perbelanjaan direkodkan.'}
                  </p>
                )}

                {/* Add expense form */}
                <div className="border-t border-gray-100 pt-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    {lang === 'en' ? 'Add Expense' : 'Tambah Perbelanjaan'}
                  </h4>
                  <form onSubmit={handleAddExpense} className="space-y-2">
                    <Input value={expForm.description}
                      onChange={(e) => setExpForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder={lang === 'en' ? 'Description' : 'Penerangan'} className="h-10" required />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="1" value={expForm.amount}
                        onChange={(e) => setExpForm((p) => ({ ...p, amount: e.target.value }))}
                        placeholder={lang === 'en' ? 'Amount (SGD)' : 'Amaun (SGD)'} className="h-10" required />
                      <Input type="date" value={expForm.date}
                        onChange={(e) => setExpForm((p) => ({ ...p, date: e.target.value }))} className="h-10" />
                    </div>
                    <select value={expForm.category}
                      onChange={(e) => setExpForm((p) => ({ ...p, category: e.target.value as Expense['category'] }))}
                      className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="event">{lang === 'en' ? 'Event' : 'Acara'}</option>
                      <option value="admin">{lang === 'en' ? 'Admin' : 'Pentadbiran'}</option>
                      <option value="charity">{lang === 'en' ? 'Charity' : 'Kebajikan'}</option>
                      <option value="other">{lang === 'en' ? 'Other' : 'Lain-lain'}</option>
                    </select>
                    <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white h-10">
                      <Plus className="h-4 w-4 mr-1" />{lang === 'en' ? 'Add Expense' : 'Tambah Perbelanjaan'}
                    </Button>
                  </form>
                </div>

                <Button variant="outline" className="w-full" onClick={() => setExpenseDrive(null)}>
                  {lang === 'en' ? 'Close' : 'Tutup'}
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
