import { renderHook, act, waitFor } from '@testing-library/react'
import { useReadingTimer } from '@/hooks/useReadingTimer'

jest.mock('@/lib/queries', () => ({
  startReadingSession: jest.fn(),
  endReadingSession: jest.fn(),
  getOpenReadingSession: jest.fn(),
}))

import { startReadingSession, endReadingSession, getOpenReadingSession } from '@/lib/queries'

const mockStart = startReadingSession as jest.Mock
const mockEnd = endReadingSession as jest.Mock
const mockGetOpen = getOpenReadingSession as jest.Mock

describe('useReadingTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockStart.mockResolvedValue('session-123')
    mockEnd.mockResolvedValue(undefined)
    mockGetOpen.mockResolvedValue(null)
  })

  afterEach(() => { jest.useRealTimers() })

  it('starts in idle state', async () => {
    const { result } = renderHook(() => useReadingTimer('qasim', jest.fn()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isActive).toBe(false)
    expect(result.current.elapsedSeconds).toBe(0)
  })

  it('start sets isActive and calls startReadingSession', async () => {
    const { result } = renderHook(() => useReadingTimer('qasim', jest.fn()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.start() })
    expect(result.current.isActive).toBe(true)
    expect(mockStart).toHaveBeenCalledWith('qasim')
  })

  it('stop calls endReadingSession and onEarned callback', async () => {
    const onEarned = jest.fn()
    const { result } = renderHook(() => useReadingTimer('qasim', onEarned))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.start() })
    // advance 90 seconds = 1.5 minutes → floor to 1 minute earned
    act(() => { jest.advanceTimersByTime(90000) })
    await act(async () => { await result.current.stop() })
    expect(mockEnd).toHaveBeenCalledWith('session-123', 1)
    expect(onEarned).toHaveBeenCalledWith(1)
    expect(result.current.isActive).toBe(false)
  })
})
