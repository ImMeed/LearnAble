declare module '@mediapipe/face_mesh' {
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }
  export type NormalizedLandmarkList = NormalizedLandmark[];
  export interface Results {
    multiFaceLandmarks: NormalizedLandmarkList[];
    image: HTMLCanvasElement;
  }
  export interface FaceMeshOptions {
    maxNumFaces?: number;
    refineLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }
  export class FaceMesh {
    constructor(config: { locateFile: (file: string) => string });
    setOptions(options: FaceMeshOptions): void;
    onResults(callback: (results: Results) => void): void;
    send(input: { image: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement }): Promise<void>;
    initialize(): Promise<void>;
    close(): void;
  }
}
