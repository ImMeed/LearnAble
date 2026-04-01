import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useSignaling } from "../hooks/useSignaling";
import { useWebRTC } from "../hooks/useWebRTC";
import { CallState } from "../hooks/types";
import VideoTile from "../components/VideoTile";
import CallControls from "../components/CallControls";
import "./CallPage.css";

export function CallRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/call/${uuidv4()}`, { replace: true });
  }, [navigate]);
  return null;
}

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [callState, setCallState] = useState<CallState>("idle");
  const [copied, setCopied] = useState(false);

  // Redirect if no roomId
  useEffect(() => {
    if (!roomId) {
      navigate(`/call/${uuidv4()}`, { replace: true });
    }
  }, [roomId, navigate]);

  // Hooks
  const {
    localStream,
    mediaError,
    isMuted,
    isCamOff,
    toggleMute,
    toggleCamera,
    stopAllTracks,
  } = useWebRTC();

  const {
    lastMessage,
    isConnected,
    connectionError,
  } = useSignaling(roomId);

  // ── State machine transitions ──
  useEffect(() => {
    if (mediaError) {
      setCallState("error");
      return;
    }
    if (connectionError === "Room is full.") {
      setCallState("room_full");
      return;
    }
    if (localStream && callState === "idle") {
      setCallState("waiting");
    }
  }, [localStream, mediaError, connectionError]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "peer_joined" || lastMessage.type === "offer") {
      setCallState("connected");
    } else if (lastMessage.type === "peer_left") {
      setCallState("peer_left");
    }
  }, [lastMessage]);

  // ── End call ──
  const handleEndCall = () => {
    stopAllTracks();
    navigate("/");
  };

  // ── Copy room link ──
  const handleCopyLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!roomId) return null;

  // ── Render based on callState ──
  return (
    <div className="call-page">
      {/* ── IDLE: Getting camera ready ── */}
      {callState === "idle" && (
        <div className="call-overlay">
          <div className="call-spinner" />
          <p>Getting your camera ready…</p>
        </div>
      )}

      {/* ── WAITING: Alone in room ── */}
      {callState === "waiting" && (
        <>
          <VideoTile stream={null} muted={false} label="Remote" variant="main" />
          <VideoTile stream={localStream} muted={true} label="You" variant="pip" isCamOff={isCamOff} />

          <div className="call-overlay">
            <div className="call-overlay__card">
              <div className="call-overlay__title">
                <span className="call-pulse-dot" />
                Waiting for someone to join…
              </div>
              <p className="call-overlay__text">
                Share the link below to invite someone to your call.
              </p>
              <div className="call-waiting__link-box">
                <span>{window.location.href}</span>
                <button className="call-waiting__copy-btn" onClick={handleCopyLink}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <CallControls
            isMuted={isMuted}
            isCamOff={isCamOff}
            onToggleMute={toggleMute}
            onToggleCam={toggleCamera}
            onEndCall={handleEndCall}
            disabled={false}
          />
        </>
      )}

      {/* ── CONNECTED: Both peers in call ── */}
      {callState === "connected" && (
        <>
          {/* Remote stream will be wired in Phase 03 — shows placeholder for now */}
          <VideoTile stream={null} muted={false} label="Remote" variant="main" />
          <VideoTile stream={localStream} muted={true} label="You" variant="pip" isCamOff={isCamOff} />

          <CallControls
            isMuted={isMuted}
            isCamOff={isCamOff}
            onToggleMute={toggleMute}
            onToggleCam={toggleCamera}
            onEndCall={handleEndCall}
          />
        </>
      )}

      {/* ── ROOM FULL ── */}
      {callState === "room_full" && (
        <div className="call-overlay">
          <div className="call-overlay__card">
            <div className="call-overlay__title">This call is already in progress</div>
            <p className="call-overlay__text">
              The maximum number of participants has been reached.
            </p>
            <button className="call-overlay__btn" onClick={() => navigate("/")}>
              Return Home
            </button>
          </div>
        </div>
      )}

      {/* ── PEER LEFT ── */}
      {callState === "peer_left" && (
        <div className="call-overlay">
          <div className="call-overlay__card">
            <div className="call-overlay__title">The other participant has left the call</div>
            <p className="call-overlay__text">
              The call has ended because the other person disconnected.
            </p>
            <button className="call-overlay__btn" onClick={() => navigate("/")}>
              Return Home
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {callState === "error" && (
        <div className="call-overlay">
          <div className="call-overlay__card">
            <div className="call-overlay__title">
              {mediaError === "CAMERA_DENIED"
                ? "Camera access denied"
                : mediaError === "NO_DEVICE"
                ? "No camera found"
                : "Something went wrong"}
            </div>
            <p className="call-overlay__text">
              {mediaError === "CAMERA_DENIED"
                ? "Camera access was denied. Please enable camera permissions in your browser settings."
                : mediaError === "NO_DEVICE"
                ? "No camera or microphone was found on your device."
                : "Something went wrong. Please try again."}
            </p>
            <button className="call-overlay__btn" onClick={() => navigate("/")}>
              Return Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
