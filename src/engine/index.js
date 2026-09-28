// Движок Qaita [D]. API — docs/CONTRACT.md.
import { createEmitter } from './emitter.js';
import { openCamera } from './camera.js';
import { loadModels } from './models.js';
import { createSmoother, mirror } from './smoothing.js';
import { startLoop, createFpsMeter } from './loop.js';
import { measure } from './body.js';
import { createCalibration } from './calibration.js';
import { createExerciseSession } from './session.js';

const NO_PERSON_MS = 1000; // столько без позы → статус NO_PERSON

/** @param {{ video: HTMLVideoElement }} opts */
export async function createEngine({ video }) {
  const bus = createEmitter();
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');
  const poseSmoother = createSmoother(0.5);
  const measureFps = createFpsMeter();

  let stream = null, models = null, stopLoop = null, overlay = null;
  let side = 'right';
  let paused = false;
  let status = null;
  let lastPoseAt = 0, lastVideoTime = -1, frameNo = 0;
  let hands = [];

  let calibration = null;      // { calib, resolve }
  let baseline = null;
  let exercise = null;         // текущая сессия упражнения (session.js)
  const startedAt = performance.now();
  const finished = [];         // результаты завершённых/прерванных упражнений
  let lastInfo = {};

  const setStatus = (code, message) => {
    if (status === code) return;
    status = code;
    bus.emit('status', { code, message });
  };

  const aspect = () => (video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3);

  function stepCalibration(m, now) {
    const r = calibration.calib.push(m, now);
    bus.emit('calibration', { phase: r.phase, progress: r.progress, message: r.message });
    lastInfo = { calib: `${r.phase} ${(r.progress * 100) | 0}%` };
    if (r.done) {
      baseline = r.baseline;
      const { resolve } = calibration;
      calibration = null;
      resolve(baseline);
    }
  }

  function stepExercise(m, now) {
    const { events, info } = exercise.step(m, now);
    for (const e of events) bus.emit(e.type, e.payload);
    lastInfo = {
      ...info, elev: m?.elevationDeg, elbow: m?.elbowDeg,
      widthRatio: m && baseline ? m.Sx / baseline.Sx : null, earSh: m?.earSh, baseEarSh: baseline?.earSh,
    };
  }

  function onFrame(now) {
    if (paused || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    frameNo += 1;

    const rawPose = models.pose.detectForVideo(video, now).landmarks?.[0] ?? null;
    const pose = poseSmoother.next(mirror(rawPose));
    if (frameNo % 2 === 0) hands = (models.hand.detectForVideo(video, now).landmarks ?? []).map(mirror);

    if (pose) {
      lastPoseAt = now;
      setStatus('OK', 'Вас хорошо видно');
    } else if (now - lastPoseAt > NO_PERSON_MS) {
      setStatus('NO_PERSON', 'Сядьте перед камерой так, чтобы были видны голова, плечи и руки');
    }

    const m = measure(pose, side, aspect());
    if (calibration) stepCalibration(m, now);
    else if (exercise && baseline) stepExercise(m, now);

    const fps = measureFps();
    bus.emit('frame', { t: now, pose, hand: hands[0] ?? null, hands, fps });
    overlay?.draw({ pose, hands, fps, delegate: models.delegate, info: lastInfo, target: exercise?.targetEvent() });
  }

  const engine = {
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
        const { createDebugOverlay, runDebugScenario } = await import('./debug.js');
        overlay = createDebugOverlay(video);
        if (params.has('auto')) runDebugScenario(engine, bus, overlay, params);
      }
      stopLoop = startLoop(video, onFrame);
    },
    stop() {
      stopLoop?.();
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    },
    setSide(s) { side = s === 'left' ? 'left' : 'right'; },
    calibrate() {
      exercise = null;
      return new Promise((resolve) => { calibration = { calib: createCalibration(side), resolve }; });
    },
    setExercise(id, opts = {}) {
      if (!baseline) throw new Error('setExercise: сначала calibrate()');
      if (exercise) finished.push(exercise.result());
      exercise = createExerciseSession(id, baseline, aspect(), opts);
      bus.emit('target', exercise.targetEvent());
    },
    pause() { paused = true; },
    resume() { paused = false; },
    getSummary() {
      const all = [...finished, ...(exercise ? [exercise.result()] : [])];
      // Одно упражнение могли пройти несколько раз — сливаем по id.
      const byId = new Map();
      for (const r of all) {
        const acc = byId.get(r.id) ?? { id: r.id, reps: 0, qualitySum: 0, bestRomDeg: 0, mistakes: {} };
        acc.reps += r.reps;
        acc.qualitySum += r.quality * r.reps;
        acc.bestRomDeg = Math.max(acc.bestRomDeg, r.bestRomDeg);
        for (const [code, n] of Object.entries(r.mistakes)) acc.mistakes[code] = (acc.mistakes[code] ?? 0) + n;
        byId.set(r.id, acc);
      }
      const exercises = [...byId.values()].map(({ qualitySum, ...e }) => ({ ...e, quality: e.reps ? qualitySum / e.reps : 0 }));
      const totalReps = exercises.reduce((s, e) => s + e.reps, 0);
      return {
        side,
        durationSec: Math.round((performance.now() - startedAt) / 1000),
        exercises,
        totalReps,
        accuracy: totalReps ? exercises.reduce((s, e) => s + e.quality * e.reps, 0) / totalReps : 0,
        mistakesCorrected: all.reduce((s, r) => s + r.corrected, 0),
      };
    },
  };
  return engine;
}
