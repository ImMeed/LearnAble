// frontend/src/features/attention/components/AttentionOverlay.tsx

import { useTranslation } from 'react-i18next';
import { FocusLabel } from '../types/attention';
import './AttentionOverlay.css';

interface AttentionOverlayProps {
  score: number;
  label: FocusLabel;
  hasData: boolean;
  isStale: boolean;
  onDetailsClick: () => void;
}

const COLOR_MAP: Record<FocusLabel, string> = {
  high: '#22c55e',
  moderate: '#f59e0b',
  low: '#ef4444',
};

export default function AttentionOverlay({
  score,
  label,
  hasData,
  isStale,
  onDetailsClick,
}: AttentionOverlayProps) {
  const { t } = useTranslation();

  const labelText = {
    high: t('attention.overlay.highFocus'),
    moderate: t('attention.overlay.moderateFocus'),
    low: t('attention.overlay.lowFocus'),
  };

  if (!hasData || isStale) {
    const message = isStale
      ? t('attention.overlay.noData')
      : t('attention.overlay.waitingData');

    return (
      <div className="attention-overlay attention-overlay--waiting">
        <span className="attention-overlay__waiting-text">{message}</span>
      </div>
    );
  }

  return (
    <div className="attention-overlay">
      <div
        className="attention-overlay__dot"
        style={{ backgroundColor: COLOR_MAP[label] }}
        aria-hidden="true"
      />
      <span className="attention-overlay__label">{labelText[label]}</span>
      <span className="attention-overlay__score">{score}%</span>
      <button
        className="attention-overlay__details-btn"
        onClick={onDetailsClick}
        aria-label={t('attention.overlay.details')}
        title={t('attention.overlay.details')}
      >
        ≡
      </button>
    </div>
  );
}
