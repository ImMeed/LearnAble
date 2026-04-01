import React, { useRef, useEffect } from "react";

interface VideoTileProps {
  stream: MediaStream | null;
  muted: boolean;
  label?: string;
  variant: "main" | "pip";
  isCamOff?: boolean;
}

export default function VideoTile({ stream, muted, label, variant, isCamOff }: VideoTileProps) {
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
          <span className="video-tile__placeholder-icon">👤</span>
          {label && <span>{label}</span>}
        </div>
      )}
    </div>
  );
}
