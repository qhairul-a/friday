'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function ParentLogin() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/parent-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    setLoading(false)
    if (res.ok) {
      router.replace('/parent')
    } else {
      setError('Wrong PIN. Try again.')
      setPin('')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-10 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-2">Parent View</h1>
        <p className="text-slate-400 mb-8">Enter your PIN to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white text-center text-xl tracking-widest focus:outline-none focus:border-violet-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold transition-colors"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </main>
  )
}
