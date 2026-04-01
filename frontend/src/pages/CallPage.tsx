import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useSignaling } from "../hooks/useSignaling";

export function CallRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/call/${uuidv4()}`, { replace: true });
  }, [navigate]);
  return <div>Redirecting to a secure room...</div>;
}

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) {
      navigate(`/call/${uuidv4()}`, { replace: true });
    }
  }, [roomId, navigate]);

  const { isConnected, connectionError } = useSignaling(roomId);

  if (!roomId) return null;

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Video Call Room</h1>
      <p><strong>Room ID:</strong> {roomId}</p>
      <p>
        <strong>Status: </strong>
        {connectionError ? (
          <span style={{ color: "red" }}>{connectionError}</span>
        ) : isConnected ? (
          <span style={{ color: "green" }}>Connected to signaling server. Waiting for peer...</span>
        ) : (
          <span>Connecting...</span>
        )}
      </p>
    </div>
  );
}
