// Движок Qaita [D]. API — docs/CONTRACT.md.
import { createEmitter } from './emitter.js';
import { openCamera } from './camera.js';
import { loadModels } from './models.js';
import { createSmoother, mirror } from './smoothing.js';
import { startLoop, createFpsMeter } from './loop.js';

const NO_PERSON_MS = 1000; // столько без позы → статус NO_PERSON

/** @param {{ video: HTMLVideoElement }} opts */
export async function createEngine({ video }) {
  const bus = createEmitter();
  const debug = new URLSearchParams(location.search).has('debug');
  const poseSmoother = createSmoother(0.5);
  const measureFps = createFpsMeter();

  let stream = null;
  let models = null;
  let stopLoop = null;
  let overlay = null;
  let side = 'right';
  let paused = false;
  let status = null;
  let lastPoseAt = 0;
  let lastVideoTime = -1;
  let frameNo = 0;
  let hands = [];

  const setStatus = (code, message) => {
    if (status === code) return;
    status = code;
    bus.emit('status', { code, message });
  };

  function onFrame(now) {
    if (paused || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    frameNo += 1;

    const poseResult = models.pose.detectForVideo(video, now);
    const rawPose = poseResult.landmarks?.[0] ?? null;
    const pose = poseSmoother.next(mirror(rawPose));

    // Руки дороже — считаем через кадр.
    if (frameNo % 2 === 0) {
      const handResult = models.hand.detectForVideo(video, now);
      hands = (handResult.landmarks ?? []).map(mirror);
    }

    if (pose) {
      lastPoseAt = now;
      setStatus('OK', 'Вас хорошо видно');
    } else if (now - lastPoseAt > NO_PERSON_MS) {
      setStatus('NO_PERSON', 'Сядьте перед камерой так, чтобы были видны голова, плечи и руки');
    }

    const fps = measureFps();
    bus.emit('frame', { t: now, pose, hand: hands[0] ?? null, hands, fps });
    overlay?.draw({ pose, hands, fps, delegate: models.delegate });
  }

  return {
    on: bus.on,
    async start() {
      try {
        stream = await openCamera(video);
      } catch {
        setStatus('NO_CAMERA', 'Нет доступа к камере. Нажмите на значок камеры в адресной строке, разрешите доступ и обновите страницу');
        return;
      }
      models = await loadModels();
      if (debug) {
        const { createDebugOverlay } = await import('./debug.js');
        overlay = createDebugOverlay(video);
      }
      stopLoop = startLoop(video, onFrame);
    },
    stop() {
      stopLoop?.();
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    },
    setSide(s) { side = s; },
    async calibrate() { return { side }; },
    setExercise() {},
    pause() { paused = true; },
    resume() { paused = false; },
    getSummary() {
      return { side, durationSec: 0, exercises: [], totalReps: 0, accuracy: 0, mistakesCorrected: 0 };
    },
  };
}
