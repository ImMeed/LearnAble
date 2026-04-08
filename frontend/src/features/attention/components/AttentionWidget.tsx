import { useState, useEffect, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceDot,
  Tooltip,
} from 'recharts';
import { FocusLabel, AttentionDataPoint } from '../types/attention';
import { useDraggableSnap } from '../hooks/useDraggableSnap';
import './AttentionWidget.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttentionWidgetProps {
  currentScore: number;
  currentLabel: FocusLabel;
  hasData: boolean;
  isStale: boolean;
  isDistracted: boolean;
  timeline: AttentionDataPoint[];
  active: boolean; // false = reset and hide
  unavailable?: boolean;
}

type WidgetMode = 'compact' | 'expanded' | 'minimized';

// ─── Constants ───────────────────────────────────────────────────────────────

const BORDER_COLOR: Record<FocusLabel, string> = {
  high:     '#22c55e',
  moderate: '#f59e0b',
  low:      '#ef4444',
};

const SCORE_COLOR: Record<FocusLabel, string> = {
  high:     '#22c55e',
  moderate: '#f59e0b',
  low:      '#ef4444',
};

const MIN_CHART_POINTS = 3;

// ─── Chart helpers ────────────────────────────────────────────────────────────

interface ChartPoint {
  timestamp: number;
  high: number | null;
  moderate: number | null;
  low: number | null;
  distraction: boolean;
}

function toChartData(timeline: AttentionDataPoint[]): ChartPoint[] {
  return timeline.map((pt) => ({
    timestamp: pt.timestamp,
    high:     pt.label === 'high'     ? pt.score : null,
    moderate: pt.label === 'moderate' ? pt.score : null,
    low:      pt.label === 'low'      ? pt.score : null,
    distraction: pt.distraction,
  }));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const score = pt.high ?? pt.moderate ?? pt.low;
  return (
    <div className="aw-chart-tooltip">
      <span className="aw-chart-tooltip__time">{formatTime(pt.timestamp)}</span>
      <span className="aw-chart-tooltip__score">{score}%</span>
      {pt.distraction && <span>⚠️</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AttentionWidget({
  currentScore,
  currentLabel,
  hasData,
  isStale,
  isDistracted,
  timeline,
  active,
  unavailable,
}: AttentionWidgetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<WidgetMode>('compact');
  const { corner, isDragging, dragPos, widgetRef, onDragHandleMouseDown } = useDraggableSnap('bottom-right');

  // Reset widget state when call ends or teacher deselected
  useEffect(() => {
    if (!active) {
      setMode('compact');
    }
  }, [active]);

  if (!active) return null;

  // ── Positioning ──
  const cornerStyles: Record<string, CSSProperties> = {
    'bottom-right': { bottom: '1.5rem', right: '1.5rem', top: 'auto',  left: 'auto'  },
    'bottom-left':  { bottom: '1.5rem', left:  '1.5rem', top: 'auto',  right: 'auto' },
    'top-right':    { top:    '1.5rem', right: '1.5rem', bottom: 'auto', left: 'auto' },
    'top-left':     { top:    '1.5rem', left:  '1.5rem', bottom: 'auto', right: 'auto' },
  };

  const posStyle: CSSProperties = isDragging && dragPos
    ? { left: dragPos.x, top: dragPos.y, bottom: 'auto', right: 'auto' }
    : cornerStyles[corner];

  // ── Derived values ──
  const borderColor = unavailable
    ? '#4b5563'
    : isDistracted
      ? '#ef4444'
      : (hasData && !isStale ? BORDER_COLOR[currentLabel] : '#4b5563');

  const scoreColor  = hasData && !isStale && !unavailable ? SCORE_COLOR[currentLabel] : '#6b7280';

  const labelText = unavailable
    ? t('attention.overlay.unavailable')
    : hasData && !isStale
      ? {
          high:     t('attention.overlay.highFocus'),
          moderate: t('attention.overlay.moderateFocus'),
          low:      t('attention.overlay.lowFocus'),
        }[currentLabel]
      : isStale
        ? t('attention.overlay.noData')
        : t('attention.overlay.waitingData');

  const chartData  = toChartData(timeline);
  const showChart  = timeline.length >= MIN_CHART_POINTS;
  const distractionPoints = chartData.filter((p) => p.distraction);

  // ─────────────────────────────────────────────────────────────────────────
  // MINIMIZED pill
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'minimized') {
    return (
      <div
        ref={widgetRef}
        className={`aw aw--minimized${isDragging ? ' aw--dragging' : ''}`}
        style={{ ...posStyle, '--aw-border': borderColor } as CSSProperties}
        onMouseDown={onDragHandleMouseDown}
        onClick={() => setMode('compact')}
        title={labelText}
        role="button"
        aria-label={`${t('attention.widget.restore')} — ${labelText} ${hasData && !isStale && !unavailable ? currentScore + '%' : ''}`}
      >
        <span className="aw-mini__dot" style={{ background: borderColor }} />
        <span className="aw-mini__score" style={{ color: scoreColor }}>
          {hasData && !isStale && !unavailable ? `${currentScore}%` : '—'}
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPACT + EXPANDED card
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={widgetRef}
      className={`aw${mode === 'expanded' ? ' aw--expanded' : ''}${isDragging ? ' aw--dragging' : ''}${isDistracted ? ' aw--distracted' : ''}`}
      style={{ ...posStyle, '--aw-border': borderColor } as CSSProperties}
      aria-label="Attention monitor"
    >
      {/* ── Drag handle / header ── */}
      <div
        className="aw__header"
        onMouseDown={onDragHandleMouseDown}
        title="Drag to move"
        tabIndex={-1}
      >
        <span className="aw__drag-hint">⠿</span>
        <span className="aw__header-label">{t('attention.panel.title')}</span>
        <div className="aw__header-actions">
          {mode === 'compact' && (
            <button
              className="aw__icon-btn"
              onClick={() => setMode('expanded')}
              title={t('attention.overlay.details')}
              aria-label={t('attention.overlay.details')}
            >
              ⤢
            </button>
          )}
          {mode === 'expanded' && (
            <button
              className="aw__icon-btn"
              onClick={() => setMode('compact')}
              title={t('attention.panel.back')}
              aria-label={t('attention.panel.back')}
            >
              ⤡
            </button>
          )}
          <button
            className="aw__icon-btn"
            onClick={() => setMode('minimized')}
            title={t('attention.widget.minimize')}
            aria-label={t('attention.widget.minimize')}
          >
            —
          </button>
        </div>
      </div>

      {/* ── Score row ── */}
      <div className="aw__score-row">
        <span className="aw__score" style={{ color: scoreColor }}>
          {hasData && !isStale && !unavailable ? `${currentScore}%` : '—'}
        </span>
        <span className="aw__label">{labelText}</span>
      </div>

      {/* ── Distraction banner (replaces separate toast) ── */}
      {isDistracted && (
        <div className="aw__distraction-row" role="alert" aria-live="assertive" aria-atomic="true">
          <span className="aw__distraction-icon">⚠️</span>
          <span className="aw__distraction-text">{t('attention.alert.title')}</span>
        </div>
      )}

      {/* ── Expanded chart ── */}
      {mode === 'expanded' && (
        <div className="aw__chart">
          {!showChart ? (
            <div className="aw__chart-empty">{t('attention.panel.collecting')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tickCount={4}
                  tickFormatter={(v) => `${v}%`}
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                  width={36}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="high"     stroke="#22c55e" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="moderate" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="low"      stroke="#ef4444" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                {distractionPoints.map((pt) => (
                  <ReferenceDot
                    key={`d-${pt.timestamp}`}
                    x={pt.timestamp}
                    y={pt.high ?? pt.moderate ?? pt.low ?? 0}
                    r={4}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Legend (expanded only) ── */}
      {mode === 'expanded' && (
        <div className="aw__legend">
          <span className="aw__legend-dot" style={{ background: '#22c55e' }} />
          <span className="aw__legend-text">{t('attention.panel.legendHigh')}</span>
          <span className="aw__legend-dot" style={{ background: '#f59e0b' }} />
          <span className="aw__legend-text">{t('attention.panel.legendModerate')}</span>
          <span className="aw__legend-dot" style={{ background: '#ef4444' }} />
          <span className="aw__legend-text">{t('attention.panel.legendLow')}</span>
        </div>
      )}
    </div>
  );
}
