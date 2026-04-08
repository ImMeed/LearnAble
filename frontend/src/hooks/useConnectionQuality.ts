import { useEffect, useState, useRef } from "react";
import Peer from "simple-peer";

export type ConnectionQuality = "good" | "fair" | "poor" | null;

interface UseConnectionQualityProps {
  peerRef: React.MutableRefObject<Peer.Instance | null>;
  peerConnected: boolean;
}

export function useConnectionQuality({
  peerRef,
  peerConnected,
}: UseConnectionQualityProps): ConnectionQuality {
  const [quality, setQuality] = useState<ConnectionQuality>(null);
  const previousStatsRef = useRef<{
    packetsReceived: number;
    packetsLost: number;
  }>({ packetsReceived: 0, packetsLost: 0 });

  useEffect(() => {
    if (!peerConnected) {
      setQuality(null);
      return;
    }

    const interval = setInterval(async () => {
      if (!peerRef.current) return;

      const pc = (peerRef.current as any)._pc as RTCPeerConnection;
      if (!pc || typeof pc.getStats !== "function") return;

      try {
        const stats = await pc.getStats();
        let currentRtt: number | null = null;
        let inboundVideoStat: any = null;

        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            currentRtt = report.currentRoundTripTime !== undefined ? report.currentRoundTripTime : null;
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            inboundVideoStat = report;
          }
        });

        if (currentRtt !== null && currentRtt !== undefined) {
          let packetLossRate = 0;

          if (inboundVideoStat) {
            const packetsReceived = inboundVideoStat.packetsReceived || 0;
            const packetsLost = inboundVideoStat.packetsLost || 0;
            const prev = previousStatsRef.current;

            const receivedDelta = packetsReceived - prev.packetsReceived;
            const lostDelta = packetsLost - prev.packetsLost;

            if (receivedDelta + lostDelta > 0) {
              packetLossRate = lostDelta / (receivedDelta + lostDelta);
            }

            previousStatsRef.current = { packetsReceived, packetsLost };
          }

          // RTT is natively tracked in seconds by getStats
          const rttMs = currentRtt * 1000;

          if (rttMs < 150 && packetLossRate < 0.02) {
            setQuality("good");
          } else if (rttMs < 400 && packetLossRate < 0.05) {
            setQuality("fair");
          } else {
            setQuality("poor");
          }
        }
      } catch (err) {
        // Suppress warn if RTCPeerConnection is closed
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [peerConnected, peerRef]);

  return quality;
}
