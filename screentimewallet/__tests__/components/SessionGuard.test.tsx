import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionGuard } from '@/components/child/SessionGuard'

jest.mock('@/lib/queries', () => ({
  getOpenReadingSession: jest.fn(),
  getOpenScreentimeSession: jest.fn(),
  endReadingSession: jest.fn(),
  endScreentimeSession: jest.fn(),
  addToBalance: jest.fn(),
}))

import {
  getOpenReadingSession,
  getOpenScreentimeSession,
  endReadingSession,
  endScreentimeSession,
  addToBalance,
} from '@/lib/queries'

const mockGetReading = getOpenReadingSession as jest.Mock
const mockGetScreentime = getOpenScreentimeSession as jest.Mock
const mockEndReading = endReadingSession as jest.Mock
const mockEndScreentime = endScreentimeSession as jest.Mock
const mockAdd = addToBalance as jest.Mock

describe('SessionGuard', () => {
  const onResolved = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockEndReading.mockResolvedValue(undefined)
    mockEndScreentime.mockResolvedValue(undefined)
    mockAdd.mockResolvedValue(undefined)
    onResolved.mockResolvedValue(undefined)
  })

  it('renders nothing when no open sessions', async () => {
    mockGetReading.mockResolvedValue(null)
    mockGetScreentime.mockResolvedValue(null)
    const { container } = render(<SessionGuard child="qasim" onResolved={onResolved} />)
    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('shows prompt when open reading session found', async () => {
    mockGetReading.mockResolvedValue({
      id: 'r1', child_name: 'qasim',
      started_at: new Date(Date.now() - 300000).toISOString(),
      ended_at: null, duration_minutes: null, created_at: new Date().toISOString(),
    })
    mockGetScreentime.mockResolvedValue(null)
    render(<SessionGuard child="qasim" onResolved={onResolved} />)
    await waitFor(() => expect(screen.getByText(/session in progress/i)).toBeInTheDocument())
  })

  it('clicking Yes ends the reading session and calls onResolved', async () => {
    mockGetReading.mockResolvedValue({
      id: 'r1', child_name: 'qasim',
      started_at: new Date(Date.now() - 300000).toISOString(),
      ended_at: null, duration_minutes: null, created_at: new Date().toISOString(),
    })
    mockGetScreentime.mockResolvedValue(null)
    render(<SessionGuard child="qasim" onResolved={onResolved} />)
    await waitFor(() => screen.getByText(/yes, i finished/i))
    await userEvent.click(screen.getByText(/yes, i finished/i))
    await waitFor(() => expect(mockEndReading).toHaveBeenCalled())
    expect(mockAdd).toHaveBeenCalled()
    expect(onResolved).toHaveBeenCalled()
  })

  it('clicking No dismisses prompt and calls onResolved (hooks resume the timer)', async () => {
    mockGetReading.mockResolvedValue({
      id: 'r1', child_name: 'qasim',
      started_at: new Date(Date.now() - 300000).toISOString(),
      ended_at: null, duration_minutes: null, created_at: new Date().toISOString(),
    })
    mockGetScreentime.mockResolvedValue(null)
    render(<SessionGuard child="qasim" onResolved={onResolved} />)
    await waitFor(() => screen.getByText(/no, resume/i))
    await userEvent.click(screen.getByText(/no, resume/i))
    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    expect(mockEndReading).not.toHaveBeenCalled()
  })
})
