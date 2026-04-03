import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";
import { useSignaling } from "../hooks/useSignaling";
import { useWebRTC } from "../hooks/useWebRTC";
import { CallState } from "../hooks/types";
import { useConnectionQuality } from "../hooks/useConnectionQuality";
import { ConnectionBadge } from "../components/ConnectionBadge";
import VideoTile from "../components/VideoTile";
import CallControls from "../components/CallControls";
import RolePickerScreen from '../features/attention/components/RolePickerScreen';
import type { UserRole } from '../features/attention/types/attention';
import { useAttentionProcessor } from '../features/attention/hooks/useAttentionProcessor';
import { useAttentionReceiver } from '../features/attention/hooks/useAttentionReceiver';
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
  const { t } = useTranslation();
  const [callState, setCallState] = useState<CallState>("idle");
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  
  const actionBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!roomId) {
      navigate(`/call/${uuidv4()}`, { replace: true });
    }
  }, [roomId, navigate]);

  // Viewport enforcement for mobile
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    const originalContent = meta.content;
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

    return () => {
      if (meta) meta.content = originalContent;
    };
  }, []);

  const signaling = useSignaling(roomId);
  const {
    localStream,
    mediaError,
    isMuted,
    isCamOff,
    toggleMute,
    toggleCamera,
    stopAllTracks,
    remoteStream,
    peerConnected,
    peerError,
    destroyPeer,
    peerRef,
  } = useWebRTC({
    isInitiator: signaling.isInitiator,
    peerJoined: signaling.peerJoined,
    incomingSignal: signaling.incomingSignal,
    sendMessage: signaling.sendMessage,
  });

  const connectionQuality = useConnectionQuality({ peerRef, peerConnected });

  const { isConnected, isReconnecting, peerLeft, roomFull, connectionError, remoteMediaState } = signaling;

  // Broadcast local media state to peer whenever cam/mute changes OR peer first connects
  const prevPeerConnected = useRef(false);
  const prevIsCamOff = useRef(isCamOff);
  const prevIsMuted = useRef(isMuted);
  useEffect(() => {
    const peerJustConnected = peerConnected && !prevPeerConnected.current;
    const stateChanged = prevIsCamOff.current !== isCamOff || prevIsMuted.current !== isMuted;

    prevPeerConnected.current = peerConnected;
    prevIsCamOff.current = isCamOff;
    prevIsMuted.current = isMuted;

    if (peerConnected && (peerJustConnected || stateChanged)) {
      signaling.sendMessage({ type: "media_state", video: !isCamOff, audio: !isMuted });
    }
  }, [isCamOff, isMuted, peerConnected, signaling]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "m" || e.key === "M") toggleMute();
      if (e.key === "v" || e.key === "V") toggleCamera();
      if (e.key === "Escape") {
        destroyPeer();
        stopAllTracks();
        navigate("/");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMute, toggleCamera, destroyPeer, stopAllTracks, navigate]);

  useEffect(() => {
    if (roomFull) {
      setCallState("room_full");
    } else if (mediaError) {
      setCallState("error");
    } else if (peerLeft) {
      setCallState("peer_left");
    } else if (peerError || connectionError) {
      setCallState("error");
    } else if (peerConnected) {
      setCallState("connected");
    } else if (localStream && isConnected) {
      setCallState("waiting");
    } else {
      setCallState("idle");
    }
  }, [roomFull, mediaError, peerLeft, peerError, connectionError, peerConnected, localStream, isConnected]);

  useEffect(() => {
    if (peerLeft) {
      destroyPeer();
    }
  }, [peerLeft, destroyPeer]);

  // Auto-focus action button on error states for accessibility
  useEffect(() => {
    if (["room_full", "peer_left", "error"].includes(callState)) {
      actionBtnRef.current?.focus();
    }
  }, [callState]);

  const handleEndCall = useCallback(() => {
    destroyPeer();
    stopAllTracks();
    navigate("/");
  }, [destroyPeer, stopAllTracks, navigate]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      destroyPeer();
      stopAllTracks();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [destroyPeer, stopAllTracks]);

  const handleCopyLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Show the role picker once the room is joined, until the user picks a role
  const showRolePicker =
    role === null &&
    (callState === "waiting" || callState === "connected");

  // Mount attention processor on the student side only
  useAttentionProcessor({
    localStream,
    enabled: role === 'student' && !!localStream,
    sendMessage: signaling.sendMessage,
  });

  const attentionState = useAttentionReceiver({
    incomingMetrics: signaling.incomingAttentionMetrics,
    enabled: role === 'teacher',
  });

  if (!roomId) return null;

  return (
    <div className="call-page">
      {/* Live region for status changes */}
      <div role="status" aria-live="polite" className="sr-only">
        {callState === "waiting" && t("call.waitingForPeer")}
        {callState === "connected" && t("call.connected")}
        {callState === "peer_left" && t("call.peerLeft")}
      </div>

      {showRolePicker && (
        <RolePickerScreen onSelectRole={setRole} />
      )}

      {isReconnecting && (
        <div className="call-reconnecting-banner">
          <div className="call-spinner call-spinner--small" />
          <span>{t("call.reconnecting")}</span>
        </div>
      )}

      {callState === "connected" && <ConnectionBadge quality={connectionQuality} />}

      {callState === "idle" && (
        <div className="call-overlay">
          <div className="call-spinner" />
          <p>{t("call.gettingCamera")}</p>
        </div>
      )}

      {callState === "waiting" && (
        <>
          <VideoTile stream={null} muted={false} label="Remote" variant="main" />
          <VideoTile stream={localStream} muted={true} label="You" variant="pip" isCamOff={isCamOff} />

          <div className="call-overlay">
            <div className="call-overlay__card">
              <div className="call-overlay__title">
                <span className="call-pulse-dot" />
                {t("call.waitingForPeer")}
              </div>
              <p className="call-overlay__text">
                {t("call.shareLink")}
              </p>
              <div className="call-waiting__link-box">
                <span>{window.location.href}</span>
                <button className="call-waiting__copy-btn" onClick={handleCopyLink}>
                  {copied ? t("call.linkCopied") : t("call.copyLink")}
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
            disabled={true}
          />
        </>
      )}

      {callState === "connected" && (
        <>
          <VideoTile
            stream={remoteStream}
            muted={false}
            label={t("call.peer")}
            variant="main"
            isCamOff={remoteMediaState ? !remoteMediaState.video : false}
            remoteMuted={remoteMediaState ? !remoteMediaState.audio : false}
          />
          <VideoTile stream={localStream} muted={true} label={t("call.you")} variant="pip" isCamOff={isCamOff} />

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

      {callState === "room_full" && (
        <div className="call-overlay">
          <div className="call-overlay__card">
            <div className="call-overlay__title">{t("call.roomFull")}</div>
            <p className="call-overlay__text">
              {t("call.roomFullDesc")}
            </p>
            <button ref={actionBtnRef} className="call-overlay__btn" onClick={() => navigate("/")}>
              {t("call.returnHome")}
            </button>
          </div>
        </div>
      )}

      {callState === "peer_left" && (
        <div className="call-overlay">
          <div className="call-overlay__card">
            <div className="call-overlay__title">{t("call.peerLeft")}</div>
            <p className="call-overlay__text">
              {t("call.peerLeft")}
            </p>
            <button ref={actionBtnRef} className="call-overlay__btn" onClick={() => navigate("/")}>
              {t("call.returnHome")}
            </button>
          </div>
        </div>
      )}

      {callState === "error" && (
        <div className="call-overlay">
          <div className="call-overlay__card">
            <div className="call-overlay__title">
              {connectionError === "AUTH_REQUIRED"
                ? t("call.authRequired")
                : connectionError === "CONNECTION_LOST"
                ? t("call.connectionLost")
                : mediaError === "CAMERA_DENIED"
                ? t("call.cameraDenied")
                : mediaError === "NO_DEVICE"
                ? t("call.noDevice")
                : t("call.genericError")}
            </div>
            <p className="call-overlay__text">
              {connectionError === "AUTH_REQUIRED"
                ? t("call.authRequired")
                : connectionError === "CONNECTION_LOST"
                ? t("call.connectionLost")
                : mediaError === "CAMERA_DENIED"
                ? t("call.cameraDenied")
                : mediaError === "NO_DEVICE"
                ? t("call.noDevice")
                : peerError
                ? `Connection error: ${peerError}`
                : t("call.genericError")}
            </p>
            {connectionError === "AUTH_REQUIRED" ? (
              <button ref={actionBtnRef} className="call-overlay__btn" onClick={() => navigate("/")}>
                {t("call.signIn")}
              </button>
            ) : (
              <button ref={actionBtnRef} className="call-overlay__btn" onClick={() => navigate("/")}>
                {t("call.returnHome")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
