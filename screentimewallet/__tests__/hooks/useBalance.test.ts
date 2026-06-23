import { renderHook, act, waitFor } from '@testing-library/react'
import { useBalance } from '@/hooks/useBalance'

jest.mock('@/lib/queries', () => ({
  getBalance: jest.fn(),
  addToBalance: jest.fn(),
  setBalance: jest.fn(),
}))

import { getBalance, addToBalance, setBalance } from '@/lib/queries'

const mockGetBalance = getBalance as jest.Mock
const mockAddToBalance = addToBalance as jest.Mock
const mockSetBalance = setBalance as jest.Mock

describe('useBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetBalance.mockResolvedValue(10)
    mockAddToBalance.mockResolvedValue(undefined)
    mockSetBalance.mockResolvedValue(undefined)
  })

  it('loads balance on mount', async () => {
    const { result } = renderHook(() => useBalance('qasim'))
    await waitFor(() => expect(result.current.balance).toBe(10))
    expect(mockGetBalance).toHaveBeenCalledWith('qasim')
  })

  it('add increases balance optimistically', async () => {
    const { result } = renderHook(() => useBalance('qasim'))
    await waitFor(() => expect(result.current.balance).toBe(10))
    await act(async () => { await result.current.add(5) })
    expect(result.current.balance).toBe(15)
    expect(mockAddToBalance).toHaveBeenCalledWith('qasim', 5)
  })

  it('set updates balance', async () => {
    const { result } = renderHook(() => useBalance('qasim'))
    await waitFor(() => expect(result.current.balance).toBe(10))
    await act(async () => { await result.current.set(0) })
    expect(result.current.balance).toBe(0)
    expect(mockSetBalance).toHaveBeenCalledWith('qasim', 0)
  })
})
