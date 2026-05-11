'use client'

import {
  BarChart, Bar, LabelList, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { MarketplaceListing, Announcement, Event, Poll, ContributionDrive } from '@/lib/mock-data'

interface Props {
  lang: string
  announcements: Announcement[]
  events: Event[]
  listings: MarketplaceListing[]
  polls: Poll[]
  drives: ContributionDrive[]
}

function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      ym: d.toISOString().slice(0, 7),
    }
  })
}

export default function DashboardCharts({ lang, announcements, events, listings, polls, drives }: Props) {
  const months6 = getLast6Months()

  // ── Real monthly data ────────────────────────────────────────────────────────
  const sections = [
    {
      key: lang === 'en' ? 'Bulletin' : 'Buletin',
      color: '#f97316',
      data: months6.map(m => ({
        month: m.label,
        count: announcements.filter(a => a.createdAt?.startsWith(m.ym)).length,
      })),
    },
    {
      key: lang === 'en' ? 'Events' : 'Acara',
      color: '#ef4444',
      data: months6.map(m => ({
        month: m.label,
        count: events.filter(e => e.date?.startsWith(m.ym)).length,
      })),
    },
    {
      key: lang === 'en' ? 'Marketplace' : 'Pasaran',
      color: '#8b5cf6',
      data: months6.map(m => ({
        month: m.label,
        count: listings.filter(l => l.createdAt?.startsWith(m.ym)).length,
      })),
    },
    {
      key: lang === 'en' ? 'Polls' : 'Undian',
      color: '#6366f1',
      data: months6.map(m => ({
        month: m.label,
        count: polls.filter(p => p.createdAt?.startsWith(m.ym)).length,
      })),
    },
  ]

  // ── Marketplace distribution ─────────────────────────────────────────────────
  const forSale  = listings.filter(l => l.category === 'sale').length
  const service  = listings.filter(l => l.category === 'service').length
  const request  = listings.filter(l => l.category === 'request').length
  const totalListings = forSale + service + request

  const pieData = [
    { name: lang === 'en' ? 'For Sale' : 'Jualan', value: forSale,  color: '#10b981' },
    { name: lang === 'en' ? 'Service'  : 'Servis',  value: service, color: '#3b82f6' },
    { name: lang === 'en' ? 'Request'  : 'Permintaan', value: request, color: '#f59e0b' },
  ]

  // ── Marketplace listings by type per month ───────────────────────────────────
  const listingData = months6.map(m => ({
    month: m.label,
    [lang === 'en' ? 'For Sale' : 'Jualan']:    listings.filter(l => l.category === 'sale'    && l.createdAt?.startsWith(m.ym)).length,
    [lang === 'en' ? 'Service'  : 'Servis']:    listings.filter(l => l.category === 'service' && l.createdAt?.startsWith(m.ym)).length,
    [lang === 'en' ? 'Request'  : 'Permintaan']:listings.filter(l => l.category === 'request' && l.createdAt?.startsWith(m.ym)).length,
  }))

  // ── Contribution drives: collected vs target ──────────────────────────────────
  const driveData = drives.slice(0, 5).map(d => ({
    name: d.title.length > 18 ? d.title.slice(0, 18) + '…' : d.title,
    [lang === 'en' ? 'Collected' : 'Terkumpul']: d.contributions.filter(c => c.confirmed).reduce((s, c) => s + c.amount, 0),
    [lang === 'en' ? 'Target' : 'Sasaran']: d.targetAmount,
  }))

  const forSaleKey  = lang === 'en' ? 'For Sale' : 'Jualan'
  const serviceKey  = lang === 'en' ? 'Service'  : 'Servis'
  const requestKey  = lang === 'en' ? 'Request'  : 'Permintaan'
  const collectedKey = lang === 'en' ? 'Collected' : 'Terkumpul'
  const targetKey    = lang === 'en' ? 'Target'    : 'Sasaran'

  return (
    <div className="space-y-8">

      {/* ── Hub activity — one mini chart per section ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          {lang === 'en' ? 'KBMI Hub — Posts Created by Section (last 6 months)' : 'KBMI Hub — Catatan Dicipta Mengikut Seksyen (6 bulan lepas)'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {sections.map(({ key, color, data }) => (
            <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold mb-2" style={{ color }}>{key}</p>
              {data.every(d => d.count === 0) ? (
                <p className="text-[10px] text-gray-400 py-8 text-center">{lang === 'en' ? 'No data yet' : 'Tiada data'}</p>
              ) : (
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={data} barSize={10} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 6, padding: '4px 8px' }}
                      formatter={(v) => [v, lang === 'en' ? 'Posts' : 'Catatan']}
                    />
                    <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 8, fill: '#6b7280', fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Marketplace distribution pie ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {lang === 'en' ? 'Marketplace Distribution %' : 'Agihan Pasaran %'}
        </p>
        {totalListings === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{lang === 'en' ? 'No listings yet' : 'Tiada senarai lagi'}</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={40} outerRadius={68}
                  dataKey="value" paddingAngle={3}
                >
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v, name) => [`${((Number(v) / totalListings) * 100).toFixed(1)}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {pieData.map(({ name, value, color }) => {
                const pct = totalListings > 0 ? ((value / totalListings) * 100).toFixed(1) : '0.0'
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-medium text-gray-700">
                        <span>{name}</span><span>{pct}%</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Marketplace listings by type per month ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {lang === 'en' ? 'Marketplace Listings by Type' : 'Senarai Pasaran Mengikut Jenis'}
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={listingData} barSize={12} barCategoryGap="30%" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey={forSaleKey} fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey={serviceKey}  fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey={requestKey}  fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-center">
          {[
            [forSaleKey, '#10b981'],
            [serviceKey, '#3b82f6'],
            [requestKey, '#f59e0b'],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Contribution drives: collected vs target ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {lang === 'en' ? 'Contribution Drives — Collected vs Target (SGD)' : 'Kutipan Dana — Terkumpul vs Sasaran (SGD)'}
        </p>
        {driveData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{lang === 'en' ? 'No drives yet' : 'Tiada kutipan dana lagi'}</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={driveData} barCategoryGap="30%" margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`SGD ${v}`, '']} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey={collectedKey} fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey={targetKey}    fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
