import { ChildCard } from '@/components/home/ChildCard'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-bold text-white mb-2">Screentime Wallet</h1>
      <p className="text-slate-400 text-xl mb-16">Who are you?</p>

      <div className="flex gap-8 flex-wrap justify-center">
        <ChildCard name="qasim" emoji="📚" color="violet" />
        <ChildCard name="muadz" emoji="⭐" color="emerald" />
      </div>

      <Link
        href="/parent"
        className="mt-20 text-slate-600 hover:text-slate-400 text-sm transition-colors"
      >
        Parent →
      </Link>
    </main>
  )
}
