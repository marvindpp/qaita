// Mock-движок [E]: тот же API и те же события, что у src/engine (docs/CONTRACT.md), но без камеры и MediaPipe.
// Внутри «виртуальный пациент»: сидит на стуле, проходит калибровку, тянется к звезде, иногда компенсирует
// и исправляется. Сам показывает ладонь и поднимает руку, чтобы экраны листались без нас.
// URL: ?mock=1 · &speed=2 — ускорить · &manual — без автопациента (только клавиши) · &nopanel — без панели.
import { createEmitter } from '../engine/emitter.js';
import {
  buildPose, makeHand, createFakeCamera, shoulderOf, restWristOf, mouth, elevationDeg, OPEN, FIST, THUMB_UP,
} from './fakeBody.js';

const TICK_MS = 33;
const OUT = { left: -1, right: 1 };
const HAND_NAME = { left: 'левую', right: 'правую' };
const HAND_CAP = { left: 'Левую', right: 'Правую' };

// Тексты статусов — как у настоящего движка (framing.js / index.js).
export const STATUS_TEXT = {
  OK: 'Вижу вас',
  NO_CAMERA: 'Нет доступа к камере. Нажмите на значок камеры в адресной строке, разрешите доступ и обновите страницу',
  NO_PERSON: 'Сядьте перед камерой',
  TOO_CLOSE: 'Отодвиньтесь назад',
  TOO_FAR: 'Придвиньтесь ближе',
  LOW_VISIBILITY: 'Не видно рук. Отодвиньтесь',
  LOW_LIGHT: 'Темно. Включите свет',
};
const STATUS_CYCLE = ['OK', 'NO_PERSON', 'TOO_CLOSE', 'TOO_FAR', 'LOW_VISIBILITY', 'LOW_LIGHT'];
// Первые секунды «человек садится»: так UI экрана «Подготовка» видит, как правила загораются зелёным.
const STATUS_SCRIPT = [[0, 'NO_PERSON'], [1400, 'TOO_CLOSE'], [3000, 'OK']];

// Калибровка — те же фазы и тексты, что в engine/calibration.js.
const CALIB = [
  { id: 'neutral', prepMs: 3000, ms: 3000 },
  { id: 'max_up', prepMs: 3000, ms: 3000 },
  { id: 'max_side', prepMs: 3000, ms: 3000 },
];
function phaseMessage(phase, side) {
  switch (phase) {
    case 'neutral': return 'Сядьте ровно, руки вниз';
    case 'max_up': return `${HAND_CAP[side]} руку — вверх до упора`;
    case 'max_side': return `${HAND_CAP[side]} руку — в сторону до упора`;
    default: return 'Готово!';
  }
}

// Жесты: время удержания как в engine/gestures.js и какие жесты слышны в каком режиме.
const HOLD_MS = { PALM_HOLD: 1000, THUMBS_UP: 700, PAUSE: 800, RAISE_LEFT: 1000, RAISE_RIGHT: 1000 };
const GESTURE_REACH_MS = 350; // рука поднимается к жесту — пока не считаем
const GESTURES_IDLE = new Set(['PALM_HOLD', 'THUMBS_UP', 'PAUSE', 'RAISE_LEFT', 'RAISE_RIGHT']);
const GESTURES_EXERCISE = new Set(['PAUSE', 'THUMBS_UP']);
const GESTURES_NONE = new Set();

// Повтор: фазы по времени сценария (мс).
const REP = { REST: 900, REACHING: 1500, HOLD: 700, RETURNING: 1100 };
const MISTAKE_AT = 0.6;    // на какой доле пути пациент «компенсирует»
const MISTAKE_MS = 2200;   // сколько держит ошибку, пока не исправится
const CLEAN = 0.9;         // порог «чистого» повтора (правила игры)

// Когда пациент ошибается (номер повтора → код). В reach_up первые 3 чистые — видно адаптивную сложность.
const MISTAKE_PLAN = {
  reach_up: { 4: 'SHOULDER_HIKE' },
  reach_side: { 2: 'TRUNK_LEAN_SIDE', 4: 'ELBOW_BENT' },
  hand_to_mouth: { 2: 'TRUNK_LEAN_FORWARD', 4: 'TOO_FAST' },
  reach_across: { 2: 'ELBOW_BENT', 3: 'WRONG_HAND' },
  open_hand: { 2: 'FINGERS_NOT_OPEN', 4: 'INCOMPLETE_ROM' },
};
const ALL_MISTAKES = ['SHOULDER_HIKE', 'TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE', 'ELBOW_BENT', 'TOO_FAST', 'INCOMPLETE_ROM', 'WRONG_HAND', 'FINGERS_NOT_OPEN'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const lerpP = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

function mistakePayload(code, side) {
  const i = side === 'left' ? { sh: 11, el: 13, wr: 15, ear: 7, otherWr: 16 } : { sh: 12, el: 14, wr: 16, ear: 8, otherWr: 15 };
  switch (code) {
    case 'TRUNK_LEAN_FORWARD': return { code, severity: 3, landmarks: [11, 12, 0], valueCm: 7, message: 'Наклон вперёд на 7 см. Спину ровно!' };
    case 'TRUNK_LEAN_SIDE': return { code, severity: 3, landmarks: [11, 12, 0], valueCm: 5, message: `Корпус ${side === 'right' ? 'влево' : 'вправо'} на 5 см. Сядьте ровно!` };
    case 'SHOULDER_HIKE': return { code, severity: 2, landmarks: [i.sh, i.ear], valueCm: 4, message: 'Плечо к уху на 4 см. Опустите плечо!' };
    case 'ELBOW_BENT': return { code, severity: 2, landmarks: [i.sh, i.el, i.wr], valueDeg: 128, message: 'Локоть согнут. Выпрямите руку!' };
    case 'TOO_FAST': return { code, severity: 1, landmarks: [i.wr], message: 'Слишком быстро. Медленнее!' };
    case 'INCOMPLETE_ROM': return { code, severity: 1, landmarks: [i.wr], valueCm: 6, message: 'Ещё 6 см. Чуть выше!' };
    case 'WRONG_HAND': return { code, severity: 2, landmarks: [i.otherWr], message: `Не та рука. Тянитесь ${HAND_NAME[side]}!` };
    case 'FINGERS_NOT_OPEN': return { code, severity: 1, landmarks: [i.wr], message: 'Мизинец согнут. Раскройте ладонь!' };
    default: return { code, severity: 1, landmarks: [], message: code };
  }
}

// Звезда-цель для упражнения, нормированные координаты. stretch — адаптивная сложность (+5% за 3 чистых подряд).
function targetFor(id, side, stretch) {
  const sh = shoulderOf(side), o = OUT[side];
  const edgeX = 0.17, edgeY = 0.17 * (4 / 3); // как clamp в engine/exercises.js
  const far = (p) => ({ x: sh.x + (p.x - sh.x) * stretch, y: sh.y + (p.y - sh.y) * stretch });
  let p, radius = 0.075;
  switch (id) {
    case 'reach_up': p = far({ x: sh.x + 0.07 * o, y: sh.y - 0.32 }); break;
    case 'reach_side': p = far({ x: sh.x + 0.22 * o, y: sh.y - 0.03 }); break;
    case 'hand_to_mouth': p = mouth(); radius = 0.055; break;
    case 'reach_across': p = { x: 0.5 - 0.1 * o, y: sh.y + 0.07 }; break;
    case 'open_hand': p = { x: sh.x + 0.03 * o, y: sh.y + 0.02 }; radius = 0.07; break;
    default: p = far({ x: sh.x, y: sh.y - 0.3 });
  }
  return { x: clamp(p.x, edgeX, 1 - edgeX), y: clamp(p.y, edgeY, 1 - edgeY), radius };
}

// Куда тянется запястье, чтобы «попасть в звезду».
function wristGoal(id, side, target) {
  if (id === 'hand_to_mouth') return { x: target.x + 0.02 * OUT[side], y: target.y + 0.05 };
  if (id === 'open_hand') return { x: target.x, y: target.y + 0.1 };
  return { x: target.x, y: target.y + 0.02 };
}

export async function createEngine({ video } = {}) {
  const bus = createEmitter();
  const params = new URLSearchParams(location.search);
  const speed = clamp(Number(params.get('speed')) || 1, 0.25, 8);
  let auto = !params.has('manual');

  const camera = video ? createFakeCamera(video) : null;
  let timer = null, lastReal = null;
  let simNow = 0;          // время симуляции (мс), идёт всегда
  const startedAt = performance.now();

  let side = 'right';
  let paused = false;
  let mode = 'idle';       // idle | calibration | exercise
  let status = null, statusOverride = null;
  let baseline = null;
  let calib = null;        // { phaseIdx, prep, elapsed, resolve }
  let ex = null;           // текущее упражнение
  const finished = [];

  // Жест, который сейчас «показывает» пациент.
  let act = null;          // { type, t0, lastSent, fired, releaseAt }
  let lastActEnd = 0, autoTurn = 0;
  let forcedMistake = null, forcedIdx = 0;

  // Тело: текущее (плавно догоняет желаемое).
  const body = {
    wrist: { left: restWristOf('left'), right: restWristOf('right') },
    bend: { left: 0, right: 0 }, hike: { left: 0, right: 0 }, leanSide: 0, leanFwd: 0, breath: 0, visible: true,
  };
  let curl = { left: [...FIST], right: [...FIST] };

  const setStatus = (code) => {
    if (status === code) return;
    status = code;
    bus.emit('status', { code, message: STATUS_TEXT[code] });
  };

  const allowedGestures = () => (paused ? GESTURES_IDLE
    : mode === 'calibration' ? GESTURES_NONE
      : mode === 'exercise' && ex && !ex.done ? GESTURES_EXERCISE : GESTURES_IDLE);

  // ——— жесты ———
  function startGesture(type) {
    if (act && !act.fired && act.lastSent > 0) bus.emit('gesture', { type: act.type, progress: 0, fired: false });
    act = { type, t0: simNow, lastSent: -1, fired: false, releaseAt: null };
  }

  function stepGesture() {
    if (!act) return;
    if (act.releaseAt != null) {
      if (simNow >= act.releaseAt) { act = null; lastActEnd = simNow; }
      return;
    }
    const counting = simNow - act.t0 - GESTURE_REACH_MS;
    if (counting < 0) return;
    const progress = Math.min(1, counting / HOLD_MS[act.type]);
    const allowed = allowedGestures().has(act.type);
    if (progress >= 1) {
      if (allowed) bus.emit('gesture', { type: act.type, progress: 1, fired: true });
      act.fired = true;
      act.releaseAt = simNow + 350;
      return;
    }
    const q = Math.floor(progress * 10) / 10; // как движок: шаг 10%
    if (allowed && q !== act.lastSent) {
      act.lastSent = q;
      bus.emit('gesture', { type: act.type, progress: q, fired: false });
    }
  }

  // Автопациент: в спокойном режиме по очереди показывает ладонь и поднимает руку.
  // UI сам решает, какой жест на каком экране что значит, лишние игнорирует.
  function stepAutoUser() {
    if (!auto || act) return;
    const idle = paused || mode === 'idle' || (mode === 'exercise' && ex?.done);
    if (!idle || simNow - lastActEnd < 2200) return;
    const seq = ['PALM_HOLD', side === 'left' ? 'RAISE_LEFT' : 'RAISE_RIGHT'];
    startGesture(seq[autoTurn % seq.length]);
    autoTurn += 1;
  }

  // ——— статус кадра ———
  function stepStatus(realSinceStart) {
    let code = statusOverride;
    if (!code) {
      code = 'OK';
      for (const [at, c] of STATUS_SCRIPT) if (realSinceStart >= at) code = c;
    }
    // Во время упражнения движок молчит про расстояние: там это ловят ошибки наклона.
    if (mode === 'exercise' && !['NO_PERSON', 'LOW_LIGHT', 'OK'].includes(code)) code = 'OK';
    setStatus(code);
  }

  // ——— калибровка ———
  function stepCalibration(dt) {
    const phase = CALIB[calib.phaseIdx];
    if (phase.id === 'neutral' && status !== 'OK') {
      bus.emit('calibration', { phase: phase.id, progress: 0, message: STATUS_TEXT[status] });
      return;
    }
    if (calib.prep < phase.prepMs) {
      calib.prep += dt;
      const left = Math.max(1, Math.ceil((phase.prepMs - calib.prep) / 1000));
      bus.emit('calibration', { phase: phase.id, progress: 0, message: `${phaseMessage(phase.id, side)} · ${left}…` });
      return;
    }
    calib.elapsed += dt;
    if (calib.elapsed >= phase.ms) {
      calib.phaseIdx += 1; calib.prep = 0; calib.elapsed = 0;
      if (calib.phaseIdx >= CALIB.length) {
        bus.emit('calibration', { phase: 'done', progress: 1, message: phaseMessage('done', side) });
        baseline = { side, mock: true, maxUpDeg: 158 };
        const { resolve } = calib;
        calib = null;
        mode = 'idle';
        resolve(baseline);
        return;
      }
      const next = CALIB[calib.phaseIdx];
      bus.emit('calibration', { phase: next.id, progress: 0, message: `${phaseMessage(next.id, side)} · 3…` });
      return;
    }
    bus.emit('calibration', { phase: phase.id, progress: calib.elapsed / phase.ms, message: phaseMessage(phase.id, side) });
  }

  // ——— упражнение ———
  function newExercise(id, targetReps) {
    const e = {
      id, targetReps, count: 0, qualitySum: 0, bestRomDeg: 0, mistakes: {}, corrected: 0,
      phase: 'REST', phaseT: 0, stretch: 1, streak: 0, done: false,
      mistake: null, mistakeT: 0, hadMistake: false, peakRom: 0, reach: 0,
    };
    e.target = targetFor(id, side, e.stretch);
    return e;
  }

  const emitTarget = () => bus.emit('target', { x: ex.target.x, y: ex.target.y, radius: ex.target.radius });

  function beginMistake(code) {
    ex.mistake = code;
    ex.mistakeT = 0;
    ex.hadMistake = true;
    ex.mistakes[code] = (ex.mistakes[code] ?? 0) + 1;
    bus.emit('mistake', mistakePayload(code, side));
  }

  function stepExercise(dt) {
    if (ex.done) { ex.reach = Math.max(0, ex.reach - dt / 600); return; }
    ex.phaseT += dt;
    const repNo = ex.count + 1;

    if (ex.mistake) {
      ex.mistakeT += dt;
      if (ex.mistakeT >= MISTAKE_MS) {
        bus.emit('mistake-cleared', { code: ex.mistake });
        ex.corrected += 1;
        ex.mistake = null;
      }
      return; // пока ошибка — звезда не засчитывается, пациент «застыл»
    }

    switch (ex.phase) {
      case 'REST':
        ex.reach = 0;
        if (ex.phaseT >= REP.REST) { ex.phase = 'REACHING'; ex.phaseT = 0; ex.hadMistake = false; ex.peakRom = 0; }
        break;
      case 'REACHING': {
        const fast = MISTAKE_PLAN[ex.id]?.[repNo] === 'TOO_FAST' && !ex.hadMistake;
        const dur = fast ? REP.REACHING * 0.35 : REP.REACHING;
        const k = Math.min(1, ex.phaseT / dur);
        const planned = forcedMistake ?? MISTAKE_PLAN[ex.id]?.[repNo];
        const at = planned === 'TOO_FAST' ? 0.95 : MISTAKE_AT;
        ex.reach = ease(k);
        if (planned && !ex.hadMistake && k >= at) {
          if (forcedMistake) forcedMistake = null;
          beginMistake(planned);
          return;
        }
        if (k >= 1) { ex.phase = 'HOLD'; ex.phaseT = 0; }
        break;
      }
      case 'HOLD':
        ex.reach = 1;
        if (ex.phaseT >= REP.HOLD) { ex.phase = 'RETURNING'; ex.phaseT = 0; }
        break;
      case 'RETURNING': {
        const k = Math.min(1, ex.phaseT / REP.RETURNING);
        ex.reach = 1 - ease(k);
        if (k >= 1) finishRep();
        break;
      }
      default: break;
    }
  }

  function finishRep() {
    const quality = ex.hadMistake ? 0.62 + Math.random() * 0.12 : 0.92 + Math.random() * 0.08;
    ex.count += 1;
    ex.qualitySum += quality;
    const romDeg = Math.round(ex.peakRom);
    ex.bestRomDeg = Math.max(ex.bestRomDeg, romDeg);
    bus.emit('rep', { exercise: ex.id, count: ex.count, targetReps: ex.targetReps, quality, romDeg });
    ex.phase = 'REST';
    ex.phaseT = 0;

    if (ex.count >= ex.targetReps) {
      ex.done = true;
      bus.emit('exercise-done', { exercise: ex.id, reps: ex.count, quality: ex.qualitySum / ex.count });
      return;
    }
    // Адаптивная сложность как в движке: каждые 3 чистых подряд → звезда дальше на 5%.
    ex.streak = quality >= CLEAN ? ex.streak + 1 : 0;
    if (ex.streak >= 3 && ex.stretch < 1.4 && ['reach_up', 'reach_side'].includes(ex.id)) {
      ex.stretch = Math.round((ex.stretch + 0.05) * 100) / 100;
      ex.streak = 0;
      ex.target = targetFor(ex.id, side, ex.stretch);
      emitTarget();
    }
  }

  // ——— желаемая поза тела из режима, упражнения и жеста ———
  function desiredBody() {
    const other = side === 'left' ? 'right' : 'left';
    const d = {
      wrist: { left: restWristOf('left'), right: restWristOf('right') },
      bend: { left: 0, right: 0 }, hike: { left: 0, right: 0 }, leanSide: 0, leanFwd: 0,
      curl: { left: [...FIST], right: [...FIST] },
      visible: status !== 'NO_PERSON',
    };
    const sh = (s) => shoulderOf(s);

    if (mode === 'calibration' && calib) {
      const phase = CALIB[calib.phaseIdx];
      const going = calib.prep > phase.prepMs - 700; // рука начинает движение к концу отсчёта
      if (phase.id === 'max_up' && going) { d.wrist[side] = { x: sh(side).x + 0.02 * OUT[side], y: sh(side).y - 0.36 }; d.curl[side] = OPEN; }
      if (phase.id === 'max_side' && going) { d.wrist[side] = { x: sh(side).x + 0.34 * OUT[side], y: sh(side).y - 0.03 }; d.curl[side] = OPEN; }
    }

    if (mode === 'exercise' && ex) {
      const goal = wristGoal(ex.id, side, ex.target);
      const rest = restWristOf(side);
      const m = ex.mistake;
      if (ex.id === 'open_hand') {
        // Рука поднята перед грудью всё упражнение, повтор = кулак → ладонь → кулак.
        d.wrist[side] = ex.done ? rest : goal;
        const open = m === 'FINGERS_NOT_OPEN' ? [0.1, 0.1, 0.15, 0.85, 0.9] : m === 'INCOMPLETE_ROM' ? [0.5, 0.5, 0.5, 0.55, 0.6] : null;
        d.curl[side] = open ?? FIST.map((c) => c * (1 - ex.reach));
      } else {
        let k = ex.reach;
        if (m === 'INCOMPLETE_ROM') k = Math.min(k, 0.7);
        if (m === 'WRONG_HAND') { k = 0.1; d.wrist[other] = lerpP(restWristOf(other), { x: sh(other).x - 0.02 * OUT[side], y: sh(other).y - 0.2 }, 1); d.curl[other] = OPEN; }
        d.wrist[side] = lerpP(rest, goal, k);
        d.curl[side] = k > 0.35 ? OPEN : FIST;
        if (m === 'ELBOW_BENT') d.bend[side] = 1;
        if (m === 'SHOULDER_HIKE') d.hike[side] = 1;
        if (m === 'TRUNK_LEAN_SIDE') d.leanSide = -OUT[side];
        if (m === 'TRUNK_LEAN_FORWARD') d.leanFwd = 1;
      }
    }

    if (act) {
      const t = act.type;
      const g = side; // ладонью «командует» рабочая рука
      if (t === 'PALM_HOLD') { d.wrist[g] = { x: sh(g).x + 0.07 * OUT[g], y: sh(g).y - 0.12 }; d.curl[g] = OPEN; }
      if (t === 'THUMBS_UP') { d.wrist[g] = { x: sh(g).x - 0.02 * OUT[g], y: sh(g).y + 0.03 }; d.curl[g] = THUMB_UP; }
      if (t === 'PAUSE') {
        for (const s of ['left', 'right']) { d.wrist[s] = { x: sh(s).x + 0.07 * OUT[s], y: sh(s).y - 0.12 }; d.curl[s] = OPEN; }
      }
      if (t === 'RAISE_LEFT' || t === 'RAISE_RIGHT') {
        const s = t === 'RAISE_LEFT' ? 'left' : 'right';
        d.wrist[s] = { x: sh(s).x + 0.03 * OUT[s], y: sh(s).y - 0.34 };
        d.curl[s] = OPEN;
      }
    }
    return d;
  }

  function stepBody(dt) {
    const d = desiredBody();
    const k = 1 - Math.exp(-dt / 110);
    for (const s of ['left', 'right']) {
      body.wrist[s] = lerpP(body.wrist[s], d.wrist[s], k);
      body.bend[s] += (d.bend[s] - body.bend[s]) * k;
      body.hike[s] += (d.hike[s] - body.hike[s]) * k;
      curl[s] = curl[s].map((c, i) => c + (d.curl[s][i] - c) * k);
    }
    body.leanSide += (d.leanSide - body.leanSide) * k;
    body.leanFwd += (d.leanFwd - body.leanFwd) * k;
    body.breath = Math.sin((simNow / 4000) * Math.PI * 2) * 0.004;
    body.visible = d.visible;
  }

  function handsFor(pose) {
    if (!pose) return [];
    const hands = [];
    for (const s of [side, side === 'left' ? 'right' : 'left']) {
      const [iEl, iWr] = s === 'left' ? [13, 15] : [14, 16];
      const wr = pose[iWr], el = pose[iEl];
      if (wr.y > shoulderOf(s).y + 0.2) continue; // рука на коленях — кисть детектор обычно не находит
      const thumbsUp = act?.type === 'THUMBS_UP' && s === side;
      // В жестах «ладонь к камере» пальцы смотрят вверх, в упражнениях — продолжают предплечье.
      const palmUp = act && ['PALM_HOLD', 'PAUSE', 'RAISE_LEFT', 'RAISE_RIGHT'].includes(act.type);
      const angle = thumbsUp ? (s === 'right' ? Math.PI : 0) : palmUp ? -Math.PI / 2 : Math.atan2(wr.y - el.y, (wr.x - el.x) * (4 / 3));
      hands.push(makeHand(wr, angle, curl[s], s));
    }
    return hands;
  }

  function tick() {
    const real = performance.now();
    const dtReal = lastReal == null ? TICK_MS : Math.min(real - lastReal, 100);
    lastReal = real;
    const dt = dtReal * speed;
    simNow += dt;

    stepStatus((real - startedAt) * speed);
    stepAutoUser();
    stepGesture();
    if (!paused && mode === 'calibration' && calib) stepCalibration(dt);
    if (!paused && mode === 'exercise' && ex) stepExercise(dt);

    stepBody(dt);
    const pose = buildPose(body);
    if (pose && mode === 'exercise' && ex && ex.phase !== 'REST') {
      const [iSh, iWr] = side === 'left' ? [11, 15] : [12, 16];
      ex.peakRom = Math.max(ex.peakRom, elevationDeg(pose[iSh], pose[iWr]));
    }
    const hands = handsFor(pose);
    camera?.draw(pose, hands, status === 'LOW_LIGHT' ? 0.62 : 0);
    bus.emit('frame', { t: real, pose, hand: hands[0] ?? null, hands, fps: 30 });
  }

  // Управление для панели разработчика (не часть контракта, UI его не видит).
  const controls = {
    gesture: (type) => startGesture(type),
    cycleStatus() {
      const cur = statusOverride ?? status ?? 'OK';
      statusOverride = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      return statusOverride;
    },
    forceMistake() {
      forcedMistake = ALL_MISTAKES[forcedIdx % ALL_MISTAKES.length];
      forcedIdx += 1;
      return forcedMistake;
    },
    toggleAuto() { auto = !auto; return auto; },
    get auto() { return auto; },
    get state() { return { mode, paused, side, status, speed }; },
  };

  const engine = {
    on: bus.on,
    async start() {
      await camera?.attach();
      timer = setInterval(tick, TICK_MS);
      if (!params.has('nopanel')) {
        const { createMockPanel } = await import('./panel.js');
        createMockPanel(controls);
      }
    },
    stop() {
      clearInterval(timer);
      timer = null;
      camera?.detach();
    },
    setSide(s) { side = s === 'left' ? 'left' : 'right'; },
    calibrate() {
      ex = null;
      mode = 'calibration';
      return new Promise((resolve) => { calib = { phaseIdx: 0, prep: 0, elapsed: 0, resolve }; });
    },
    setExercise(id, opts = {}) {
      if (!baseline) throw new Error('setExercise: сначала calibrate()');
      if (ex) finished.push(result(ex));
      ex = newExercise(id, opts.targetReps ?? 5);
      mode = 'exercise';
      emitTarget();
    },
    pause() { paused = true; },
    resume() { paused = false; },
    getSummary() {
      const all = [...finished, ...(ex ? [result(ex)] : [])];
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

function result(e) {
  return { id: e.id, reps: e.count, quality: e.count ? e.qualitySum / e.count : 0, bestRomDeg: e.bestRomDeg, mistakes: { ...e.mistakes }, corrected: e.corrected };
}
