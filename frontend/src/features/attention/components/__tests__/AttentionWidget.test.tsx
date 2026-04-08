import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttentionWidget from '../AttentionWidget';

// Recharts uses ResizeObserver and SVG APIs not available in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart:   ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line:        () => null,
  XAxis:       () => null,
  YAxis:       () => null,
  CartesianGrid: () => null,
  ReferenceDot:  () => null,
  Tooltip:       () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  currentScore: 82,
  currentLabel: 'high' as const,
  hasData: true,
  isStale: false,
  isDistracted: false,
  timeline: [],
  active: true,
};

describe('AttentionWidget', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(<AttentionWidget {...defaultProps} active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the score and label when data is available', () => {
    render(<AttentionWidget {...defaultProps} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('attention.overlay.highFocus')).toBeInTheDocument();
  });

  it('renders "—" when hasData is false', () => {
    render(<AttentionWidget {...defaultProps} hasData={false} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('attention.overlay.waitingData')).toBeInTheDocument();
  });

  it('renders stale label when isStale is true', () => {
    render(<AttentionWidget {...defaultProps} isStale={true} />);
    expect(screen.getByText('attention.overlay.noData')).toBeInTheDocument();
  });

  it('renders unavailable label when unavailable is true', () => {
    render(<AttentionWidget {...defaultProps} unavailable={true} />);
    expect(screen.getByText('attention.overlay.unavailable')).toBeInTheDocument();
  });

  it('does not render the distraction row when isDistracted is false', () => {
    render(<AttentionWidget {...defaultProps} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders distraction row with role=alert when isDistracted is true', () => {
    render(<AttentionWidget {...defaultProps} isDistracted={true} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByText('attention.alert.title')).toBeInTheDocument();
  });

  it('distraction row disappears when isDistracted becomes false', () => {
    const { rerender } = render(<AttentionWidget {...defaultProps} isDistracted={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<AttentionWidget {...defaultProps} isDistracted={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('expand button switches to expanded mode showing chart area', async () => {
    render(<AttentionWidget {...defaultProps} />);
    const expandBtn = screen.getByLabelText('attention.overlay.details');
    await userEvent.click(expandBtn);
    // Collapse button should now be visible instead of expand
    expect(screen.getByLabelText('attention.panel.back')).toBeInTheDocument();
    expect(screen.queryByLabelText('attention.overlay.details')).not.toBeInTheDocument();
  });

  it('collapse button returns to compact mode', async () => {
    render(<AttentionWidget {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('attention.overlay.details'));
    await userEvent.click(screen.getByLabelText('attention.panel.back'));
    expect(screen.getByLabelText('attention.overlay.details')).toBeInTheDocument();
  });

  it('minimize button switches to pill mode', async () => {
    render(<AttentionWidget {...defaultProps} />);
    const minimizeBtn = screen.getByLabelText('attention.widget.minimize');
    await userEvent.click(minimizeBtn);
    // In pill mode, the expand/minimize buttons are gone, score is still visible
    expect(screen.queryByLabelText('attention.overlay.details')).not.toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument(); // pill still shows score
  });

  it('clicking the minimized pill restores compact mode', async () => {
    render(<AttentionWidget {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('attention.widget.minimize'));
    // Pill is now a role=button
    const pill = screen.getByRole('button', { name: /attention.widget.restore/i });
    await userEvent.click(pill);
    expect(screen.getByLabelText('attention.overlay.details')).toBeInTheDocument();
  });
});
