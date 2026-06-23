import { renderHook, act, waitFor } from '@testing-library/react'
import { useScreentimeCountdown } from '@/hooks/useScreentimeCountdown'

jest.mock('@/lib/queries', () => ({
  startScreentimeSession: jest.fn(),
  endScreentimeSession: jest.fn(),
  getOpenScreentimeSession: jest.fn(),
}))
jest.mock('@/lib/tts', () => ({ speak: jest.fn() }))

import { startScreentimeSession, endScreentimeSession, getOpenScreentimeSession } from '@/lib/queries'
import { speak } from '@/lib/tts'

const mockStart = startScreentimeSession as jest.Mock
const mockEnd = endScreentimeSession as jest.Mock
const mockGetOpen = getOpenScreentimeSession as jest.Mock
const mockSpeak = speak as jest.Mock

describe('useScreentimeCountdown', () => {
  const onSetBalance = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockStart.mockResolvedValue('sc-session-1')
    mockEnd.mockResolvedValue(undefined)
    mockGetOpen.mockResolvedValue(null)
    onSetBalance.mockResolvedValue(undefined)
  })

  afterEach(() => { jest.useRealTimers() })

  it('starts idle', async () => {
    const { result } = renderHook(() =>
      useScreentimeCountdown('qasim', 10, onSetBalance)
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isActive).toBe(false)
    expect(result.current.remainingSeconds).toBe(600)
  })

  it('start sets isActive', async () => {
    const { result } = renderHook(() =>
      useScreentimeCountdown('qasim', 10, onSetBalance)
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.start() })
    expect(result.current.isActive).toBe(true)
    expect(mockStart).toHaveBeenCalledWith('qasim')
  })

  it('stop saves unused minutes', async () => {
    const { result } = renderHook(() =>
      useScreentimeCountdown('qasim', 10, onSetBalance)
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.start() })
    act(() => { jest.advanceTimersByTime(120000) }) // 2 minutes used
    await act(async () => { await result.current.stop() })
    // 10 - 2 = 8 minutes remaining
    expect(onSetBalance).toHaveBeenCalledWith(8)
    expect(mockEnd).toHaveBeenCalledWith('sc-session-1', 2)
  })

  it('fires TTS and zeroes balance when countdown hits zero', async () => {
    const { result } = renderHook(() =>
      useScreentimeCountdown('qasim', 1, onSetBalance)
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.start() })
    await act(async () => { jest.advanceTimersByTime(60000) })
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.stringContaining("qasim")
    )
    expect(onSetBalance).toHaveBeenCalledWith(0)
  })
})
