// Движок Qaita [D]. API — docs/CONTRACT.md.
import { createEmitter } from './emitter.js';
import { openCamera } from './camera.js';
import { loadModels } from './models.js';
import { createSmoother, mirror } from './smoothing.js';
import { startLoop, createFpsMeter } from './loop.js';
import { measure } from './body.js';
import { createCalibration } from './calibration.js';
import { createExerciseSession } from './session.js';
import { checkFraming } from './framing.js';
import { detectGesture, createGestureHold } from './gestures.js';
import { buildSummary } from './summary.js';
import { snapshot } from './moments.js';

// Какие жесты слушаем в каком режиме: во время упражнения ладонь = часть движения, поэтому только пауза и «палец вверх».
const GESTURES_IDLE = new Set(['PALM_HOLD', 'THUMBS_UP', 'PAUSE', 'RAISE_LEFT', 'RAISE_RIGHT']);
const GESTURES_EXERCISE = new Set(['PAUSE', 'THUMBS_UP']);
// Пока рука в движении — только пауза: кулак у рта в «Чашке ко рту» с поднятым большим пальцем похож на лайк
// (живая запись 29.09: 0,36–0,52 при пороге лайка 0,35).
const GESTURES_MOVING = new Set(['PAUSE']);
const GESTURES_NONE = new Set();
const EXERCISE_STATUSES = new Set(['NO_PERSON', 'LOW_LIGHT']); // во время упражнения «слишком близко» ловит ошибка наклона

const NO_PERSON_MS = 1000; // столько без позы → статус NO_PERSON

/** @param {{ video: HTMLVideoElement }} opts */
export async function createEngine({ video }) {
  const bus = createEmitter();
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');
  const poseSmoother = createSmoother(0.5);
  const measureFps = createFpsMeter();

  let stream = null, models = null, stopLoop = null, overlay = null, recorder = null;
  let side = 'right';
  let paused = false;
  let status = null;
  let lastPoseAt = 0, lastVideoTime = -1, frameNo = 0;
  let hands = [];
  let brightness = null, lastBrightnessAt = -Infinity;
  const gestureHold = createGestureHold();

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

  // Средняя яркость кадра раз в секунду по уменьшенной копии 32×24.
  const probe = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  function sampleBrightness(now) {
    if (!probe || now - lastBrightnessAt < 1000) return;
    lastBrightnessAt = now;
    probe.width = 32; probe.height = 24;
    const c = probe.getContext('2d', { willReadFrequently: true });
    c.drawImage(video, 0, 0, 32, 24);
    const px = c.getImageData(0, 0, 32, 24).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    brightness = sum / (px.length / 4);
  }

  const aspect = () => (video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3);

  function stepCalibration(m, now, framing) {
    const r = calibration.calib.push(m, now, framing);
    bus.emit('calibration', { phase: r.phase, progress: r.progress, message: r.message });
    lastInfo = { calib: `${r.phase} ${(r.progress * 100) | 0}%` };
    if (r.done) {
      baseline = r.baseline;
      const { resolve } = calibration;
      calibration = null;
      resolve(baseline);
    }
  }

  // «До/после»: первый серьёзный промах (severity ≥ 2) и лучший чистый повтор — стоп-кадрами в итоги.
  let pendingGood = null;
  function captureMoments(pose, events, info) {
    const mo = exercise.moments;
    if (lastInfo.phase === 'HOLD' && info.phase === 'RETURNING' && pose) {
      pendingGood = snapshot(video, pose, { kind: 'good', side, target: exercise.targetEvent() });
    }
    for (const e of events) {
      if (e.type === 'mistake' && e.payload.severity >= 2 && !mo.mistake && pose) {
        mo.mistake = { code: e.payload.code, message: e.payload.message, image: snapshot(video, pose, { kind: 'mistake', side, landmarks: e.payload.landmarks }) };
      }
      if (e.type === 'rep') {
        if (pendingGood && e.payload.quality >= 0.9 && (!mo.good || e.payload.romDeg > mo.good.romDeg)) mo.good = { image: pendingGood, romDeg: e.payload.romDeg };
        pendingGood = null;
      }
    }
  }

  function stepExercise(m, now, pose) {
    const { events, info } = exercise.step(m, now);
    try { captureMoments(pose, events, info); } catch (err) { console.warn('[qaita] snapshot', err); }
    for (const e of events) bus.emit(e.type, e.payload);
    lastInfo = {
      ...info, elev: m?.elevationDeg, elbow: m?.elbowDeg,
      widthRatio: m && baseline ? m.Sx / baseline.Sx : null, earSh: m?.earSh, baseEarSh: baseline?.earSh,
    };
  }

  function onFrame(now) {
    if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    frameNo += 1;

    const rawPose = models.pose.detectForVideo(video, now).landmarks?.[0] ?? null;
    const pose = poseSmoother.next(mirror(rawPose));
    if (frameNo % 2 === 0) hands = (models.hand.detectForVideo(video, now).landmarks ?? []).map(mirror);

    sampleBrightness(now);
    recorder?.frame(now, pose, hands);
    const m = measure(pose, side, aspect(), hands);
    const framing = checkFraming(pose, m, brightness);
    if (pose) lastPoseAt = now;
    const personLost = !pose && now - lastPoseAt > NO_PERSON_MS;
    if (framing.code !== 'NO_PERSON' || personLost) {
      const quiet = exercise && !EXERCISE_STATUSES.has(framing.code);
      if (quiet) setStatus('OK', 'Вижу вас');
      else setStatus(framing.code, framing.message);
    }

    // На паузе упражнение стоит, но жесты видны — иначе паузу не снять без мыши.
    if (!paused && calibration) stepCalibration(m, now, framing);
    else if (!paused && exercise && baseline) stepExercise(m, now, pose);

    const allow = paused ? GESTURES_IDLE : calibration ? GESTURES_NONE : exercise && !exercise.done ? (lastInfo.phase && lastInfo.phase !== 'REST' ? GESTURES_MOVING : GESTURES_EXERCISE) : GESTURES_IDLE;
    for (const g of gestureHold.update(detectGesture({ hands, m, allow }), now)) bus.emit('gesture', g);

    const fps = measureFps();
    bus.emit('frame', { t: now, pose, hand: hands[0] ?? null, hands, fps });
    overlay?.draw({ pose, hands, fps, delegate: models.delegate, info: lastInfo, target: exercise && !exercise.done ? exercise.targetEvent() : null, framing, side, showGuide: !baseline || !!calibration });
  }

  const engine = {
    on: bus.on,
    async start() {
      try {
        stream = await openCamera(video);
      } catch {
        setStatus('NO_CAMERA', 'Разрешите камеру в адресной строке и обновите страницу');
        return;
      }
      models = await loadModels();
      if (debug || params.has('rec')) {
        const { createDebugOverlay, runDebugScenario, createRecorder } = await import('./debug.js');
        if (params.has('rec')) {
          recorder = createRecorder(video);
          // Плейтест на настоящем интерфейсе (?rec=1 без debug): запись скачивается клавишей S.
          if (!params.has('auto')) addEventListener('keydown', (e) => { if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') recorder.download(); });
        }
        if (debug) {
          overlay = createDebugOverlay(video, { showNumbers: params.get('debug') === '2' });
          if (params.has('auto')) runDebugScenario(engine, bus, overlay, params, recorder);
        }
      }
      stopLoop = startLoop(video, onFrame);
    },
    stop() {
      stopLoop?.();
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    },
    setSide(s) { side = s === 'left' ? 'left' : 'right'; if (!params.has('auto')) recorder?.mark(performance.now(), 'side', { side }); },
    calibrate() {
      // Повторная калибровка посреди сессии не должна стирать уже сделанные повторы из итогов.
      if (exercise) finished.push(exercise.result());
      exercise = null;
      if (!params.has('auto')) recorder?.mark(performance.now(), 'calibrate');
      return new Promise((resolve) => { calibration = { calib: createCalibration(side), resolve }; });
    },
    setExercise(id, opts = {}) {
      if (!baseline) throw new Error('setExercise: сначала calibrate()');
      if (exercise) finished.push(exercise.result());
      exercise = createExerciseSession(id, baseline, aspect(), opts);
      if (!params.has('auto')) recorder?.mark(performance.now(), 'exercise', { id, targetReps: opts.targetReps ?? 5 });
      bus.emit('target', exercise.targetEvent());
    },
    pause() { paused = true; },
    resume() { paused = false; },
    getSummary() {
      const all = [...finished, ...(exercise ? [exercise.result()] : [])];
      return buildSummary(all, { side, durationSec: Math.round((performance.now() - startedAt) / 1000) });
    },
  };
  return engine;
}
