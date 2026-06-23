'use client'
import { useState, useEffect, useCallback } from 'react'
import { getBalance, addToBalance, setBalance as setBalanceQuery } from '@/lib/queries'
import type { ChildName } from '@/types'

export function useBalance(child: ChildName) {
  const [balance, setBalance] = useState<number>(0)

  const refresh = useCallback(async () => {
    const b = await getBalance(child)
    setBalance(b)
  }, [child])

  useEffect(() => { refresh() }, [refresh])

  const add = useCallback(async (minutes: number) => {
    setBalance(prev => prev + minutes)
    await addToBalance(child, minutes)
  }, [child])

  const set = useCallback(async (minutes: number) => {
    setBalance(minutes)
    await setBalanceQuery(child, minutes)
  }, [child])

  return { balance, add, set, refresh }
}
