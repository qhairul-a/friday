'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { ReadingSession, ScreentimeSession } from '@/types'

interface Props {
  readingSessions: ReadingSession[]
  screentimeSessions: ScreentimeSession[]
}

function startOfWeek(d: Date) {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - day.getDay()) // Sunday
  return day
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function buildWeeklyReadingData(sessions: ReadingSession[]) {
  const week = startOfWeek(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week)
    d.setDate(d.getDate() + i)
    return isoDate(d)
  })

  const data = days.map(day => {
    const label = new Date(day).toLocaleDateString('en-MY', { weekday: 'short' })
    const qasim = sessions
      .filter(s => s.child_name === 'qasim' && isoDate(new Date(s.started_at)) === day)
      .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
    const muadz = sessions
      .filter(s => s.child_name === 'muadz' && isoDate(new Date(s.started_at)) === day)
      .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
    return { day: label, Qasim: qasim, Muadz: muadz }
  })
  return data
}

function buildUtilizationData(readingSessions: ReadingSession[], screentimeSessions: ScreentimeSession[]) {
  const now = new Date()
  return Array.from({ length: 4 }, (_, i) => {
    const weekEnd = new Date(startOfWeek(now))
    weekEnd.setDate(weekEnd.getDate() - i * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 7)
    const label = `W-${i === 0 ? 'this' : i}`
    const earned = readingSessions
      .filter(s => {
        const d = new Date(s.started_at)
        return d >= weekStart && d < weekEnd
      })
      .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
    const used = screentimeSessions
      .filter(s => {
        const d = new Date(s.started_at)
        return d >= weekStart && d < weekEnd
      })
      .reduce((sum, s) => sum + (s.duration_used_minutes ?? 0), 0)
    const pct = earned === 0 ? 0 : Math.round((used / earned) * 100)
    return { week: label, 'Utilization %': pct }
  }).reverse()
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col gap-1">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  )
}

export function AnalyticsView({ readingSessions, screentimeSessions }: Props) {
  const totalEarned = readingSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
  const totalUsed = screentimeSessions.reduce((sum, s) => sum + (s.duration_used_minutes ?? 0), 0)
  const utilization = totalEarned === 0 ? '—' : `${((totalUsed / totalEarned) * 100).toFixed(1)}%`

  const weekStart = startOfWeek(new Date())
  const weekReadingSessions = readingSessions.filter(s => new Date(s.started_at) >= weekStart)
  const weekTotal = weekReadingSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
  const weekH = Math.floor(weekTotal / 60)
  const weekM = weekTotal % 60

  const qasimWeek = weekReadingSessions.filter(s => s.child_name === 'qasim')
  const muadzWeek = weekReadingSessions.filter(s => s.child_name === 'muadz')

  // Count distinct days in the week with sessions (max 7)
  const qasimDays = new Set(qasimWeek.map(s => isoDate(new Date(s.started_at)))).size || 1
  const muadzDays = new Set(muadzWeek.map(s => isoDate(new Date(s.started_at)))).size || 1
  const qasimAvg = Math.round(qasimWeek.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / qasimDays)
  const muadzAvg = Math.round(muadzWeek.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / muadzDays)

  const weeklyData = buildWeeklyReadingData(readingSessions)
  const utilData = buildUtilizationData(readingSessions, screentimeSessions)

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Utilization" value={utilization} />
        <StatCard label="Reading this week" value={weekTotal === 0 ? '0m' : weekH > 0 ? `${weekH}h ${weekM}m` : `${weekM}m`} />
        <StatCard label="Qasim avg/day" value={`${qasimAvg}m`} />
        <StatCard label="Muadz avg/day" value={`${muadzAvg}m`} />
      </div>

      {/* Reading minutes this week */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-slate-300 font-semibold mb-4">Daily reading minutes — this week</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />
            <Bar dataKey="Qasim" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Muadz" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Utilization % per week */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-slate-300 font-semibold mb-4">Screen time usage % (last 4 weeks)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={utilData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => `${v}%`}
            />
            <Bar dataKey="Utilization %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
