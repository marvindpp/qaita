// Загрузка MediaPipe Pose + Hand. GPU, при ошибке — CPU.
import { FilesetResolver, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

const TASKS_VERSION = '1.0.1'; // держать равным версии @mediapipe/tasks-vision в package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function withGpuFallback(create) {
  try {
    return { model: await create('GPU'), delegate: 'GPU' };
  } catch {
    return { model: await create('CPU'), delegate: 'CPU' };
  }
}

export async function loadModels() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const [pose, hand] = await Promise.all([
    withGpuFallback((delegate) => PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })),
    withGpuFallback((delegate) => HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    })),
  ]);
  return { pose: pose.model, hand: hand.model, delegate: pose.delegate };
}
