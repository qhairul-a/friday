'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { startReadingSession, endReadingSession, getOpenReadingSession } from '@/lib/queries'
import type { ChildName } from '@/types'

export function useReadingTimer(child: ChildName, onEarned: (minutes: number) => void) {
  const [isActive, setIsActive] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const sessionIdRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    getOpenReadingSession(child).then(open => {
      if (open) {
        sessionIdRef.current = open.id
        startTimeRef.current = new Date(open.started_at).getTime()
        setIsActive(true)
      }
      setIsLoading(false)
    })
  }, [child])

  useEffect(() => {
    if (!isActive) return
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive])

  const start = useCallback(async () => {
    const id = await startReadingSession(child)
    sessionIdRef.current = id
    startTimeRef.current = Date.now()
    setElapsedSeconds(0)
    setIsActive(true)
  }, [child])

  const stop = useCallback(async () => {
    if (!sessionIdRef.current) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    const earned = Math.floor(elapsedSeconds / 60)
    await endReadingSession(sessionIdRef.current, earned)
    onEarned(earned)
    sessionIdRef.current = null
    setIsActive(false)
    setElapsedSeconds(0)
  }, [elapsedSeconds, onEarned])

  return { isActive, elapsedSeconds, isLoading, start, stop }
}
