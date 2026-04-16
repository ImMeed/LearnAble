import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createCallRoom } from "../api/callApi";
import { useTranslation } from "react-i18next";
import { useSignaling } from "../hooks/useSignaling";
import { useWebRTC } from "../hooks/useWebRTC";
import { CallState } from "../hooks/types";
import { useConnectionQuality } from "../hooks/useConnectionQuality";
import { ConnectionBadge } from "../components/ConnectionBadge";
import VideoTile from "../components/VideoTile";
import CallControls from "../components/CallControls";
import { ATTENTION_CALL_ENABLED } from "../app/features";
import type { UserRole } from '../features/attention/types/attention';
import { useAttentionProcessor } from '../features/attention/hooks/useAttentionProcessor';
import { useAttentionReceiver } from '../features/attention/hooks/useAttentionReceiver';
import AttentionWidget from '../features/attention/components/AttentionWidget';
import { getSession } from "../state/auth";
import "./CallPage.css";

function deriveRole(): UserRole | null {
  const session = getSession();
  if (!session) return null;
  if (session.role === "ROLE_STUDENT") return "student";
  // ROLE_TUTOR, ROLE_PSYCHOLOGIST, ROLE_PARENT, ROLE_ADMIN all observe as teacher
  return "teacher";
}

export function CallRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    createCallRoom()
      .then((roomId) => navigate(`/call/${roomId}`, { replace: true }))
      .catch(() => navigate("/", { replace: true }));
  }, [navigate]);
  return null;
}

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [callState, setCallState] = useState<CallState>("idle");
  const [copied, setCopied] = useState(false);
  const [role] = useState<UserRole | null>(() => deriveRole());
  const showDevDiagnostics = import.meta.env.DEV;
  
  const actionBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!roomId) {
      navigate("/", { replace: true });
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
    peerJoinCount: signaling.peerJoinCount,
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
    } else if (peerLeft) {
      setCallState("peer_left");
    } else if (peerError || connectionError) {
      setCallState("error");
    } else if (peerConnected || !!remoteStream) {
      setCallState("connected");
    } else if (isConnected) {
      // Camera/mic errors are soft warnings — the call can still proceed
      // (user receives remote stream even without a local one).
      setCallState("waiting");
    } else {
      setCallState("idle");
    }
  }, [roomFull, peerLeft, peerError, connectionError, peerConnected, remoteStream, isConnected]);

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

  // Mount attention processor on the student side only
  const { latestScore, blinkDetector, loadFailed } = useAttentionProcessor({
    localStream,
    enabled: ATTENTION_CALL_ENABLED && role === 'student' && !!localStream,
    sendMessage: signaling.sendMessage,
  });

  const attentionState = useAttentionReceiver({
    incomingMetrics: signaling.incomingAttentionMetrics,
    enabled: ATTENTION_CALL_ENABLED && role === 'teacher',
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

      {isReconnecting && (
        <div className="call-reconnecting-banner">
          <div className="call-spinner call-spinner--small" />
          <span>{t("call.reconnecting")}</span>
        </div>
      )}

      {mediaError && callState !== "error" && (
        <div className="call-reconnecting-banner">
          <span>⚠️ {mediaError === "CAMERA_BUSY" ? t("call.cameraBusyWarn") : t("call.noCameraWarn")}</span>
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
          <VideoTile
            stream={remoteStream}
            muted={false}
            label="Remote"
            variant="main"
            isCamOff={remoteMediaState ? !remoteMediaState.video : false}
            remoteMuted={remoteMediaState ? !remoteMediaState.audio : false}
          />
          <VideoTile stream={localStream} muted={true} label="You" variant="pip" isCamOff={isCamOff} />

          <div className="call-overlay">
            <div className="call-overlay__card">
              <div className="call-overlay__title">
                <span className="call-pulse-dot" />
                {t("call.waitingForPeer")}
              </div>
              <p className="call-overlay__text">{t("call.waitingHint")}</p>
              {showDevDiagnostics ? (
                <p className="call-overlay__text" style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                  room:{roomId?.slice(0, 8)} | role:{role ?? "none"} | ws:{isConnected ? "up" : "down"} |
                  init:{String(signaling.isInitiator)} | peer:{peerConnected ? "up" : "down"}
                </p>
              ) : null}
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
          <VideoTile stream={localStream} muted={true} label={t("call.you")} variant="pip" isCamOff={isCamOff} consentBadgeLabel={role === 'student' ? t('attention.consent.tracking') : undefined} />

          <CallControls
            isMuted={isMuted}
            isCamOff={isCamOff}
            onToggleMute={toggleMute}
            onToggleCam={toggleCamera}
            onEndCall={handleEndCall}
            disabled={false}
          />

          {ATTENTION_CALL_ENABLED ? (
            <AttentionWidget
              currentScore={attentionState.currentScore}
              currentLabel={attentionState.currentLabel}
              hasData={attentionState.hasData}
              isStale={attentionState.isStale}
              isDistracted={attentionState.isDistracted}
              timeline={attentionState.timeline}
              active={role === 'teacher'}
              unavailable={loadFailed.current}
            />
          ) : null}
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
                : connectionError === "SESSION_REPLACED"
                ? t("call.sessionReplaced")
                : connectionError === "ROOM_NOT_FOUND"
                ? t("call.roomNotFound")
                : connectionError === "CONNECTION_LOST"
                ? t("call.connectionLost")
                : mediaError === "CAMERA_DENIED"
                ? t("call.cameraDenied")
                : mediaError === "CAMERA_BUSY"
                ? t("call.cameraBusy")
                : mediaError === "NO_DEVICE"
                ? t("call.noDevice")
                : t("call.genericError")}
            </div>
            <p className="call-overlay__text">
              {connectionError === "AUTH_REQUIRED"
                ? t("call.authRequired")
                : connectionError === "SESSION_REPLACED"
                ? t("call.sessionReplaced")
                : connectionError === "ROOM_NOT_FOUND"
                ? t("call.roomNotFound")
                : connectionError === "CONNECTION_LOST"
                ? t("call.connectionLost")
                : mediaError === "CAMERA_DENIED"
                ? t("call.cameraDenied")
                : mediaError === "CAMERA_BUSY"
                ? t("call.cameraBusy")
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
