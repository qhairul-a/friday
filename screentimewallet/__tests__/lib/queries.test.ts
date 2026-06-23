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
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'update', 'eq', 'is', 'not', 'order', 'limit']
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain['single'] = jest.fn().mockResolvedValue(returnValue)
  chain['maybeSingle'] = jest.fn().mockResolvedValue(returnValue)
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
