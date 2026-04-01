import { useEffect, useRef, useState, useCallback } from "react";
import { SignalingMessage } from "./types";

interface UseSignalingReturn {
  sendMessage: (msg: object) => void;
  lastMessage: SignalingMessage | null;
  isConnected: boolean;
  isInitiator: boolean | null;
  connectionError: string | null;
}

export function useSignaling(roomId: string | undefined): UseSignalingReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<SignalingMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitiator, setIsInitiator] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Use environment variable or fallback to localhost
    const host = window.location.hostname;
    const wsUrl = `ws://${host}:8000/ws/call/${roomId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        setLastMessage(message);

        if (message.type === "joined") {
          setIsInitiator(message.initiator ?? false);
        } else if (message.type === "room_full") {
          setConnectionError("Room is full.");
          ws.close();
        }
      } catch (err) {
        console.error("Failed to parse signaling message", err);
      }
    };

    ws.onerror = () => {
      setConnectionError("WebSocket connection error.");
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId]);

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("WebSocket is not connected. Cannot send message:", msg);
    }
  }, []);

  return {
    sendMessage,
    lastMessage,
    isConnected,
    isInitiator,
    connectionError,
  };
}
