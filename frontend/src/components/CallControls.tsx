import React from "react";

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
  return (
    <div className="call-controls">
      <button
        className={`call-controls__btn ${isMuted ? "call-controls__btn--muted" : "call-controls__btn--active"}`}
        onClick={onToggleMute}
        disabled={disabled}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇" : "🎤"}
      </button>

      <button
        className={`call-controls__btn ${isCamOff ? "call-controls__btn--muted" : "call-controls__btn--active"}`}
        onClick={onToggleCam}
        disabled={disabled}
        aria-label={isCamOff ? "Turn camera on" : "Turn camera off"}
        title={isCamOff ? "Camera On" : "Camera Off"}
      >
        {isCamOff ? "📷" : "📹"}
      </button>

      <button
        className="call-controls__btn call-controls__btn--danger"
        onClick={onEndCall}
        aria-label="End call"
        title="End Call"
      >
        ✕
      </button>
    </div>
  );
}
