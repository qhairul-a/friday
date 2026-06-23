# Screentime Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js web app at `Claude/screentimewallet/` where two children earn screen time minutes by reading, with a PIN-protected parent analytics view, all backed by Supabase.

**Architecture:** Standalone Next.js 15 App Router project. All state is persisted to Supabase (same project as friday-dashboard). Three routes: `/` (home/name picker), `/child/[name]` (child experience), `/parent` + `/parent/dashboard` (PIN-protected parent view). Mutual exclusion between reading and screen time enforced in React state; balance persisted via Supabase RPC for atomicity.

**Tech Stack:** Next.js 15 (TypeScript, Tailwind v4), Supabase (existing project, new tables), Recharts, Web Speech API (TTS), Vercel (deployment)

---

## File Structure

```
screentimewallet/
├── app/
│   ├── layout.tsx                        # Root layout + metadata
│   ├── page.tsx                          # Home — name picker
│   ├── child/[name]/page.tsx             # Child experience page
│   ├── parent/
│   │   ├── page.tsx                      # PIN gate (redirects to dashboard if authed)
│   │   └── dashboard/page.tsx            # Protected parent dashboard
│   └── api/parent-auth/route.ts          # POST: verify PIN, set cookie
├── components/
│   ├── home/ChildCard.tsx                # Big tappable child selection card
│   ├── child/
│   │   ├── BalanceDisplay.tsx            # Shows balance in minutes
│   │   ├── ReadingTimer.tsx              # Start/stop reading, live MM:SS counter
│   │   ├── ScreenTimeCountdown.tsx       # Start/stop countdown + zero guard
│   │   ├── TimesUpOverlay.tsx            # Full-screen alert + TTS trigger
│   │   └── SessionGuard.tsx              # Detects & resolves open sessions on load
│   └── parent/
│       ├── RecordsTable.tsx              # Paginated reading sessions table
│       └── Analytics.tsx                 # Stat cards + Recharts bar charts
├── hooks/
│   ├── useBalance.ts                     # Reactive balance fetch + refresh
│   ├── useReadingSession.ts              # Timer state, start/stop, writes to DB
│   └── useScreenTimeSession.ts           # Countdown state, zero detection, DB writes
├── lib/
│   ├── supabase.ts                       # Supabase client singleton
│   ├── queries.ts                        # All DB read/write functions
│   └── tts.ts                            # Web Speech API wrapper
├── types/index.ts                        # Shared TypeScript types
├── middleware.ts                          # Protect /parent/dashboard with cookie check
└── supabase/migrations/001_schema.sql    # Schema + RLS policies + seed
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `screentimewallet/` (entire Next.js project)
- Create: `screentimewallet/.env.local`

- [ ] **Step 1: Run create-next-app**

From `C:/Users/qhair/OneDrive/Desktop/Claude/`:
```bash
npx create-next-app@latest screentimewallet --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-eslint
```
When prompted: accept all defaults.

- [ ] **Step 2: Install additional dependencies**

```bash
cd screentimewallet
npm install @supabase/supabase-js recharts
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

- [ ] **Step 3: Configure Jest**

Create `screentimewallet/jest.config.js`:
```javascript
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
})
```

Create `screentimewallet/jest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create .env.local**

```bash
# screentimewallet/.env.local
# Copy these values from Claude/friday-dashboard/.env.local
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
# Set your own parent PIN (digits only, e.g. 1234)
PARENT_PIN=1234
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```
Expected: Next.js dev server running at http://localhost:3000 with default Next.js page.

- [ ] **Step 6: Commit**

```bash
git add screentimewallet/
git commit -m "feat(screentimewallet): scaffold Next.js project with Supabase + Recharts"
```

---

## Task 2: Types + Supabase client + layout

**Files:**
- Create: `screentimewallet/types/index.ts`
- Create: `screentimewallet/lib/supabase.ts`
- Modify: `screentimewallet/app/layout.tsx`

- [ ] **Step 1: Write types**

Create `screentimewallet/types/index.ts`:
```typescript
export type ChildName = 'qasim' | 'muadz'

export interface ReadingSession {
  id: string
  child_name: ChildName
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  created_at: string
}

export interface ScreentimeSession {
  id: string
  child_name: ChildName
  started_at: string
  ended_at: string | null
  duration_used_minutes: number | null
  created_at: string
}

export interface ScreentimeBalance {
  child_name: ChildName
  balance_minutes: number
  updated_at: string
}
```

- [ ] **Step 2: Write Supabase client**

Create `screentimewallet/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)
```

- [ ] **Step 3: Update layout**

Replace `screentimewallet/app/layout.tsx` with:
```typescript
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Screentime Wallet',
  description: 'Earn screen time by reading',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased bg-slate-900 text-white`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add screentimewallet/types/ screentimewallet/lib/supabase.ts screentimewallet/app/layout.tsx
git commit -m "feat(screentimewallet): add types, Supabase client, and layout"
```

---

## Task 3: Supabase schema

**Files:**
- Create: `screentimewallet/supabase/migrations/001_schema.sql`

- [ ] **Step 1: Write the migration SQL**

Create `screentimewallet/supabase/migrations/001_schema.sql`:
```sql
-- reading_sessions: one row per reading session
CREATE TABLE IF NOT EXISTS reading_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name       text NOT NULL CHECK (child_name IN ('qasim', 'muadz')),
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,                 -- NULL while session is open
  duration_minutes numeric,                     -- set on end
  created_at       timestamptz DEFAULT now()
);

-- screentime_sessions: one row per screen time usage session
CREATE TABLE IF NOT EXISTS screentime_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name            text NOT NULL CHECK (child_name IN ('qasim', 'muadz')),
  started_at            timestamptz NOT NULL,
  ended_at              timestamptz,            -- NULL while session is open
  duration_used_minutes numeric,               -- set on stop or zero-out
  created_at            timestamptz DEFAULT now()
);

-- screentime_balance: live wallet balance per child
CREATE TABLE IF NOT EXISTS screentime_balance (
  child_name      text PRIMARY KEY CHECK (child_name IN ('qasim', 'muadz')),
  balance_minutes numeric NOT NULL DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

-- Seed
INSERT INTO screentime_balance (child_name, balance_minutes)
VALUES ('qasim', 0), ('muadz', 0)
ON CONFLICT DO NOTHING;

-- RPC: atomically add minutes to balance
CREATE OR REPLACE FUNCTION increment_balance(p_child text, p_minutes numeric)
RETURNS void LANGUAGE sql AS $$
  UPDATE screentime_balance
  SET balance_minutes = balance_minutes + p_minutes,
      updated_at = now()
  WHERE child_name = p_child;
$$;

-- RPC: atomically set balance to exact value (floor at 0)
CREATE OR REPLACE FUNCTION set_balance(p_child text, p_minutes numeric)
RETURNS void LANGUAGE sql AS $$
  UPDATE screentime_balance
  SET balance_minutes = GREATEST(0, p_minutes),
      updated_at = now()
  WHERE child_name = p_child;
$$;

-- RLS: enable with permissive anon policies (family app, no sensitive data)
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screentime_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screentime_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON reading_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON screentime_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON screentime_balance FOR ALL TO anon USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Run the SQL in Supabase**

Go to your Supabase project → SQL Editor → paste the contents of `001_schema.sql` → Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify tables**

In Supabase Table Editor, confirm:
- `reading_sessions` exists with correct columns
- `screentime_sessions` exists
- `screentime_balance` has two rows: `qasim` and `muadz` with `balance_minutes = 0`

- [ ] **Step 4: Commit**

```bash
git add screentimewallet/supabase/
git commit -m "feat(screentimewallet): add Supabase schema with RLS and seed"
```

---

## Task 4: DB query functions

**Files:**
- Create: `screentimewallet/lib/queries.ts`
- Create: `screentimewallet/__tests__/lib/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `screentimewallet/__tests__/lib/queries.test.ts`:
```typescript
import { getBalance, startReadingSession, endReadingSession, addToBalance, setBalance, getOpenReadingSession, getOpenScreentimeSession, getReadingSessions } from '@/lib/queries'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
const mockSupabase = supabase as jest.Mocked<typeof supabase>

const mockChain = (returnValue: unknown) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(returnValue),
    maybeSingle: jest.fn().mockResolvedValue(returnValue),
  }
  return chain
}

describe('getBalance', () => {
  it('returns balance_minutes for a child', async () => {
    const chain = mockChain({ data: { balance_minutes: 42 }, error: null })
    mockSupabase.from.mockReturnValue(chain as never)
    const result = await getBalance('qasim')
    expect(result).toBe(42)
    expect(mockSupabase.from).toHaveBeenCalledWith('screentime_balance')
  })
})

describe('addToBalance', () => {
  it('calls increment_balance RPC with correct args', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ error: null })
    await addToBalance('qasim', 10)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_balance', { p_child: 'qasim', p_minutes: 10 })
  })
})

describe('setBalance', () => {
  it('calls set_balance RPC with correct args', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ error: null })
    await setBalance('muadz', 5.5)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('set_balance', { p_child: 'muadz', p_minutes: 5.5 })
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd screentimewallet
npx jest __tests__/lib/queries.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/queries'`

- [ ] **Step 3: Write queries.ts**

Create `screentimewallet/lib/queries.ts`:
```typescript
import { supabase } from './supabase'
import type { ChildName, ReadingSession, ScreentimeSession } from '@/types'

export async function getBalance(child: ChildName): Promise<number> {
  const { data, error } = await supabase
    .from('screentime_balance')
    .select('balance_minutes')
    .eq('child_name', child)
    .single()
  if (error) throw error
  return data.balance_minutes
}

export async function startReadingSession(child: ChildName): Promise<string> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .insert({ child_name: child, started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function endReadingSession(id: string, durationMinutes: number): Promise<void> {
  const { error } = await supabase
    .from('reading_sessions')
    .update({ ended_at: new Date().toISOString(), duration_minutes: durationMinutes })
    .eq('id', id)
  if (error) throw error
}

export async function addToBalance(child: ChildName, minutes: number): Promise<void> {
  const { error } = await supabase.rpc('increment_balance', { p_child: child, p_minutes: minutes })
  if (error) throw error
}

export async function setBalance(child: ChildName, minutes: number): Promise<void> {
  const { error } = await supabase.rpc('set_balance', { p_child: child, p_minutes: minutes })
  if (error) throw error
}

export async function startScreentimeSession(child: ChildName): Promise<string> {
  const { data, error } = await supabase
    .from('screentime_sessions')
    .insert({ child_name: child, started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function endScreentimeSession(id: string, durationUsedMinutes: number): Promise<void> {
  const { error } = await supabase
    .from('screentime_sessions')
    .update({ ended_at: new Date().toISOString(), duration_used_minutes: durationUsedMinutes })
    .eq('id', id)
  if (error) throw error
}

export async function getOpenReadingSession(child: ChildName): Promise<ReadingSession | null> {
  const { data } = await supabase
    .from('reading_sessions')
    .select('*')
    .eq('child_name', child)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getOpenScreentimeSession(child: ChildName): Promise<ScreentimeSession | null> {
  const { data } = await supabase
    .from('screentime_sessions')
    .select('*')
    .eq('child_name', child)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getReadingSessions(child?: ChildName): Promise<ReadingSession[]> {
  let q = supabase
    .from('reading_sessions')
    .select('*')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
  if (child) q = q.eq('child_name', child)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getScreentimeSessions(child?: ChildName): Promise<ScreentimeSession[]> {
  let q = supabase
    .from('screentime_sessions')
    .select('*')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
  if (child) q = q.eq('child_name', child)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/lib/queries.test.ts
```
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add screentimewallet/lib/queries.ts screentimewallet/__tests__/
git commit -m "feat(screentimewallet): add DB query functions with tests"
```

---

## Task 5: TTS utility

**Files:**
- Create: `screentimewallet/lib/tts.ts`
- Create: `screentimewallet/__tests__/lib/tts.test.ts`

- [ ] **Step 1: Write failing test**

Create `screentimewallet/__tests__/lib/tts.test.ts`:
```typescript
import { speak } from '@/lib/tts'

describe('speak', () => {
  it('calls speechSynthesis.speak with correct text', () => {
    const mockSpeak = jest.fn()
    const mockCancel = jest.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      value: { speak: mockSpeak, cancel: mockCancel },
      writable: true,
    })
    speak('Hello Qasim')
    expect(mockCancel).toHaveBeenCalled()
    expect(mockSpeak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello Qasim' }))
  })

  it('does nothing when speechSynthesis is not available', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, writable: true })
    expect(() => speak('test')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest __tests__/lib/tts.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/tts'`

- [ ] **Step 3: Write tts.ts**

Create `screentimewallet/lib/tts.ts`:
```typescript
export function speak(text: string): void {
  if (typeof window === 'undefined') return
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.9
  utterance.pitch = 1.0
  window.speechSynthesis.speak(utterance)
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest __tests__/lib/tts.test.ts
```
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add screentimewallet/lib/tts.ts screentimewallet/__tests__/lib/tts.test.ts
git commit -m "feat(screentimewallet): add TTS utility with tests"
```

---

## Task 6: Home page

**Files:**
- Create: `screentimewallet/components/home/ChildCard.tsx`
- Modify: `screentimewallet/app/page.tsx`

- [ ] **Step 1: Write ChildCard component**

Create `screentimewallet/components/home/ChildCard.tsx`:
```typescript
import Link from 'next/link'

interface Props {
  name: string
  emoji: string
  color: 'violet' | 'emerald'
}

const colorMap = {
  violet: {
    card: 'bg-violet-900/50 border-violet-700 hover:bg-violet-800/50 hover:border-violet-500',
    text: 'text-violet-300',
  },
  emerald: {
    card: 'bg-emerald-900/50 border-emerald-700 hover:bg-emerald-800/50 hover:border-emerald-500',
    text: 'text-emerald-300',
  },
}

export function ChildCard({ name, emoji, color }: Props) {
  return (
    <Link href={`/child/${name}`}>
      <div className={`${colorMap[color].card} border-2 rounded-3xl p-12 text-center cursor-pointer transition-all duration-150 active:scale-95 min-w-[180px]`}>
        <div className="text-7xl mb-4">{emoji}</div>
        <div className={`text-2xl font-bold ${colorMap[color].text} capitalize`}>{name}</div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Write home page**

Replace `screentimewallet/app/page.tsx` with:
```typescript
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
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000. You should see two large cards (Qasim in purple, Muadz in green) and a small "Parent →" link at the bottom. Tapping a card navigates to `/child/qasim` or `/child/muadz` (404 for now — that's expected).

- [ ] **Step 4: Commit**

```bash
git add screentimewallet/app/page.tsx screentimewallet/components/
git commit -m "feat(screentimewallet): add home page with child selection cards"
```

---

## Task 7: useBalance hook + BalanceDisplay

**Files:**
- Create: `screentimewallet/hooks/useBalance.ts`
- Create: `screentimewallet/components/child/BalanceDisplay.tsx`
- Create: `screentimewallet/__tests__/hooks/useBalance.test.ts`

- [ ] **Step 1: Write failing test**

Create `screentimewallet/__tests__/hooks/useBalance.test.ts`:
```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBalance } from '@/hooks/useBalance'

jest.mock('@/lib/queries', () => ({
  getBalance: jest.fn(),
}))
import { getBalance } from '@/lib/queries'
const mockGetBalance = getBalance as jest.Mock

describe('useBalance', () => {
  it('fetches balance on mount and exposes refresh', async () => {
    mockGetBalance.mockResolvedValue(42)
    const { result } = renderHook(() => useBalance('qasim'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.balance).toBe(42)
    expect(mockGetBalance).toHaveBeenCalledWith('qasim')
  })

  it('refresh re-fetches the balance', async () => {
    mockGetBalance.mockResolvedValueOnce(10).mockResolvedValueOnce(25)
    const { result } = renderHook(() => useBalance('muadz'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.balance).toBe(10)
    await act(async () => { await result.current.refresh() })
    expect(result.current.balance).toBe(25)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest __tests__/hooks/useBalance.test.ts
```
Expected: FAIL — `Cannot find module '@/hooks/useBalance'`

- [ ] **Step 3: Write useBalance hook**

Create `screentimewallet/hooks/useBalance.ts`:
```typescript
'use client'
import { useCallback, useEffect, useState } from 'react'
import { getBalance } from '@/lib/queries'
import type { ChildName } from '@/types'

export function useBalance(child: ChildName) {
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const b = await getBalance(child)
    setBalance(b)
    setLoading(false)
  }, [child])

  useEffect(() => { refresh() }, [refresh])

  return { balance, loading, refresh }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest __tests__/hooks/useBalance.test.ts
```
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Write BalanceDisplay component**

Create `screentimewallet/components/child/BalanceDisplay.tsx`:
```typescript
interface Props {
  balance: number
  loading?: boolean
}

export function BalanceDisplay({ balance, loading }: Props) {
  return (
    <div className="bg-slate-800 rounded-2xl p-6 text-center">
      <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Screen Time Balance</p>
      {loading ? (
        <p className="text-4xl font-bold text-slate-600">—</p>
      ) : (
        <>
          <p className={`text-6xl font-bold mb-1 tabular-nums ${balance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Math.floor(balance)}
          </p>
          <p className="text-slate-500 text-sm">minutes earned</p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add screentimewallet/hooks/useBalance.ts screentimewallet/components/child/BalanceDisplay.tsx screentimewallet/__tests__/hooks/useBalance.test.ts
git commit -m "feat(screentimewallet): add useBalance hook and BalanceDisplay component"
```

---

## Task 8: Reading timer (hook + component)

**Files:**
- Create: `screentimewallet/hooks/useReadingSession.ts`
- Create: `screentimewallet/components/child/ReadingTimer.tsx`
- Create: `screentimewallet/__tests__/hooks/useReadingSession.test.ts`

- [ ] **Step 1: Write failing tests**

Create `screentimewallet/__tests__/hooks/useReadingSession.test.ts`:
```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useReadingSession } from '@/hooks/useReadingSession'

jest.mock('@/lib/queries', () => ({
  startReadingSession: jest.fn().mockResolvedValue('session-1'),
  endReadingSession: jest.fn().mockResolvedValue(undefined),
  addToBalance: jest.fn().mockResolvedValue(undefined),
}))
import { startReadingSession, endReadingSession, addToBalance } from '@/lib/queries'

describe('useReadingSession', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts a session and sets isReading to true', async () => {
    const onStop = jest.fn()
    const { result } = renderHook(() => useReadingSession('qasim', onStop))
    expect(result.current.isReading).toBe(false)
    await act(async () => { await result.current.start() })
    expect(result.current.isReading).toBe(true)
    expect(startReadingSession).toHaveBeenCalledWith('qasim')
  })

  it('stop calls endReadingSession and addToBalance', async () => {
    const onStop = jest.fn()
    const { result } = renderHook(() => useReadingSession('qasim', onStop))
    await act(async () => { await result.current.start() })
    await act(async () => { await result.current.stop() })
    expect(endReadingSession).toHaveBeenCalledWith('session-1', expect.any(Number))
    expect(addToBalance).toHaveBeenCalledWith('qasim', expect.any(Number))
    expect(onStop).toHaveBeenCalled()
    expect(result.current.isReading).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest __tests__/hooks/useReadingSession.test.ts
```
Expected: FAIL — `Cannot find module '@/hooks/useReadingSession'`

- [ ] **Step 3: Write useReadingSession hook**

Create `screentimewallet/hooks/useReadingSession.ts`:
```typescript
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { startReadingSession, endReadingSession, addToBalance } from '@/lib/queries'
import type { ChildName } from '@/types'

export function useReadingSession(child: ChildName, onStop: () => void) {
  const [isReading, setIsReading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const sessionIdRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    const id = await startReadingSession(child)
    sessionIdRef.current = id
    setElapsed(0)
    setIsReading(true)
  }, [child])

  const stop = useCallback(async () => {
    if (!sessionIdRef.current) return
    const minutes = elapsed / 60
    await endReadingSession(sessionIdRef.current, minutes)
    await addToBalance(child, minutes)
    sessionIdRef.current = null
    setIsReading(false)
    setElapsed(0)
    onStop()
  }, [child, elapsed, onStop])

  useEffect(() => {
    if (isReading) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isReading])

  return { isReading, elapsed, start, stop }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest __tests__/hooks/useReadingSession.test.ts
```
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Write ReadingTimer component**

Create `screentimewallet/components/child/ReadingTimer.tsx`:
```typescript
'use client'
import { useReadingSession } from '@/hooks/useReadingSession'
import type { ChildName } from '@/types'

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface Props {
  child: ChildName
  disabled: boolean
  onStart: () => void
  onStop: () => void
}

export function ReadingTimer({ child, disabled, onStart, onStop }: Props) {
  const { isReading, elapsed, start, stop } = useReadingSession(child, onStop)

  const handleStart = async () => { await start(); onStart() }

  return (
    <div className={`bg-slate-800 rounded-2xl p-6 transition-opacity ${disabled && !isReading ? 'opacity-40' : ''}`}>
      <p className="text-slate-400 text-sm mb-3">📚 Reading Timer</p>

      {isReading && (
        <div className="text-center mb-4">
          <p className="text-5xl font-bold text-violet-400 font-mono tabular-nums">{fmt(elapsed)}</p>
          <p className="text-slate-500 text-sm mt-2">+{Math.floor(elapsed / 60)} min earned so far</p>
        </div>
      )}

      <button
        onClick={isReading ? stop : handleStart}
        disabled={disabled && !isReading}
        className={`w-full py-5 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
          isReading
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-violet-600 hover:bg-violet-700 text-white disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed'
        }`}
      >
        {isReading ? '⏹ Stop Reading' : '▶ Start Reading'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add screentimewallet/hooks/useReadingSession.ts screentimewallet/components/child/ReadingTimer.tsx screentimewallet/__tests__/hooks/useReadingSession.test.ts
git commit -m "feat(screentimewallet): add reading timer hook and component"
```

---

## Task 9: Screen time countdown + TimesUp overlay

**Files:**
- Create: `screentimewallet/hooks/useScreenTimeSession.ts`
- Create: `screentimewallet/components/child/ScreenTimeCountdown.tsx`
- Create: `screentimewallet/components/child/TimesUpOverlay.tsx`
- Create: `screentimewallet/__tests__/hooks/useScreenTimeSession.test.ts`

- [ ] **Step 1: Write failing tests**

Create `screentimewallet/__tests__/hooks/useScreenTimeSession.test.ts`:
```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useScreenTimeSession } from '@/hooks/useScreenTimeSession'

jest.mock('@/lib/queries', () => ({
  startScreentimeSession: jest.fn().mockResolvedValue('session-st-1'),
  endScreentimeSession: jest.fn().mockResolvedValue(undefined),
  setBalance: jest.fn().mockResolvedValue(undefined),
}))
import { startScreentimeSession, endScreentimeSession, setBalance } from '@/lib/queries'

describe('useScreenTimeSession', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts countdown from initialBalance minutes', async () => {
    const { result } = renderHook(() =>
      useScreenTimeSession('qasim', 5, jest.fn(), jest.fn())
    )
    await act(async () => { await result.current.start() })
    expect(result.current.isRunning).toBe(true)
    expect(result.current.remaining).toBe(300) // 5 * 60
    expect(startScreentimeSession).toHaveBeenCalledWith('qasim')
  })

  it('stop saves session and calls onBalanceChange', async () => {
    const onBalanceChange = jest.fn()
    const { result } = renderHook(() =>
      useScreenTimeSession('qasim', 2, onBalanceChange, jest.fn())
    )
    await act(async () => { await result.current.start() })
    await act(async () => { await result.current.stop() })
    expect(endScreentimeSession).toHaveBeenCalledWith('session-st-1', expect.any(Number))
    expect(setBalance).toHaveBeenCalled()
    expect(onBalanceChange).toHaveBeenCalled()
    expect(result.current.isRunning).toBe(false)
  })

  it('does not start if initialBalance is 0', async () => {
    const { result } = renderHook(() =>
      useScreenTimeSession('qasim', 0, jest.fn(), jest.fn())
    )
    await act(async () => { await result.current.start() })
    expect(result.current.isRunning).toBe(false)
    expect(startScreentimeSession).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest __tests__/hooks/useScreenTimeSession.test.ts
```
Expected: FAIL — `Cannot find module '@/hooks/useScreenTimeSession'`

- [ ] **Step 3: Write useScreenTimeSession hook**

Create `screentimewallet/hooks/useScreenTimeSession.ts`:
```typescript
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { startScreentimeSession, endScreentimeSession, setBalance } from '@/lib/queries'
import type { ChildName } from '@/types'

export function useScreenTimeSession(
  child: ChildName,
  initialBalance: number,
  onBalanceChange: () => void,
  onTimesUp: () => void
) {
  const [isRunning, setIsRunning] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const sessionIdRef = useRef<string | null>(null)
  const balanceAtStartRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timesUpFiredRef = useRef(false)

  const start = useCallback(async () => {
    if (initialBalance <= 0) return
    const id = await startScreentimeSession(child)
    sessionIdRef.current = id
    balanceAtStartRef.current = initialBalance
    timesUpFiredRef.current = false
    setRemaining(Math.floor(initialBalance * 60))
    setIsRunning(true)
  }, [child, initialBalance])

  const stop = useCallback(async () => {
    if (!sessionIdRef.current) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    const totalSeconds = Math.floor(balanceAtStartRef.current * 60)
    const usedSeconds = totalSeconds - remaining
    const usedMinutes = usedSeconds / 60
    const leftoverMinutes = remaining / 60
    await endScreentimeSession(sessionIdRef.current, usedMinutes)
    await setBalance(child, leftoverMinutes)
    sessionIdRef.current = null
    setIsRunning(false)
    onBalanceChange()
  }, [child, remaining, onBalanceChange])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning])

  useEffect(() => {
    if (isRunning && remaining === 0 && sessionIdRef.current && !timesUpFiredRef.current) {
      timesUpFiredRef.current = true
      const handleTimesUp = async () => {
        await endScreentimeSession(sessionIdRef.current!, balanceAtStartRef.current)
        await setBalance(child, 0)
        sessionIdRef.current = null
        setIsRunning(false)
        onBalanceChange()
        onTimesUp()
      }
      handleTimesUp()
    }
  }, [isRunning, remaining, child, onBalanceChange, onTimesUp])

  return { isRunning, remaining, start, stop }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest __tests__/hooks/useScreenTimeSession.test.ts
```
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Write TimesUpOverlay**

Create `screentimewallet/components/child/TimesUpOverlay.tsx`:
```typescript
'use client'
import { useEffect } from 'react'
import { speak } from '@/lib/tts'

interface Props {
  childName: string
}

export function TimesUpOverlay({ childName }: Props) {
  const display = childName.charAt(0).toUpperCase() + childName.slice(1)

  useEffect(() => {
    speak(`${display}, your time is up! Try reading more to earn more screen time.`)
  }, [display])

  return (
    <div className="fixed inset-0 bg-red-950/95 flex flex-col items-center justify-center z-50 text-white text-center p-8">
      <div className="text-9xl mb-8 animate-bounce">⏰</div>
      <h1 className="text-6xl font-bold mb-4">Time's Up!</h1>
      <p className="text-2xl text-red-200 mb-6 max-w-sm">
        {display}, try reading more to earn more screen time!
      </p>
      <p className="text-slate-400 text-base">Ask a parent if you need help.</p>
    </div>
  )
}
```

- [ ] **Step 6: Write ScreenTimeCountdown component**

Create `screentimewallet/components/child/ScreenTimeCountdown.tsx`:
```typescript
'use client'
import { useScreenTimeSession } from '@/hooks/useScreenTimeSession'
import type { ChildName } from '@/types'

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface Props {
  child: ChildName
  balance: number
  disabled: boolean
  onStart: () => void
  onStop: () => void
  onTimesUp: () => void
}

export function ScreenTimeCountdown({ child, balance, disabled, onStart, onStop, onTimesUp }: Props) {
  const { isRunning, remaining, start, stop } = useScreenTimeSession(
    child, balance, onStop, onTimesUp
  )

  const handleStart = async () => { await start(); onStart() }
  const noBalance = balance <= 0 && !isRunning

  return (
    <div className={`bg-slate-800 rounded-2xl p-6 transition-opacity ${(disabled || noBalance) && !isRunning ? 'opacity-40' : ''}`}>
      <p className="text-slate-400 text-sm mb-3">📺 Screen Time</p>

      {isRunning && (
        <div className="text-center mb-4">
          <p className="text-5xl font-bold text-emerald-400 font-mono tabular-nums">{fmt(remaining)}</p>
          <p className="text-slate-500 text-sm mt-2">remaining</p>
        </div>
      )}

      {!isRunning && noBalance && (
        <p className="text-center text-slate-500 text-sm mb-4">No balance — read to earn more!</p>
      )}

      <button
        onClick={isRunning ? stop : handleStart}
        disabled={(disabled || noBalance) && !isRunning}
        className={`w-full py-5 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed'
        }`}
      >
        {isRunning ? '⏹ Stop Screen Time' : '▶ Start Screen Time'}
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add screentimewallet/hooks/useScreenTimeSession.ts screentimewallet/components/child/ screentimewallet/__tests__/hooks/useScreenTimeSession.test.ts
git commit -m "feat(screentimewallet): add screen time countdown, times-up overlay, and hook"
```

---

## Task 10: Session guard

**Files:**
- Create: `screentimewallet/components/child/SessionGuard.tsx`

- [ ] **Step 1: Write SessionGuard**

Create `screentimewallet/components/child/SessionGuard.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import {
  getOpenReadingSession, getOpenScreentimeSession,
  endReadingSession, endScreentimeSession,
  addToBalance, setBalance, getBalance,
} from '@/lib/queries'
import type { ChildName } from '@/types'

type OpenSession =
  | { type: 'reading'; id: string; startedAt: string }
  | { type: 'screentime'; id: string; startedAt: string }
  | null

interface Props {
  child: ChildName
  onResolved: () => void
  children: React.ReactNode
}

export function SessionGuard({ child, onResolved, children }: Props) {
  const [open, setOpen] = useState<OpenSession | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function check() {
      const [reading, screentime] = await Promise.all([
        getOpenReadingSession(child),
        getOpenScreentimeSession(child),
      ])
      if (reading) setOpen({ type: 'reading', id: reading.id, startedAt: reading.started_at })
      else if (screentime) setOpen({ type: 'screentime', id: screentime.id, startedAt: screentime.started_at })
      else setOpen(null)
    }
    check()
  }, [child])

  const handleYes = async () => {
    if (!open) return
    setBusy(true)
    const now = new Date()
    const startedAt = new Date(open.startedAt)
    const elapsedMinutes = (now.getTime() - startedAt.getTime()) / 60000

    if (open.type === 'reading') {
      await endReadingSession(open.id, elapsedMinutes)
      await addToBalance(child, elapsedMinutes)
    } else {
      const currentBalance = await getBalance(child)
      const usedMinutes = Math.min(elapsedMinutes, currentBalance)
      await endScreentimeSession(open.id, usedMinutes)
      await setBalance(child, Math.max(0, currentBalance - usedMinutes))
    }

    setBusy(false)
    setOpen(null)
    onResolved()
  }

  const handleNo = async () => {
    if (!open) return
    setBusy(true)
    if (open.type === 'reading') {
      await endReadingSession(open.id, 0)
    } else {
      await endScreentimeSession(open.id, 0)
    }
    setBusy(false)
    setOpen(null)
    onResolved()
  }

  if (open === undefined) return null

  if (open) {
    const icon = open.type === 'reading' ? '📚' : '📺'
    const label = open.type === 'reading' ? 'reading' : 'screen time'
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">{icon}</div>
          <h2 className="text-xl font-bold text-white mb-2">Unfinished session</h2>
          <p className="text-slate-400 mb-6">
            You had a {label} session that wasn't stopped. Did you finish?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleYes}
              disabled={busy}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold"
            >
              Yes, done
            </button>
            <button
              onClick={handleNo}
              disabled={busy}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold"
            >
              Discard it
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Commit**

```bash
git add screentimewallet/components/child/SessionGuard.tsx
git commit -m "feat(screentimewallet): add session guard for unresolved sessions on load"
```

---

## Task 11: Child page (wiring)

**Files:**
- Create: `screentimewallet/app/child/[name]/page.tsx`

- [ ] **Step 1: Write child page**

Create `screentimewallet/app/child/[name]/page.tsx`:
```typescript
'use client'
import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BalanceDisplay } from '@/components/child/BalanceDisplay'
import { ReadingTimer } from '@/components/child/ReadingTimer'
import { ScreenTimeCountdown } from '@/components/child/ScreenTimeCountdown'
import { TimesUpOverlay } from '@/components/child/TimesUpOverlay'
import { SessionGuard } from '@/components/child/SessionGuard'
import { useBalance } from '@/hooks/useBalance'
import type { ChildName } from '@/types'

const VALID: ChildName[] = ['qasim', 'muadz']

export default function ChildPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params)
  if (!VALID.includes(name as ChildName)) notFound()

  const child = name as ChildName
  const display = child.charAt(0).toUpperCase() + child.slice(1)

  const { balance, loading, refresh } = useBalance(child)
  const [timesUp, setTimesUp] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isScreenTime, setIsScreenTime] = useState(false)

  if (timesUp) return <TimesUpOverlay childName={child} />

  return (
    <SessionGuard child={child} onResolved={refresh}>
      <main className="min-h-screen p-6 flex flex-col max-w-lg mx-auto">
        <div className="flex justify-between items-start mb-6">
          <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">← Back</Link>
        </div>

        <div className="text-center mb-6">
          <p className="text-slate-400 text-lg">Hey,</p>
          <h1 className="text-5xl font-bold text-violet-400">{display} 👋</h1>
        </div>

        <BalanceDisplay balance={balance} loading={loading} />

        <div className="mt-5">
          <ReadingTimer
            child={child}
            disabled={isScreenTime}
            onStart={() => setIsReading(true)}
            onStop={() => { setIsReading(false); refresh() }}
          />
        </div>

        <div className="mt-4">
          <ScreenTimeCountdown
            child={child}
            balance={balance}
            disabled={isReading}
            onStart={() => setIsScreenTime(true)}
            onStop={() => { setIsScreenTime(false); refresh() }}
            onTimesUp={() => { setIsScreenTime(false); setTimesUp(true) }}
          />
        </div>
      </main>
    </SessionGuard>
  )
}
```

- [ ] **Step 2: Verify child flow in browser**

Open http://localhost:3000, click Qasim. You should see:
- Greeting "Hey, Qasim 👋"
- Balance display (0 min)
- Start Reading button (violet)
- Start Screen Time button (grey/disabled — no balance)

Click "Start Reading" → timer counts up. Click "Stop Reading" → balance updates.

- [ ] **Step 3: Commit**

```bash
git add screentimewallet/app/child/
git commit -m "feat(screentimewallet): add child page wiring all components together"
```

---

## Task 12: Parent auth (API route + middleware + PIN gate)

**Files:**
- Create: `screentimewallet/app/api/parent-auth/route.ts`
- Create: `screentimewallet/middleware.ts`
- Modify: `screentimewallet/app/parent/page.tsx`

- [ ] **Step 1: Write API route**

Create `screentimewallet/app/api/parent-auth/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { pin } = await request.json()
  if (!pin || pin !== process.env.PARENT_PIN) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set('parent_session', 'authenticated', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return response
}
```

- [ ] **Step 2: Write middleware**

Create `screentimewallet/middleware.ts`:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('parent_session')
  if (!session || session.value !== 'authenticated') {
    return NextResponse.redirect(new URL('/parent', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/parent/dashboard/:path*'],
}
```

- [ ] **Step 3: Write parent PIN gate page**

Replace `screentimewallet/app/parent/page.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ParentPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
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
      router.push('/parent/dashboard')
    } else {
      setError('Wrong PIN. Try again.')
      setPin('')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm mb-6 block">← Home</Link>
        <h1 className="text-2xl font-bold text-white text-center mb-1">Parent View</h1>
        <p className="text-slate-400 text-center text-sm mb-6">Enter your PIN to continue</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="••••"
            className="bg-slate-700 text-white rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-violet-500"
            maxLength={8}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !pin}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-4 font-semibold text-lg transition-colors"
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Verify PIN gate in browser**

Open http://localhost:3000/parent. Enter the wrong PIN → error message. Enter the correct PIN (from .env.local `PARENT_PIN`) → redirects to `/parent/dashboard` (404 for now — next task).

- [ ] **Step 5: Commit**

```bash
git add screentimewallet/app/api/ screentimewallet/middleware.ts screentimewallet/app/parent/
git commit -m "feat(screentimewallet): add parent PIN gate, API route, and route middleware"
```

---

## Task 13: Parent records table

**Files:**
- Create: `screentimewallet/components/parent/RecordsTable.tsx`

- [ ] **Step 1: Write RecordsTable**

Create `screentimewallet/components/parent/RecordsTable.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { getReadingSessions } from '@/lib/queries'
import type { ReadingSession, ChildName } from '@/types'

const PAGE_SIZE = 20

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
}

export function RecordsTable() {
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [filter, setFilter] = useState<ChildName | 'all'>('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    getReadingSessions(filter === 'all' ? undefined : filter).then(setSessions)
    setPage(0)
  }, [filter])

  const paged = sessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sessions.length / PAGE_SIZE)

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['all', 'qasim', 'muadz'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Child</th>
              <th className="px-4 py-3 text-left">Start</th>
              <th className="px-4 py-3 text-left">End</th>
              <th className="px-4 py-3 text-right">Earned</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(s => (
              <tr key={s.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-200">{fmtDate(s.started_at)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    s.child_name === 'qasim'
                      ? 'bg-violet-900/70 text-violet-300'
                      : 'bg-emerald-900/70 text-emerald-300'
                  }`}>
                    {s.child_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{fmtTime(s.started_at)}</td>
                <td className="px-4 py-3 text-slate-400">{s.ended_at ? fmtTime(s.ended_at) : '—'}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                  +{Math.round(s.duration_minutes ?? 0)} min
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">No reading sessions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4 items-center">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 bg-slate-700 text-slate-300 rounded disabled:opacity-40">←</button>
          <span className="text-slate-400 text-sm">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-3 py-1 bg-slate-700 text-slate-300 rounded disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add screentimewallet/components/parent/RecordsTable.tsx
git commit -m "feat(screentimewallet): add parent records table with filter and pagination"
```

---

## Task 14: Parent analytics

**Files:**
- Create: `screentimewallet/components/parent/Analytics.tsx`

- [ ] **Step 1: Write Analytics component**

Create `screentimewallet/components/parent/Analytics.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getReadingSessions, getScreentimeSessions } from '@/lib/queries'
import type { ReadingSession, ScreentimeSession } from '@/types'

function getWeekDays(): Date[] {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function getLast4Weeks(): { start: Date; end: Date; label: string }[] {
  const now = new Date()
  return Array.from({ length: 4 }, (_, i) => {
    const offset = (3 - i) * 7
    const start = new Date(now)
    start.setDate(now.getDate() - offset - now.getDay())
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return { start, end, label: i === 3 ? 'This wk' : `Wk -${3 - i}` }
  })
}

export function Analytics() {
  const [reading, setReading] = useState<ReadingSession[]>([])
  const [screentime, setScreentime] = useState<ScreentimeSession[]>([])

  useEffect(() => {
    Promise.all([getReadingSessions(), getScreentimeSessions()]).then(([r, s]) => {
      setReading(r)
      setScreentime(s)
    })
  }, [])

  const totalEarned = reading.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const totalUsed = screentime.reduce((s, r) => s + (r.duration_used_minutes ?? 0), 0)
  const utilization = totalEarned > 0 ? Math.round((totalUsed / totalEarned) * 100) : 0

  const weekDays = getWeekDays()
  const thisWeekReading = reading.filter(r => new Date(r.started_at) >= weekDays[0])
  const totalThisWeekMin = thisWeekReading.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const totalThisWeek = totalThisWeekMin >= 60
    ? `${Math.floor(totalThisWeekMin / 60)}h ${Math.round(totalThisWeekMin % 60)}m`
    : `${Math.round(totalThisWeekMin)}m`

  const calcAvg = (child: 'qasim' | 'muadz') => {
    const sessions = reading.filter(r => r.child_name === child)
    if (sessions.length === 0) return 0
    const days = new Set(sessions.map(r => r.started_at.slice(0, 10))).size
    return Math.round(sessions.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / days)
  }

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dailyData = weekDays.map((day, i) => {
    const dateStr = day.toISOString().slice(0, 10)
    const sum = (child: 'qasim' | 'muadz') =>
      Math.round(reading.filter(r => r.child_name === child && r.started_at.startsWith(dateStr))
        .reduce((s, r) => s + (r.duration_minutes ?? 0), 0))
    return { day: DAY_LABELS[i], Qasim: sum('qasim'), Muadz: sum('muadz') }
  })

  const weeklyData = getLast4Weeks().map(w => {
    const earned = reading.filter(r => { const d = new Date(r.started_at); return d >= w.start && d < w.end })
      .reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
    const used = screentime.filter(r => { const d = new Date(r.started_at); return d >= w.start && d < w.end })
      .reduce((s, r) => s + (r.duration_used_minutes ?? 0), 0)
    return { week: w.label, '%': earned > 0 ? Math.round((used / earned) * 100) : 0 }
  })

  const tooltipStyle = { contentStyle: { background: '#1e293b', border: 'none', borderRadius: 8, color: '#e2e8f0' } }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Utilization', value: `${utilization}%`, color: 'text-amber-400' },
          { label: 'This Week', value: totalThisWeek, color: 'text-violet-400' },
          { label: 'Qasim avg/day', value: `${calcAvg('qasim')} min`, color: 'text-violet-400' },
          { label: 'Muadz avg/day', value: `${calcAvg('muadz')} min`, color: 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-900 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl p-4">
        <h3 className="text-slate-300 text-sm font-medium mb-4">Reading minutes / day — this week</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData}>
            <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar dataKey="Qasim" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Muadz" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-900 rounded-xl p-4">
        <h3 className="text-slate-300 text-sm font-medium mb-4">Screen time utilization % — last 4 weeks</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData}>
            <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}%`} />
            <Bar dataKey="%" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add screentimewallet/components/parent/Analytics.tsx
git commit -m "feat(screentimewallet): add parent analytics with stat cards and Recharts"
```

---

## Task 15: Parent dashboard page (wiring)

**Files:**
- Create: `screentimewallet/app/parent/dashboard/page.tsx`

- [ ] **Step 1: Write parent dashboard page**

Create `screentimewallet/app/parent/dashboard/page.tsx`:
```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { RecordsTable } from '@/components/parent/RecordsTable'
import { Analytics } from '@/components/parent/Analytics'

export default function ParentDashboard() {
  const [tab, setTab] = useState<'records' | 'analytics'>('records')

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">← Home</Link>
        </div>

        <div className="flex gap-2 mb-6">
          {([['records', '📋 Records'], ['analytics', '📊 Analytics']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-2 rounded-lg font-medium transition-colors ${
                tab === id ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'records' ? <RecordsTable /> : <Analytics />}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify full parent flow in browser**

1. Go to http://localhost:3000 → click "Parent →"
2. Enter correct PIN → should land on `/parent/dashboard`
3. Records tab shows table (empty if no sessions yet — do a reading session first)
4. Analytics tab shows 4 stat cards + 2 bar charts

- [ ] **Step 3: Commit**

```bash
git add screentimewallet/app/parent/dashboard/
git commit -m "feat(screentimewallet): add parent dashboard page with records and analytics tabs"
```

---

## Task 16: End-to-end local verification

- [ ] **Step 1: Run all tests**

```bash
cd screentimewallet
npx jest --passWithNoTests
```
Expected: All tests pass.

- [ ] **Step 2: Run build check**

```bash
npm run build
```
Expected: Build completes with no errors. Note any TypeScript or Tailwind warnings and fix them.

- [ ] **Step 3: Test the golden path**

Start dev server (`npm run dev`) and walk through this script manually:

1. **Home**: Open http://localhost:3000 — two child cards visible, "Parent →" at bottom
2. **Qasim reads**: Click Qasim → tap "Start Reading" → wait 2 minutes → tap "Stop Reading" → balance shows 2 min
3. **Qasim earns screen time**: Tap "Start Screen Time" (now enabled) → countdown shows 2:00 → tap Stop → balance preserved
4. **Zero guard**: Deplete all balance → "Start Screen Time" greyed out, shows "No balance"
5. **Times Up**: Earn 1 min → start screen time → wait for countdown to hit 0 → Times Up overlay appears + TTS fires
6. **Muadz flow**: Repeat steps 2–4 for Muadz → verify balances are independent
7. **Parent view**: Click "Parent →" → enter PIN → records table shows sessions with correct dates/times/durations → Analytics tab shows charts
8. **Session guard**: Mid-read, close browser tab → reopen child page → "Unfinished session" prompt appears

- [ ] **Step 4: Fix any issues found in Step 3**

Address any bugs before proceeding to deploy.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(screentimewallet): local verification complete, ready for review"
```

---

## Deployment (after user review)

> **Do not deploy until the user has reviewed the local build and confirmed it's good.**

- [ ] Create GitHub repo `screentimewallet` and push:
  ```bash
  git remote add origin https://github.com/qhairul-a/screentimewallet.git
  git push -u origin main
  ```

- [ ] Create Vercel project via CLI from `screentimewallet/`:
  ```bash
  npx vercel --prod
  ```
  When prompted: link to team `qhairul`, new project `screentime-wallet`.

- [ ] Add env vars in Vercel dashboard (`vercel.com/qhairul/screentime-wallet/settings/environment-variables`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `PARENT_PIN`

- [ ] Trigger redeploy after env vars are set.
