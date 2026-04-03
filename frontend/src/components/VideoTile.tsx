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
}

export default function VideoTile({ stream, muted, label, variant, isCamOff, remoteMuted, children }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  const showPlaceholder = !stream || isCamOff;
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
      {children}
    </div>
  );
}
