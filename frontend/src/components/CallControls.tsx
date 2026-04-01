import React from "react";
import { useTranslation } from "react-i18next";

interface CallControlsProps {
  isMuted: boolean;
  isCamOff: boolean;
  onToggleMute: () => void;
  onToggleCam: () => void;
  onEndCall: () => void;
  disabled?: boolean;
}

export default function CallControls({
  isMuted,
  isCamOff,
  onToggleMute,
  onToggleCam,
  onEndCall,
  disabled = false,
}: CallControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="call-controls">
      <button
        className={`call-controls__btn ${isMuted ? "call-controls__btn--muted" : "call-controls__btn--active"}`}
        onClick={onToggleMute}
        disabled={disabled}
        aria-label={t(isMuted ? "call.unmute" : "call.mute")}
        title={t(isMuted ? "call.unmute" : "call.mute")}
      >
        {isMuted ? "🔇" : "🎤"}
      </button>

      <button
        className={`call-controls__btn ${isCamOff ? "call-controls__btn--muted" : "call-controls__btn--active"}`}
        onClick={onToggleCam}
        disabled={disabled}
        aria-label={t(isCamOff ? "call.cameraOn" : "call.cameraOff")}
        title={t(isCamOff ? "call.cameraOn" : "call.cameraOff")}
      >
        {isCamOff ? "📷" : "📹"}
      </button>

      <button
        className="call-controls__btn call-controls__btn--danger"
        onClick={onEndCall}
        aria-label={t("call.endCall")}
        title={t("call.endCall")}
      >
        ✕
      </button>
    </div>
  );
}
