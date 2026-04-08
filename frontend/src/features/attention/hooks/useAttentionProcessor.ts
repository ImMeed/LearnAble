// frontend/src/features/attention/hooks/useAttentionProcessor.ts

import { useEffect, useRef, useCallback } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { extractFeatures, noFaceFeatures } from '../lib/extractFeatures';
import { computeAttentionScore } from '../lib/computeAttentionScore';
import { BlinkDetector } from '../lib/blinkDetector';
import { AttentionScore } from '../types/attention';

const FRAME_INTERVAL_NORMAL_MS = 4000;
const FRAME_INTERVAL_SLOW_MS = 7000;
const SLOW_THRESHOLD_MS = 500;
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 240;

interface UseAttentionProcessorOptions {
  localStream: MediaStream | null;
  enabled: boolean;   // false when role !== 'student' or stream not ready
  sendMessage: (msg: object) => void;
}

interface UseAttentionProcessorReturn {
  latestScore: React.RefObject<AttentionScore | null>;
  blinkDetector: React.RefObject<BlinkDetector>;
  loadFailed: React.RefObject<boolean>;
}

export function useAttentionProcessor({
  localStream,
  enabled,
  sendMessage,
}: UseAttentionProcessorOptions): UseAttentionProcessorReturn {
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isMountedRef = useRef(true);

  const smoothedScoreRef = useRef<number>(50); // start at 50 — neutral baseline
  const blinkDetectorRef = useRef<BlinkDetector>(new BlinkDetector());
  const latestScoreRef = useRef<AttentionScore | null>(null);
  const callStartRef = useRef<number>(Date.now());
  const loadFailedRef = useRef(false);

  // ---------- MediaPipe result handler ----------
  const handleResults = useCallback((results: Results) => {
    if (!isMountedRef.current) return;

    const detected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    const features = detected
      ? extractFeatures(results.multiFaceLandmarks[0])
      : noFaceFeatures();

    // Update blink detector with current eye openness
    blinkDetectorRef.current.update(features.eyeOpennessRatio);
    const blinkRate = blinkDetectorRef.current.getBlinksPerMinute();

    // Compute score
    const score = computeAttentionScore(features, smoothedScoreRef.current);
    smoothedScoreRef.current = score.smoothed;
    latestScoreRef.current = score;

    const elapsed = Math.round((Date.now() - callStartRef.current) / 1000);

    const payload = {
      peerId: 'student-1',
      score: score.smoothed,
      label: score.label,
      distraction: false,  // distraction detection is on the teacher side (useAttentionReceiver)
      signals: {
        face_present: features.facePresent,
        head_yaw: parseFloat(features.headYaw.toFixed(1)),
        head_pitch: parseFloat(features.headPitch.toFixed(1)),
        eye_openness: parseFloat(features.eyeOpennessRatio.toFixed(3)),
        blink_rate: blinkRate,
        iris_deviation: parseFloat(features.irisDeviation.toFixed(3)),
      },
      timestamp: elapsed,
    };

    sendMessage({ type: 'attention_metrics', payload });

    // Keep dev log but at debug level
    console.debug('[AttentionProcessor] Emitted metrics:', payload);
  }, [sendMessage]);

  // ---------- Frame capture loop ----------
  const captureAndSend = useCallback(() => {
    const video = hiddenVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvasCtxRef.current;
    const faceMesh = faceMeshRef.current;

    if (!video || !canvas || !ctx || !faceMesh) return;
    if (video.readyState < 2) return; // not enough data yet (HAVE_CURRENT_DATA = 2)

    const start = performance.now();
    ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    faceMesh.send({ image: canvas })
      .then(() => {
        const elapsed = performance.now() - start;
        if (elapsed > SLOW_THRESHOLD_MS && intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_SLOW_MS);
          console.warn('[AttentionProcessor] Slow processing detected — reduced to 7s interval');
        }
      })
      .catch((err) => {
        console.error('[AttentionProcessor] faceMesh.send error:', err);
      });
  }, []);

  // ---------- Setup & teardown ----------
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !localStream) return;

    callStartRef.current = Date.now();

    // 1. Create the hidden video element
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = localStream;
    hiddenVideoRef.current = video;

    // Play is required for readyState to advance
    video.play().catch((err: Error) => {
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
        console.warn('[AttentionProcessor] Camera access unavailable — processor disabled');
      } else {
        console.warn('[AttentionProcessor] Hidden video play() failed:', err);
      }
    });

    const handleVisibilityChange = () => {
      if (!isMountedRef.current) return;

      if (document.hidden) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        console.log('[AttentionProcessor] Tab hidden — paused');
      } else {
        if (intervalRef.current === null && faceMeshRef.current) {
          intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_NORMAL_MS);
          console.log('[AttentionProcessor] Tab visible — resumed');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Create the offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvasRef.current = canvas;
    canvasCtxRef.current = canvas.getContext('2d');

    // 3. Initialize MediaPipe FaceMesh
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,   // enables iris tracking (478 landmarks total)
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(handleResults);

    // FaceMesh must be initialized before we send frames
    faceMesh
      .initialize()
      .then(() => {
        if (!isMountedRef.current) return;
        faceMeshRef.current = faceMesh;
        console.log('[AttentionProcessor] MediaPipe FaceMesh initialized');

        // 4. Start the frame loop only after initialization
        intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_NORMAL_MS);
      })
      .catch((err) => {
        console.error('[AttentionProcessor] FaceMesh initialization failed:', err);
        loadFailedRef.current = true;
      });

    // 5. Teardown
    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }

      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = null;
        hiddenVideoRef.current = null;
      }

      canvasRef.current = null;
      canvasCtxRef.current = null;

      blinkDetectorRef.current.reset();
      smoothedScoreRef.current = 50;
      latestScoreRef.current = null;

      console.log('[AttentionProcessor] Torn down cleanly');
    };
  }, [enabled, localStream, handleResults, captureAndSend, sendMessage]);

  return { latestScore: latestScoreRef, blinkDetector: blinkDetectorRef, loadFailed: loadFailedRef };
}
