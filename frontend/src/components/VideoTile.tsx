import React, { useRef, useEffect } from "react";

interface VideoTileProps {
  stream: MediaStream | null;
  muted: boolean;
  label?: string;
  variant: "main" | "pip";
  isCamOff?: boolean;
  // remoteMuted: show a mic-off badge overlay on the tile
  remoteMuted?: boolean;
  children?: React.ReactNode;
  consentBadgeLabel?: string;
}

export default function VideoTile({ stream, muted, label, variant, isCamOff, remoteMuted, children, consentBadgeLabel }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    let resumeOnGesture: (() => void) | null = null;

    const clearGestureHandlers = () => {
      if (!resumeOnGesture) return;
      window.removeEventListener("pointerdown", resumeOnGesture);
      window.removeEventListener("keydown", resumeOnGesture);
      resumeOnGesture = null;
    };

    if (video) {
      video.srcObject = stream ?? null;
      video.muted = muted;
      if (stream) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Some browsers block autoplay with sound until a user gesture.
            // Do not force-mute remote media; resume on first gesture instead.
            resumeOnGesture = () => {
              clearGestureHandlers();
              void video.play().catch(() => {
                // Leave element attached even if playback is still blocked.
              });
            };
            window.addEventListener("pointerdown", resumeOnGesture, { once: true });
            window.addEventListener("keydown", resumeOnGesture, { once: true });
          });
        }
      }
    }
    return () => {
      clearGestureHandlers();
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream, muted]);

  const hasLiveVideoTrack = !!stream?.getVideoTracks().some((track) => track.readyState === "live");
  const showPlaceholder = !stream || isCamOff || !hasLiveVideoTrack;
  // Only show the "camera is off" tag when the cam was explicitly turned off
  // (stream exists but isCamOff is true), not when there's simply no stream yet.
  const camExplicitlyOff = !!stream && !!isCamOff;

  return (
    <div className={`video-tile video-tile--${variant}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ display: showPlaceholder ? "none" : "block" }}
      />

      {showPlaceholder && (
        <div className="video-tile__placeholder">
          <div className="video-tile__avatar">
            <span className="video-tile__avatar-icon">👤</span>
          </div>
          {label && <span className="video-tile__label">{label}</span>}
          {camExplicitlyOff && (
            <div className="video-tile__cam-off-tag">
              <span>📷</span>
              <span>Camera off</span>
            </div>
          )}
        </div>
      )}

      {remoteMuted && (
        <div className="video-tile__muted-badge" title="Microphone off">
          🔇
        </div>
      )}
      {consentBadgeLabel && (
        <div className="video-tile__consent-badge" title={consentBadgeLabel}>
          👁
        </div>
      )}
      {children}
    </div>
  );
}
