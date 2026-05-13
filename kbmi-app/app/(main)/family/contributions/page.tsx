'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Copy, CheckCircle, Clock, Crown } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { computeScores } from '@/lib/mock-data'
import { useData } from '@/lib/data-context'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function ContributionsPage() {
  const { tr, lang } = useLang()
  const { user } = useAuth()
  const { drives, users } = useData()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'drives' | 'leaderboard'>('drives')

  const myUser = users.find((u) => u.id === user?.id)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  // HoF-only collections are hidden from regular members who aren't Head of Family
  const visibleDrives = drives.filter(
    (d) => !d.hofOnly || myUser?.isHeadOfFamily || isAdmin
  )

  const scores = computeScores(users, drives)
  const ranked = [...users].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
  const grandTotal = Object.values(scores).reduce((s, v) => s + v, 0)
  const pct = (userId: string) =>
    grandTotal > 0 ? ((scores[userId] || 0) / grandTotal) * 100 : 0
  const fmtPct = (userId: string) => `${pct(userId).toFixed(1)}%`
  const myAmount = scores[user?.id || ''] || 0
  const allEntries = drives.flatMap((d) => d.contributions.filter((c) => c.confirmed))
  const avgPerContrib = allEntries.length > 0 ? grandTotal / allEntries.length : 0
  const diffFromAvg = Math.round(myAmount - avgPerContrib)

  const activeDrive = visibleDrives.find((d) => d.status === 'active')
  const closedDrives = visibleDrives.filter((d) => d.status === 'closed')

  const copyPayNow = () => {
    if (activeDrive) {
      navigator.clipboard.writeText(activeDrive.payNowNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const totalCollected = activeDrive
    ? activeDrive.contributions.filter((c) => c.confirmed).reduce((s, c) => s + c.amount, 0)
    : 0

  const myContribution = activeDrive?.contributions.find((c) => c.userId === user?.id)

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

  return (
    <div className="space-y-4">
      <div className="relative bg-[#2D1B5E] -mx-4 px-6 pt-6 pb-8 rounded-b-3xl overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/family" className="text-white/70 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-white">{tr.contributions}</h2>
            <p className="text-sm text-violet-300 mt-0.5">
              {lang === 'en' ? 'Fund drives & leaderboard' : 'Kutipan dana & kedudukan'}
            </p>
          </div>
        </div>
      </div>

      {/* My score card */}
      <div className="rounded-2xl bg-emerald-700 p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm opacity-80">{tr.contributionScore}</div>
          <Trophy className="h-8 w-8 opacity-20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 px-3 py-2.5">
            <div className="text-2xl font-bold">{fmtPct(user?.id || '')}</div>
            <div className="text-xs opacity-75 mt-0.5">
              {lang === 'en' ? 'of total collected' : 'drpd. jumlah dikutip'}
            </div>
          </div>
          <div className={`rounded-xl px-3 py-2.5 ${
            diffFromAvg >= 1
              ? 'bg-blue-200 text-blue-900'
              : diffFromAvg < 0
              ? 'bg-red-100 text-red-900'
              : 'bg-white text-gray-700'
          }`}>
            <div className="text-xs font-medium mb-1 opacity-80">
              {lang === 'en' ? 'You have contributed' : 'Anda telah menyumbang'}
            </div>
            <div className="text-2xl font-bold">
              {diffFromAvg > 0 ? '+' : ''}{diffFromAvg < 0 ? '-' : ''}${Math.abs(diffFromAvg)}
            </div>
            <div className="text-xs mt-0.5 opacity-75">
              {lang === 'en'
                ? diffFromAvg >= 1 ? 'more than avg. contribution' : diffFromAvg < 0 ? 'less than avg. contribution' : 'equal to avg. contribution'
                : diffFromAvg >= 1 ? 'lebih drpd. purata' : diffFromAvg < 0 ? 'kurang drpd. purata' : 'sama dgn. purata'}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs opacity-75 leading-relaxed italic">
          {lang === 'en'
            ? 'On behalf of the KBMI family, we thank you for your contributions. May Allah reward your generosity with more wealth and blessings for you and your family.'
            : 'Bagi pihak keluarga KBMI, kami mengucapkan terima kasih atas sumbangan anda. Semoga Allah membalas kemuliaan hati anda dengan lebih banyak rezeki dan keberkatan untuk anda dan keluarga.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
        {(['drives', 'leaderboard'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-[#2D1B5E] text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {tab === 'drives'
              ? (lang === 'en' ? 'Fund Collection' : 'Kutipan Dana')
              : tr.leaderboard}
          </button>
        ))}
      </div>

      {activeTab === 'drives' && (
        <div className="space-y-3">
          {/* Active drive */}
          {activeDrive && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                  {lang === 'en' ? 'Active' : 'Aktif'}
                </Badge>
                <span className="text-sm font-semibold text-gray-900">{activeDrive.title}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{activeDrive.description}</p>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>SGD {totalCollected} {lang === 'en' ? 'collected' : 'dikutip'}</span>
                  <span>{lang === 'en' ? 'Target' : 'Sasaran'}: SGD {activeDrive.targetAmount}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min((totalCollected / activeDrive.targetAmount) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Deadline */}
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                <Clock className="h-3 w-3" />
                <span>{lang === 'en' ? 'Deadline' : 'Tarikh Akhir'}: {activeDrive.deadline}</span>
              </div>

              {/* My status */}
              {myContribution ? (
                <div className={`flex items-center gap-2 rounded-lg p-2 text-sm ${myContribution.confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {myContribution.confirmed
                    ? <><CheckCircle className="h-4 w-4" />{lang === 'en' ? 'Your payment confirmed – SGD ' + myContribution.amount : 'Bayaran anda disahkan – SGD ' + myContribution.amount}</>
                    : <><Clock className="h-4 w-4" />{lang === 'en' ? 'Payment pending confirmation' : 'Bayaran menunggu pengesahan'}</>
                  }
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-700 mb-1">{tr.payNow}</div>
                  <div className="text-xs text-emerald-700 font-medium mb-2">
                    {activeDrive.amountType === 'fixed'
                      ? (lang === 'en' ? `Amount: SGD ${activeDrive.fixedAmount} (fixed)` : `Jumlah: SGD ${activeDrive.fixedAmount} (tetap)`)
                      : (lang === 'en' ? `Minimum: SGD ${activeDrive.minimumAmount}` : `Minimum: SGD ${activeDrive.minimumAmount}`)}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">{lang === 'en' ? 'PayNow to' : 'PayNow kepada'}</div>
                      <div className="text-base font-bold text-emerald-700">{activeDrive.payNowNumber}</div>
                      <div className="text-xs text-gray-400">{activeDrive.payNowName}</div>
                    </div>
                    <button
                      onClick={copyPayNow}
                      className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white hover:bg-emerald-800 transition-colors"
                    >
                      {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? (lang === 'en' ? 'Copied!' : 'Disalin!') : (lang === 'en' ? 'Copy' : 'Salin')}
                    </button>
                  </div>
                  {activeDrive.specialInstructions && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">
                        {lang === 'en' ? 'Special Instructions' : 'Arahan Khas'}
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">
                        {activeDrive.specialInstructions}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {lang === 'en'
                      ? 'After payment, your admin will confirm your contribution.'
                      : 'Selepas bayaran, admin anda akan mengesahkan sumbangan anda.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Closed drives */}
          {closedDrives.map((drive) => (
            <div key={drive.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 opacity-70">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-gray-100 text-gray-500 text-xs">
                  {lang === 'en' ? 'Closed' : 'Ditutup'}
                </Badge>
                <span className="text-sm font-semibold text-gray-700">{drive.title}</span>
              </div>
              <p className="text-xs text-gray-400">
                {lang === 'en' ? 'Total raised' : 'Jumlah dikutip'}: SGD{' '}
                {drive.contributions.filter((c) => c.confirmed).reduce((s, c) => s + c.amount, 0)}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="space-y-2">
          {ranked.map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center gap-3 rounded-2xl p-3 ${u.id === user?.id ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-gray-100'} shadow-sm`}
            >
              <div className="w-8 text-center">
                {i < 3
                  ? <span className={`text-lg ${medalColors[i]}`}>{['🥇','🥈','🥉'][i]}</span>
                  : <span className="text-sm font-bold text-gray-400">#{i + 1}</span>}
              </div>
              <div className="relative">
                <Avatar className="h-9 w-9 bg-emerald-100">
                  <AvatarFallback className="text-xs font-semibold text-emerald-800">{u.avatar}</AvatarFallback>
                </Avatar>
                {u.isHeadOfFamily && (
                  <Crown className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-900 truncate">{u.name}</span>
                  {u.isHeadOfFamily && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-700 shrink-0">
                      {lang === 'en' ? 'HoF' : 'KK'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
