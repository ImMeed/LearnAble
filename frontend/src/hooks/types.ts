export type SignalingMessageType =
  | "joined"
  | "peer_joined"
  | "peer_left"
  | "room_full"
  | "offer"
  | "answer"
  | "ice"
  | "media_state";

export interface SignalingMessage {
  type: SignalingMessageType;
  initiator?: boolean;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  video?: boolean;
  audio?: boolean;
  [key: string]: unknown;
}

export interface RemoteMediaState {
  video: boolean; // true = camera on
  audio: boolean; // true = mic on
}

export type CallState =
  | "idle"
  | "waiting"
  | "connected"
  | "room_full"
  | "peer_left"
  | "error";
