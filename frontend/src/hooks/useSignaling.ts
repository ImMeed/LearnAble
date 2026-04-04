import { useEffect, useRef, useState, useCallback } from "react";
import { SignalingMessage, RemoteMediaState } from "./types";
import { getSession } from "../state/auth";
import type { AttentionMetrics } from '../features/attention/types/attention';

interface IncomingSignalPayload {
  data: any;
  id: number;
}

interface UseSignalingReturn {
  sendMessage: (msg: object) => void;
  isConnected: boolean;
  isReconnecting: boolean;
  isInitiator: boolean | null;
  peerJoinCount: number;
  peerLeft: boolean;
  roomFull: boolean;
  incomingSignal: IncomingSignalPayload | null;
  connectionError: string | null;
  remoteMediaState: RemoteMediaState | null;
  incomingAttentionMetrics: AttentionMetrics | null;
}

const MAX_RECONNECT_ATTEMPTS = 5;

export function useSignaling(roomId: string | undefined): UseSignalingReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const signalIdRef = useRef<number>(0);

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isInitiator, setIsInitiator] = useState<boolean | null>(null);
  const [peerJoinCount, setPeerJoinCount] = useState(0);
  const [peerLeft, setPeerLeft] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [incomingSignal, setIncomingSignal] = useState<IncomingSignalPayload | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [remoteMediaState, setRemoteMediaState] = useState<RemoteMediaState | null>(null);
  const [incomingAttentionMetrics, setIncomingAttentionMetrics] = useState<AttentionMetrics | null>(null);

  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const isReconnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (!roomId) return;

    const host = window.location.hostname;
    const session = getSession();
    const tokenParam = session?.accessToken ? `?token=${session.accessToken}` : "";
    const wsUrl = `ws://${host}:8000/ws/call/${roomId}${tokenParam}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      isReconnectingRef.current = false;
      setIsReconnecting(false);
      setIsConnected(true);
      setConnectionError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);

        switch (message.type) {
          case "joined":
            setIsInitiator(message.initiator ?? false);
            setIsConnected(true);
            break;
          case "peer_joined":
            setPeerJoinCount((c) => c + 1);
            setPeerLeft(false);   // peer came back — clear the "left" flag
            break;
          case "peer_left":
            setPeerLeft(true);
            break;
          case "room_full":
            setRoomFull(true);
            break;
          case "media_state":
            setRemoteMediaState({
              video: message.video ?? true,
              audio: message.audio ?? true,
            });
            break;
          case "attention_metrics":
            setIncomingAttentionMetrics(message.payload as AttentionMetrics);
            break;
          case "offer":
          case "answer":
          case "ice":
            signalIdRef.current += 1;
            setIncomingSignal({ data: message, id: signalIdRef.current });
            break;
        }
      } catch (err) {
        console.error("Failed to parse signaling message", err);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      setIsConnected(false);

      if (event.code === 4001) {
        setConnectionError("AUTH_REQUIRED");
        return;
      }

      if (
        event.code !== 1000 &&
        event.code !== 1001 &&
        !intentionalCloseRef.current
      ) {
        attemptReconnect();
      }
    };
  }, [roomId]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionError("CONNECTION_LOST");
      isReconnectingRef.current = false;
      setIsReconnecting(false);
      return;
    }

    isReconnectingRef.current = true;
    setIsReconnecting(true);
    const delay = Math.pow(2, reconnectAttemptRef.current) * 1000;
    reconnectAttemptRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close(1000);
      }
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("WebSocket is not connected. Cannot send message:", msg);
    }
  }, []);

  return {
    sendMessage,
    isConnected,
    isReconnecting,
    isInitiator,
    peerJoinCount,
    peerLeft,
    roomFull,
    incomingSignal,
    connectionError,
    remoteMediaState,
    incomingAttentionMetrics,
  };
}
