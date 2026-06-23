import { render, screen } from '@testing-library/react'
import { AnalyticsView } from '@/components/parent/AnalyticsView'
import type { ReadingSession, ScreentimeSession } from '@/types'

// Mock Recharts to avoid canvas issues in jsdom
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const makeReading = (child: 'qasim' | 'muadz', minutesAgo: number, duration: number): ReadingSession => {
  const end = new Date(Date.now() - minutesAgo * 60000)
  const start = new Date(end.getTime() - duration * 60000)
  return {
    id: `r-${child}-${minutesAgo}`,
    child_name: child,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    duration_minutes: duration,
    created_at: end.toISOString(),
  }
}

const makeScreentime = (child: 'qasim' | 'muadz', minutesAgo: number, used: number): ScreentimeSession => {
  const end = new Date(Date.now() - minutesAgo * 60000)
  const start = new Date(end.getTime() - used * 60000)
  return {
    id: `s-${child}-${minutesAgo}`,
    child_name: child,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    duration_used_minutes: used,
    created_at: end.toISOString(),
  }
}

describe('AnalyticsView', () => {
  it('renders stat cards', () => {
    render(
      <AnalyticsView
        readingSessions={[makeReading('qasim', 10, 30)]}
        screentimeSessions={[makeScreentime('qasim', 5, 20)]}
      />
    )
    expect(screen.getByText(/utilization/i)).toBeInTheDocument()
    expect(screen.getByText(/reading this week/i)).toBeInTheDocument()
  })

  it('renders two bar charts', () => {
    render(
      <AnalyticsView
        readingSessions={[makeReading('qasim', 10, 30)]}
        screentimeSessions={[makeScreentime('qasim', 5, 20)]}
      />
    )
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2)
  })

  it('calculates utilization correctly', () => {
    // 20 used of 30 earned = 66.7%
    render(
      <AnalyticsView
        readingSessions={[makeReading('qasim', 10, 30)]}
        screentimeSessions={[makeScreentime('qasim', 5, 20)]}
      />
    )
    expect(screen.getByText(/66\.7%|66\.6%|67%/)).toBeInTheDocument()
  })
})
