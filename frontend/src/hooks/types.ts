export type SignalingMessageType =
  | "joined"
  | "peer_joined"
  | "peer_left"
  | "room_full"
  | "offer"
  | "answer"
  | "ice";

export interface SignalingMessage {
  type: SignalingMessageType;
  initiator?: boolean;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  [key: string]: unknown;
}

export type CallState =
  | "idle"
  | "waiting"
  | "connected"
  | "room_full"
  | "peer_left"
  | "error";
