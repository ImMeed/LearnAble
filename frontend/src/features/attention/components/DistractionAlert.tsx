// frontend/src/features/attention/components/DistractionAlert.tsx

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './DistractionAlert.css';

interface DistractionAlertProps {
  isDistracted: boolean;
}

const AUTO_DISMISS_MS = 6_000;
const COOLDOWN_MS = 30_000;

export default function DistractionAlert({ isDistracted }: DistractionAlertProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownUntilRef = useRef<number>(0); // timestamp until which alerts are suppressed

  const dismiss = () => {
    setVisible(false);
    if (autoDismissTimerRef.current !== null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isDistracted) return;

    const now = Date.now();
    if (now < cooldownUntilRef.current) return; // still in cooldown

    // Show alert
    setVisible(true);
    cooldownUntilRef.current = now + COOLDOWN_MS;

    // Auto-dismiss
    autoDismissTimerRef.current = setTimeout(() => {
      setVisible(false);
      autoDismissTimerRef.current = null;
    }, AUTO_DISMISS_MS);
  }, [isDistracted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoDismissTimerRef.current !== null) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="distraction-alert" role="alert" aria-live="assertive">
      <div className="distraction-alert__content">
        <span className="distraction-alert__icon" aria-hidden="true">⚠️</span>
        <div className="distraction-alert__text">
          <strong className="distraction-alert__title">{t('attention.alert.title')}</strong>
          <span className="distraction-alert__body">{t('attention.alert.body')}</span>
        </div>
        <button
          className="distraction-alert__dismiss"
          onClick={dismiss}
          aria-label={t('attention.alert.dismiss')}
        >
          {t('attention.alert.dismiss')}
        </button>
      </div>
    </div>
  );
}
