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

const noop = () => {}
const noopAsync = async () => {}

describe('RecordsTable', () => {
  it('renders sessions in the table', () => {
    const sessions = [makeSession('1', 'qasim'), makeSession('2', 'muadz')]
    render(<RecordsTable sessions={sessions} onAdd={noop} onEdit={noop} onDelete={noop} />)
    // 'qasim' appears as both the filter button and the row badge
    expect(screen.getAllByText('qasim').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('muadz').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('+30 min')).toHaveLength(2)
  })

  it('filters by child when filter buttons clicked', async () => {
    const sessions = [makeSession('1', 'qasim'), makeSession('2', 'muadz')]
    render(<RecordsTable sessions={sessions} onAdd={noop} onEdit={noop} onDelete={noop} />)
    await userEvent.click(screen.getByRole('button', { name: /^qasim$/i }))
    // The qasim filter button + badge are both present; muadz badge should be gone
    expect(screen.getAllByText('qasim').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText('muadz').filter(el => el.tagName === 'SPAN')).toHaveLength(0)
  })

  it('shows empty state when no sessions', () => {
    render(<RecordsTable sessions={[]} onAdd={noop} onEdit={noop} onDelete={noop} />)
    expect(screen.getByText(/no reading sessions/i)).toBeInTheDocument()
  })
})
