// Загрузка MediaPipe Pose + Hand. Сначала с нашего сайта, потом с CDN. GPU, при ошибке — CPU.
import { FilesetResolver, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

const TASKS_VERSION = '1.0.1'; // держать равным версии @mediapipe/tasks-vision в package.json
// Сначала — с нашего же сайта (wasm копирует scripts/copy-wasm.mjs, модели лежат в public/models):
// жюри или клиника с фильтром, который режет jsdelivr/googleapis, всё равно запустит. CDN — запасной путь.
const here = (path) => new URL(path, globalThis.location?.href ?? 'http://localhost/').href;
const LOCAL = {
  wasm: here('./mediapipe/wasm'),
  pose: here('./models/pose_landmarker_lite.task'),
  hand: here('./models/hand_landmarker.task'),
};
const CDN = {
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`,
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};

// На некоторых телефонах (iPhone Safari) GPU-делегат не падает с ошибкой, а зависает — тогда через 12 с идём на CPU
// (живой тест 29.09: «Загружаю распознавание…» без конца).
const GPU_TIMEOUT_MS = 12000;
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('GPU timeout')), ms));

async function withGpuFallback(create) {
  try {
    return { model: await Promise.race([create('GPU'), timeout(GPU_TIMEOUT_MS)]), delegate: 'GPU' };
  } catch {
    return { model: await create('CPU'), delegate: 'CPU' };
  }
}

async function loadFrom(src) {
  const vision = await FilesetResolver.forVisionTasks(src.wasm);
  const [pose, hand] = await Promise.all([
    withGpuFallback((delegate) => PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: src.pose, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })),
    withGpuFallback((delegate) => HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: src.hand, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    })),
  ]);
  return { pose: pose.model, hand: hand.model, delegate: pose.delegate };
}

export async function loadModels() {
  // Сразу пробуем свои файлы: без сети их отдаёт кэш приложения (public/sw.js). HEAD-проверку не делаем —
  // service worker отвечает только на GET, и офлайн она ошибочно уводила на CDN. Нет своих файлов — CDN.
  try {
    return await loadFrom(LOCAL);
  } catch (e) {
    console.warn('Qaita: локальные модели не загрузились, пробую CDN', e);
    return loadFrom(CDN);
  }
}
