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
  const cameraRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMedia() {
      // Try video + audio first; fall back to audio-only if camera is unavailable.
      const constraints: MediaStreamConstraints[] = [
        { video: true, audio: true },
        { video: false, audio: true },
      ];
      let videoUnavailable = false;
      let videoBusy = false;

      for (const constraint of constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setLocalStream(stream);
          setIsCamOff(!constraint.video);
          // If we had to fall back to audio-only, surface a soft warning state.
          if (!constraint.video && videoUnavailable) {
            setMediaError(videoBusy ? "CAMERA_BUSY" : "NO_DEVICE");
          }
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
          if (constraint.video) {
            if (error.name === "NotReadableError" || error.name === "TrackStartError") {
              videoBusy = true;
            }
            videoUnavailable = true;
            continue;
          }
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

  const tryAttachCameraTrack = useCallback(async (): Promise<boolean> => {
    const stream = streamRef.current;
    if (!stream) return false;

    const hasLiveTrack = stream.getVideoTracks().some((t) => t.readyState === "live");
    if (hasLiveTrack) {
      setMediaError(null);
      setIsCamOff(false);
      return true;
    }

    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const [track] = videoOnly.getVideoTracks();
      if (!track) {
        setMediaError("NO_DEVICE");
        return false;
      }

      stream.addTrack(track);
      if (peerRef.current) {
        try {
          peerRef.current.addTrack(track, stream);
        } catch {
          // Some peers may not accept dynamic track add at this stage.
        }
      }

      setMediaError(null);
      setIsCamOff(false);
      // Touch state so UI re-renders after dynamic track add.
      setLocalStream(stream);
      return true;
    } catch (err: unknown) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setMediaError("CAMERA_DENIED");
        return false;
      }
      if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        setMediaError("CAMERA_BUSY");
        return false;
      }
      if (error.name === "NotFoundError") {
        setMediaError("NO_DEVICE");
        return false;
      }
      setMediaError("MEDIA_ERROR");
      return false;
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      // Audio-only fallback path: try to acquire camera when user asks for it.
      void tryAttachCameraTrack();
      return;
    }

    const shouldEnable = !videoTracks.some((t) => t.enabled);
    videoTracks.forEach((t) => {
      t.enabled = shouldEnable;
    });
    setIsCamOff(!shouldEnable);
  }, [tryAttachCameraTrack]);

  useEffect(() => {
    if (mediaError !== "CAMERA_BUSY" || !streamRef.current) {
      if (cameraRetryTimerRef.current) {
        clearTimeout(cameraRetryTimerRef.current);
        cameraRetryTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const retryAttach = async () => {
      if (cancelled) return;
      const attached = await tryAttachCameraTrack();
      if (attached) return;
      cameraRetryTimerRef.current = setTimeout(() => {
        void retryAttach();
      }, 1500);
    };

    cameraRetryTimerRef.current = setTimeout(() => {
      void retryAttach();
    }, 1200);

    return () => {
      cancelled = true;
      if (cameraRetryTimerRef.current) {
        clearTimeout(cameraRetryTimerRef.current);
        cameraRetryTimerRef.current = null;
      }
    };
  }, [mediaError, tryAttachCameraTrack]);

  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setLocalStream(null);
      setIsCamOff(false);
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
  const negotiationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const negotiationRetryRef = useRef(0);
  const [peerCycle, setPeerCycle] = useState(0);
  const MAX_PEER_RETRIES = 3;
  const MAX_NEGOTIATION_RETRIES = 2;
  const NEGOTIATION_TIMEOUT_MS = 4500;

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
    // Wait for two things before creating the peer:
    //   1. isInitiator is known (set by the signaling server on WS connect)
    //   2. getUserMedia has settled — either localStream is set (camera works)
    //      OR mediaError is set (camera failed). This guarantees we include the
    //      stream in the peer if it's available, without a race condition.
    if (isInitiator === null) return;
    if (!localStream && !mediaError) return; // getUserMedia still in progress

    // Non-initiator can create immediately and wait for an offer.
    // Initiator should wait until the signaling server confirms a peer joined,
    // otherwise its first offer can be emitted before anyone is listening.
    const shouldCreate = isInitiator === true ? peerJoinCount > 0 : isInitiator === false;

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
      // Include stream only when camera is available. If camera was denied or
      // unavailable, we still create the peer — we just won't send video/audio.
      ...(localStream ? { stream: localStream } : {}),
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
      setPeerConnected(true);
      negotiationRetryRef.current = 0;
      if (negotiationTimerRef.current) {
        clearTimeout(negotiationTimerRef.current);
        negotiationTimerRef.current = null;
      }
    });

    // Some browser/driver combinations are more reliable with track events.
    peer.on("track", (track, stream) => {
      const firstStream = stream ?? null;
      if (firstStream) {
        setRemoteStream(firstStream);
        setPeerConnected(true);
        negotiationRetryRef.current = 0;
        if (negotiationTimerRef.current) {
          clearTimeout(negotiationTimerRef.current);
          negotiationTimerRef.current = null;
        }
        return;
      }
      setRemoteStream((prev) => {
        if (prev) {
          if (!prev.getTracks().some((t) => t.id === track.id)) {
            prev.addTrack(track);
          }
          return prev;
        }
        return new MediaStream([track]);
      });
      setPeerConnected(true);
      negotiationRetryRef.current = 0;
      if (negotiationTimerRef.current) {
        clearTimeout(negotiationTimerRef.current);
        negotiationTimerRef.current = null;
      }
    });

    peer.on("connect", () => {
      setPeerConnected(true);
      negotiationRetryRef.current = 0;
      if (negotiationTimerRef.current) {
        clearTimeout(negotiationTimerRef.current);
        negotiationTimerRef.current = null;
      }
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
        if (negotiationTimerRef.current) {
          clearTimeout(negotiationTimerRef.current);
          negotiationTimerRef.current = null;
        }
        retryTimerRef.current = setTimeout(() => {
          setPeerError(null);
          setRemoteStream(null);
          setPeerConnected(false);
          // Re-trigger peer creation.
          setPeerCycle((c) => c + 1);
        }, delay);
      } else {
        setPeerError(err.message);
      }
    });

    peerRef.current = peer;

    if (negotiationTimerRef.current) {
      clearTimeout(negotiationTimerRef.current);
      negotiationTimerRef.current = null;
    }
    negotiationTimerRef.current = setTimeout(() => {
      if (peerRef.current !== peer || peerConnected || remoteStream) return;
      if (negotiationRetryRef.current >= MAX_NEGOTIATION_RETRIES) {
        setPeerError("Negotiation timeout");
        return;
      }
      negotiationRetryRef.current += 1;
      try {
        peer.destroy();
      } catch {
        // best effort cleanup
      }
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
      setPeerConnected(false);
      setRemoteStream(null);
      setPeerError(null);
      setPeerCycle((c) => c + 1);
    }, NEGOTIATION_TIMEOUT_MS);

    // Drain any signals that arrived before the peer was ready
    signalQueueRef.current.forEach((s) => peer.signal(s));
    signalQueueRef.current = [];
  }, [localStream, mediaError, isInitiator, peerJoinCount, sendMessage, peerCycle, peerConnected, remoteStream]);

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
      if (cameraRetryTimerRef.current) {
        clearTimeout(cameraRetryTimerRef.current);
      }
      if (negotiationTimerRef.current) {
        clearTimeout(negotiationTimerRef.current);
      }
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
