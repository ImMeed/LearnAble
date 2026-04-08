// frontend/src/features/attention/components/AttentionPanel.tsx

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
import { AttentionDataPoint } from '../types/attention';
import './AttentionPanel.css';

interface AttentionPanelProps {
  timeline: AttentionDataPoint[];
  onBack: () => void;
}

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

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Custom tooltip shown on hover
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  const score = pt.high ?? pt.moderate ?? pt.low;
  return (
    <div className="attention-panel__tooltip">
      <span className="attention-panel__tooltip-time">{formatTimestamp(pt.timestamp)}</span>
      <span className="attention-panel__tooltip-score">{score}%</span>
      {pt.distraction && (
        <span className="attention-panel__tooltip-distraction">⚠️</span>
      )}
    </div>
  );
}

const MIN_POINTS_TO_SHOW_CHART = 3;

export default function AttentionPanel({ timeline, onBack }: AttentionPanelProps) {
  const { t } = useTranslation();
  const data = toChartData(timeline);

  // Distraction event markers
  const distractionPoints = data.filter((pt) => pt.distraction);

  const showChart = timeline.length >= MIN_POINTS_TO_SHOW_CHART;

  return (
    <div className="attention-panel">
      <div className="attention-panel__header">
        <h3 className="attention-panel__title">{t('attention.panel.title')}</h3>
        <button
          className="attention-panel__back-btn"
          onClick={onBack}
          aria-label={t('attention.panel.back')}
        >
          {t('attention.panel.back')}
        </button>
      </div>

      <div className="attention-panel__chart-area">
        {!showChart ? (
          <div className="attention-panel__empty">
            <span>{t('attention.panel.collecting')}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />

              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                interval="preserveStartEnd"
              />

              <YAxis
                domain={[0, 100]}
                tickCount={5}
                tickFormatter={(v) => `${v}%`}
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                width={40}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Three colored lines — one per focus zone */}
              <Line
                dataKey="high"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="moderate"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="low"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* Distraction event markers */}
              {distractionPoints.map((pt) => {
                const score = pt.high ?? pt.moderate ?? pt.low ?? 0;
                return (
                  <ReferenceDot
                    key={`distraction-${pt.timestamp}`}
                    x={pt.timestamp}
                    y={score}
                    r={4}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="attention-panel__legend">
        <span className="attention-panel__legend-item attention-panel__legend-item--high">
          {t('attention.panel.legendHigh')}
        </span>
        <span className="attention-panel__legend-item attention-panel__legend-item--moderate">
          {t('attention.panel.legendModerate')}
        </span>
        <span className="attention-panel__legend-item attention-panel__legend-item--low">
          {t('attention.panel.legendLow')}
        </span>
      </div>
    </div>
  );
}
