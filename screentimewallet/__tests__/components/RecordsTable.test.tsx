import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordsTable } from '@/components/parent/RecordsTable'
import type { ReadingSession } from '@/types'

const makeSession = (id: string, child: 'qasim' | 'muadz', offsetMs = 0): ReadingSession => ({
  id,
  child_name: child,
  started_at: new Date(Date.now() - offsetMs - 3600000).toISOString(),
  ended_at: new Date(Date.now() - offsetMs).toISOString(),
  duration_minutes: 30,
  created_at: new Date().toISOString(),
})

describe('RecordsTable', () => {
  it('renders sessions in the table', () => {
    const sessions = [makeSession('1', 'qasim'), makeSession('2', 'muadz')]
    render(<RecordsTable sessions={sessions} />)
    expect(screen.getByText('qasim')).toBeInTheDocument()
    expect(screen.getByText('muadz')).toBeInTheDocument()
    expect(screen.getAllByText('+30 min')).toHaveLength(2)
  })

  it('filters by child when filter buttons clicked', async () => {
    const sessions = [makeSession('1', 'qasim'), makeSession('2', 'muadz')]
    render(<RecordsTable sessions={sessions} />)
    await userEvent.click(screen.getByRole('button', { name: /qasim/i }))
    expect(screen.getByText('qasim')).toBeInTheDocument()
    expect(screen.queryByText('muadz')).not.toBeInTheDocument()
  })

  it('shows empty state when no sessions', () => {
    render(<RecordsTable sessions={[]} />)
    expect(screen.getByText(/no reading sessions/i)).toBeInTheDocument()
  })
})
