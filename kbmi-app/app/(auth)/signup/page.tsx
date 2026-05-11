'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useLang } from '@/lib/language-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SignupPage() {
  const { signup } = useAuth()
  const { tr, lang, setLang } = useLang()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(lang === 'en' ? 'Passwords do not match.' : 'Kata laluan tidak sepadan.')
      return
    }
    if (password.length < 6) {
      setError(lang === 'en' ? 'Password must be at least 6 characters.' : 'Kata laluan mestilah sekurang-kurangnya 6 aksara.')
      return
    }
    setLoading(true)
    const result = await signup(name, email, password, dob, phone)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setEmailSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#2D1B5E] flex flex-col items-center pt-10 pb-0 px-6">
      <div className="w-full max-w-xs">

        {/* Lang toggle */}
        <div className="absolute top-6 right-6 z-20 flex rounded-full border border-white/20 overflow-hidden text-xs">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 font-medium transition-colors ${lang === 'en' ? 'bg-white text-indigo-900' : 'text-white/60 hover:text-white'}`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('ms')}
            className={`px-3 py-1.5 font-medium transition-colors ${lang === 'ms' ? 'bg-white text-indigo-900' : 'text-white/60 hover:text-white'}`}
          >
            BM
          </button>
        </div>

        {/* App name */}
        <div className="mb-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/20">
              <span className="text-lg font-black text-white">K</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">{tr.appName}</h1>
              <p className="text-xs text-violet-300">{tr.signupDesc}</p>
            </div>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/family-hero.png" alt="" className="w-full h-auto mb-4 object-contain" />

        {/* Card */}
        <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 p-6 shadow-2xl">
          {emailSent ? (
            <div className="py-4 text-center space-y-3">
              <div className="text-4xl">📬</div>
              <h2 className="text-lg font-bold text-white">
                {lang === 'en' ? 'Check your email!' : 'Semak emel anda!'}
              </h2>
              <p className="text-sm text-violet-300 leading-relaxed">
                {lang === 'en'
                  ? `We sent a confirmation email to ${email}. Click the link inside to activate your account.`
                  : `Kami telah menghantar emel ke ${email}. Klik pautan di dalamnya untuk mengesahkan akaun anda.`}
              </p>
              <Link href="/login" className="mt-2 inline-block text-sm font-semibold text-white hover:underline">
                {lang === 'en' ? 'Back to Login' : 'Kembali ke Log Masuk'}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-5 text-lg font-bold text-white">{tr.joinFamily}</h2>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    {tr.name}
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ahmad Bin Ibrahim"
                    required
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    {tr.email}
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    {lang === 'en' ? 'Date of Birth' : 'Tarikh Lahir'}
                  </label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    {lang === 'en' ? 'Contact Number' : 'Nombor Telefon'}
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. 9123 4567' : 'cth. 9123 4567'}
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    {tr.password}
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    {tr.confirmPassword}
                  </label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-300">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-white text-indigo-900 font-bold hover:bg-violet-100 transition-colors mt-1"
                >
                  {loading ? tr.loading : tr.signup}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm text-violet-300">
                {tr.hasAccount}{' '}
                <Link href="/login" className="font-semibold text-white hover:underline">
                  {tr.login}
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
