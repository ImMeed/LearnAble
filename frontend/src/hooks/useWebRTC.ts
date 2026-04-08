import { useEffect, useRef, useState, useCallback } from "react";
import Peer, { Instance as PeerInstance, SignalData } from "simple-peer";

// polyfill
if (typeof global === 'undefined') {
  (window as any).global = window;
}
if (typeof process === 'undefined') {
  (window as any).process = { env: {} };
}

interface UseWebRTCProps {
  isInitiator: boolean | null;
  peerJoinCount: number;
  incomingSignal: { data: any; id: number } | null;
  sendMessage: (msg: object) => void;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  mediaError: string | null;
  isMuted: boolean;
  isCamOff: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
  stopAllTracks: () => void;

  remoteStream: MediaStream | null;
  peerConnected: boolean;
  peerError: string | null;
  destroyPeer: () => void;
  peerRef: React.MutableRefObject<PeerInstance | null>;
}

export function useWebRTC({
  isInitiator,
  peerJoinCount,
  incomingSignal,
  sendMessage,
}: UseWebRTCProps): UseWebRTCReturn {
  // ── Section A: Local Media ──
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMedia() {
      // Try video + audio first; fall back to audio-only if camera is unavailable.
      const constraints: MediaStreamConstraints[] = [
        { video: true, audio: true },
        { video: false, audio: true },
      ];

      for (const constraint of constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setLocalStream(stream);
          return;
        } catch (err: unknown) {
          if (cancelled) return;
          const error = err as DOMException;
          // Permission denied — no point retrying with audio-only
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            setMediaError("CAMERA_DENIED");
            return;
          }
          // Device not found or in use — try audio-only next iteration
          if (constraint.video) continue;
          // Audio-only also failed
          if (error.name === "NotFoundError") {
            setMediaError("NO_DEVICE");
          } else {
            setMediaError("MEDIA_ERROR");
          }
        }
      }
    }

    initMedia();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCamOff((prev) => !prev);
  }, []);

  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  // ── Section B: Peer Connection ──
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerError, setPeerError] = useState<string | null>(null);

  const peerRef = useRef<PeerInstance | null>(null);
  const signalQueueRef = useRef<any[]>([]);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_PEER_RETRIES = 3;

  const destroyPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setRemoteStream(null);
    setPeerConnected(false);
  }, []);

  const getIceServers = (): RTCIceServer[] => {
    const envServers = import.meta.env.VITE_ICE_SERVERS;
    if (envServers) {
      try {
        return JSON.parse(envServers);
      } catch {
        console.warn("Invalid VITE_ICE_SERVERS, falling back to defaults");
      }
    }
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  };

  useEffect(() => {
    if (!localStream || isInitiator === null) return;

    const shouldCreate =
      isInitiator === true || (peerJoinCount > 0 && isInitiator === false);

    if (!shouldCreate) return;

    // If a peer already exists don't tear it down — the connection attempt is
    // already in progress. This guards against React StrictMode's double-invoke
    // and any spurious effect re-runs that would abort a live negotiation.
    if (peerRef.current) return;
    setPeerError(null);
    setRemoteStream(null);
    setPeerConnected(false);
    signalQueueRef.current = [];

    const peer = new Peer({
      initiator: isInitiator === true,
      stream: localStream,
      trickle: true,
      config: {
        iceServers: getIceServers(),
      },
    });

    peer.on("signal", (signalData: SignalData) => {
      if (signalData.type === "offer") {
        sendMessage({ type: "offer", sdp: signalData.sdp, signalData });
      } else if (signalData.type === "answer") {
        sendMessage({ type: "answer", sdp: signalData.sdp, signalData });
      } else if ((signalData as any).candidate) {
        sendMessage({ type: "ice", candidate: (signalData as any).candidate, signalData });
      } else {
        sendMessage({ type: signalData.type, signalData });
      }
    });

    peer.on("stream", (stream) => {
      setRemoteStream(stream);
    });

    peer.on("connect", () => {
      setPeerConnected(true);
    });

    peer.on("close", () => {
      setRemoteStream(null);
      setPeerConnected(false);
    });

    peer.on("error", (err) => {
      console.error("simple-peer error:", err);
      // Retry with exponential backoff up to MAX_PEER_RETRIES times
      if (retryCountRef.current < MAX_PEER_RETRIES) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        retryCountRef.current += 1;
        console.warn(`WebRTC error, retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_PEER_RETRIES})`);
        peerRef.current?.destroy();
        peerRef.current = null;
        signalQueueRef.current = [];
        retryTimerRef.current = setTimeout(() => {
          setPeerError(null);
          setRemoteStream(null);
          setPeerConnected(false);
          // Re-trigger peer creation by resetting state
          setPeerError(null);
        }, delay);
      } else {
        setPeerError(err.message);
      }
    });

    peerRef.current = peer;

    // Drain any signals that arrived before the peer was ready
    signalQueueRef.current.forEach((s) => peer.signal(s));
    signalQueueRef.current = [];
  }, [localStream, isInitiator, peerJoinCount, sendMessage]);

  useEffect(() => {
    if (!incomingSignal) return;
    const msg = incomingSignal.data;
    const signalData = msg.signalData || msg;

    if (peerRef.current) {
      try {
        peerRef.current.signal(signalData);
      } catch (err) {
        console.error("Error feeding signal to peer:", err);
      }
    } else {
      signalQueueRef.current.push(signalData);
    }
  }, [incomingSignal]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      destroyPeer();
      stopAllTracks();
    };
  }, [destroyPeer, stopAllTracks]);

  return {
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
  };
}
