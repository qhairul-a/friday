'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { startScreentimeSession, endScreentimeSession, getOpenScreentimeSession } from '@/lib/queries'
import { speak } from '@/lib/tts'
import type { ChildName } from '@/types'

export function useScreentimeCountdown(
  child: ChildName,
  balanceMinutes: number,
  onSetBalance: (minutes: number) => Promise<void>
) {
  const [isActive, setIsActive] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(balanceMinutes * 60)
  const [isLoading, setIsLoading] = useState(true)
  const [timesUp, setTimesUp] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number>(0)
  const initialBalanceRef = useRef<number>(balanceMinutes)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep remainingSeconds in sync with balance when not active
  useEffect(() => {
    if (!isActive) {
      setRemainingSeconds(balanceMinutes * 60)
      initialBalanceRef.current = balanceMinutes
    }
  }, [balanceMinutes, isActive])

  useEffect(() => {
    getOpenScreentimeSession(child).then(open => {
      if (open) {
        sessionIdRef.current = open.id
        startedAtRef.current = new Date(open.started_at).getTime()
        const usedSecs = Math.floor((Date.now() - startedAtRef.current) / 1000)
        const remaining = Math.max(0, balanceMinutes * 60 - usedSecs)
        setRemainingSeconds(remaining)
        setIsActive(true)
      }
      setIsLoading(false)
    })
  }, [child, balanceMinutes])

  useEffect(() => {
    if (!isActive) return
    intervalRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isActive])

  // Watch for countdown reaching zero
  useEffect(() => {
    if (!isActive || remainingSeconds > 0) return
    const handleTimesUp = async () => {
      speak(`${child}, your time is up! Try reading more to earn more screen time`)
      const minutesUsed = initialBalanceRef.current
      if (sessionIdRef.current) {
        await endScreentimeSession(sessionIdRef.current, minutesUsed)
      }
      await onSetBalance(0)
      sessionIdRef.current = null
      setIsActive(false)
      setTimesUp(true)
    }
    handleTimesUp()
  }, [isActive, remainingSeconds, child, onSetBalance])

  const start = useCallback(async () => {
    const id = await startScreentimeSession(child)
    sessionIdRef.current = id
    startedAtRef.current = Date.now()
    initialBalanceRef.current = balanceMinutes
    setRemainingSeconds(balanceMinutes * 60)
    setTimesUp(false)
    setIsActive(true)
  }, [child, balanceMinutes])

  const stop = useCallback(async () => {
    if (!sessionIdRef.current) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    const usedSeconds = initialBalanceRef.current * 60 - remainingSeconds
    const usedMinutes = Math.floor(usedSeconds / 60)
    const remainingMinutes = Math.floor(remainingSeconds / 60)
    await endScreentimeSession(sessionIdRef.current, usedMinutes)
    await onSetBalance(remainingMinutes)
    sessionIdRef.current = null
    setIsActive(false)
  }, [remainingSeconds, onSetBalance])

  const dismissTimesUp = useCallback(() => setTimesUp(false), [])

  return { isActive, remainingSeconds, isLoading, timesUp, start, stop, dismissTimesUp }
}
