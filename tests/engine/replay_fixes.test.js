// Ночь 2 (29→30.09): то, что нашли на живой записи 28.09, — в виде синтетических сценариев,
// чтобы правило проверялось на любом человеке, а не только на одной записи. Плюс граничные случаи
// «вау»-полей итогов (bestRep, moments): левая рука, без чистых повторов, повторная калибровка, человек пропал.
import { describe, it, expect, afterEach } from 'vitest';
import { measure } from '../../src/engine/body.js';
import { createCalibration } from '../../src/engine/calibration.js';
import { createExerciseSession, CLEAN_QUALITY } from '../../src/engine/session.js';
import { buildSummary } from '../../src/engine/summary.js';
import { snapshot } from '../../src/engine/moments.js';
import { makePose, frames, ASPECT } from './synth.js';

const UP = { out: 0.2, up: 1.6 };
const SIDE = { out: 1.5, up: 0.1 };
const REST = { out: 0.2, up: -0.6 };

function calibrate(side = 'right') {
  const calib = createCalibration(side);
  let r;
  for (const [pose, t] of frames([[makePose({ side }), 6200], [makePose({ side, wrist: UP }), 6200], [makePose({ side, wrist: SIDE }), 6200]])) {
    r = calib.push(measure(pose, side, ASPECT), t);
  }
  return r.baseline;
}
// Плавное движение руки a → b за ms (extra — остальные параметры позы).
function ramp(a, b, ms, extra = {}) {
  const n = Math.max(1, Math.round(ms / 33));
  return Array.from({ length: n }, (_, i) => {
    const k = (i + 1) / n;
    return [makePose({ wrist: { out: a.out + (b.out - a.out) * k, up: a.up + (b.up - a.up) * k }, ...extra }), 33];
  });
}
function run(session, seq, side = 'right', start = 20000) {
  const events = [];
  for (const [pose, t] of frames(seq, start)) events.push(...session.step(pose ? measure(pose, side, ASPECT) : null, t).events.map((e) => ({ ...e, t })));
  return events;
}
const ofType = (ev, type) => ev.filter((e) => e.type === type);
const codes = (ev) => ofType(ev, 'mistake').map((e) => e.payload.code);
const base = calibrate();

describe('упражнение стартует, когда рука ещё поднята (жест «✋ готов?» = поднятая ладонь)', () => {
  it('пока рука не опущена хоть раз — ни подсказок, ни повторов; потом обычный повтор', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [
      [makePose({ wrist: UP, hike: 0.45, shift: -0.3 }), 1500], // ладонь поднята для жеста, плечо и корпус как попало
      ...ramp(UP, REST, 250),                                    // быстро опустил — это не «рывок»
      [makePose(), 600],
      ...ramp(REST, UP, 1400), [makePose({ wrist: UP }), 900], ...ramp(UP, REST, 1200), [makePose(), 400],
    ]);
    expect(codes(ev)).toEqual([]);
    expect(ofType(ev, 'rep')).toHaveLength(1);
  });
});

describe('наклон вбок = сдвиг корпуса ЗА ПОВТОР, а не «сел левее, чем на калибровке»', () => {
  it('сидит на 0,3 ширины плеч левее нормы, поднимает руку ровно → нет TRUNK_LEAN_SIDE', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ shift: -0.3 }), 800], ...ramp(REST, UP, 1400, { shift: -0.3 }), [makePose({ wrist: UP, shift: -0.3 }), 900], ...ramp(UP, REST, 1200, { shift: -0.3 }), [makePose({ shift: -0.3 }), 400]]);
    expect(codes(ev)).not.toContain('TRUNK_LEAN_SIDE');
    expect(ofType(ev, 'rep')).toHaveLength(1);
  });
  it('сидит левее нормы и ещё наклоняется влево во время повтора → TRUNK_LEAN_SIDE «влево»', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ shift: -0.3 }), 800], [makePose({ wrist: UP, shift: -0.6 }), 1200], [makePose({ shift: -0.3 }), 400]]);
    const m = ofType(ev, 'mistake').find((e) => e.payload.code === 'TRUNK_LEAN_SIDE');
    expect(m).toBeTruthy();
    expect(m.payload.message).toMatch(/влево/);
  });
  it('сел ровно, как на калибровке, и наклонился → ловится, как раньше', () => {
    const s = createExerciseSession('reach_side', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: SIDE, shift: 0.3 }), 1200], [makePose(), 400]]);
    expect(codes(ev)).toContain('TRUNK_LEAN_SIDE');
  });
  it('кисть у рта закрыла лицо — точка носа «прыгнула» вбок, плечи на месте → не «наклон» (корпус = плечи)', () => {
    const s = createExerciseSession('hand_to_mouth', base, ASPECT);
    const mouth = { out: -0.5, up: 0.82 };
    const jumpy = makePose({ wrist: mouth });
    jumpy[0] = { ...jumpy[0], x: jumpy[0].x - (0.35 * 0.3) / ASPECT }; // нос на 0,35 ширины плеч влево
    const ev = run(s, [[makePose(), 400], ...ramp(REST, mouth, 1200), [jumpy, 800], ...ramp(mouth, REST, 1000), [makePose(), 400]]);
    expect(codes(ev)).not.toContain('TRUNK_LEAN_SIDE');
    expect(ofType(ev, 'rep')[0].payload.quality).toBeGreaterThanOrEqual(CLEAN_QUALITY);
  });
  it('сдвиг «к норме» во время повтора (сидел левее, выпрямился) — не ошибка', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ shift: -0.3 }), 800], [makePose({ wrist: UP }), 1200], [makePose(), 400]]);
    expect(codes(ev)).not.toContain('TRUNK_LEAN_SIDE');
  });
});

describe('ладонь была у звезды, удержание сорвала компенсация → не «Почти!»', () => {
  it('у звезды с поднятым плечом, опустил → SHOULDER_HIKE, но не INCOMPLETE_ROM', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], ...ramp(REST, UP, 1400), [makePose({ wrist: UP, hike: 0.45 }), 1500], ...ramp(UP, REST, 1200), [makePose(), 2500]]);
    expect(codes(ev)).toContain('SHOULDER_HIKE');
    expect(codes(ev)).not.toContain('INCOMPLETE_ROM');
    expect(ofType(ev, 'rep')).toHaveLength(0);
  });
  it('не дошёл до звезды — «не дотянулся» остаётся', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], ...ramp(REST, { out: 0.2, up: 0.6 }, 900), ...ramp({ out: 0.2, up: 0.6 }, REST, 800), [makePose(), 400]]);
    expect(codes(ev)).toContain('INCOMPLETE_ROM');
  });
});

describe('«Слишком быстро» — только когда рука идёт К звезде', () => {
  it('удержание сорвалось, руку быстро уронил вниз → нет TOO_FAST', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], ...ramp(REST, UP, 1400), [makePose({ wrist: UP, hike: 0.45 }), 1200], ...ramp(UP, REST, 230), [makePose(), 1500]]);
    expect(codes(ev)).not.toContain('TOO_FAST');
  });
  it('рывок вверх по-прежнему ловится', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], ...ramp(REST, UP, 230), [makePose({ wrist: UP }), 600], [makePose(), 400]]);
    expect(codes(ev)).toContain('TOO_FAST');
  });
});

describe('амплитуда повтора не «наследует» прошлую неудачную попытку', () => {
  it('reach_side: сначала махнул вверх (170°) и опустил, потом отвёл в сторону → romDeg этого повтора ~95°', () => {
    const s = createExerciseSession('reach_side', base, ASPECT);
    const ev = run(s, [
      [makePose(), 300], ...ramp(REST, UP, 1200), ...ramp(UP, REST, 1200), [makePose(), 600],
      ...ramp(REST, SIDE, 1400), [makePose({ wrist: SIDE }), 900], ...ramp(SIDE, REST, 1200), [makePose(), 400],
    ]);
    const reps = ofType(ev, 'rep');
    expect(reps).toHaveLength(1);
    expect(reps[0].payload.romDeg).toBeLessThan(110);
    expect(s.result().bestRomDeg).toBeLessThan(110);
  });
});

describe('bestRep / moments: граничные случаи', () => {
  it('левая рука: путь в «наружу/вверх» — out > 0 при отведении в сторону, side = left', () => {
    const lb = calibrate('left');
    const s = createExerciseSession('reach_side', lb, ASPECT);
    const L = (w) => makePose({ side: 'left', wrist: w });
    const seq = [[L(null), 300]];
    for (let i = 1; i <= 40; i += 1) seq.push([L({ out: REST.out + (SIDE.out - REST.out) * (i / 40), up: REST.up + (SIDE.up - REST.up) * (i / 40) }), 33]);
    seq.push([L(SIDE), 900]);
    for (let i = 1; i <= 36; i += 1) seq.push([L({ out: SIDE.out + (REST.out - SIDE.out) * (i / 36), up: SIDE.up + (REST.up - SIDE.up) * (i / 36) }), 33]);
    seq.push([L(null), 400]);
    run(s, seq, 'left');
    const b = s.result().bestRep;
    expect(b).toBeTruthy();
    expect(b.side).toBe('left');
    expect(Math.max(...b.pts.map((p) => p[1]))).toBeGreaterThan(1.2); // ушла наружу, а не внутрь
  });

  it('ни одного чистого повтора: bestRep всё равно есть (лучший из грязных), quality < 0.9 — UI решает, показывать ли', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 2 });
    const hiked = [...ramp(REST, UP, 1200, { hike: 0.45 }), [makePose({ wrist: UP }), 900], ...ramp(UP, REST, 1200), [makePose(), 400]];
    run(s, [[makePose(), 300], ...hiked, ...hiked]);
    const r = s.result();
    expect(r.reps).toBe(2);
    expect(r.cleanReps).toBe(0);
    expect(r.bestRep.quality).toBeLessThan(CLEAN_QUALITY);
    const sum = buildSummary([r], { side: 'right', durationSec: 10 });
    expect(sum.accuracy).toBe(0);
    expect(sum.exercises[0].bestRep).toBe(r.bestRep);
  });

  it('человек пропал из кадра посреди повтора: такой повтор не становится «лучшим» (иначе шар «Вы вчера» стоит на месте секунды)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    run(s, [
      [makePose(), 300], ...ramp(REST, UP, 1200), [makePose({ wrist: UP }), 300], [null, 3000], [makePose({ wrist: UP }), 600], ...ramp(UP, REST, 1000), [makePose(), 400],
      ...ramp(REST, UP, 1400), [makePose({ wrist: UP }), 900], ...ramp(UP, REST, 1200), [makePose(), 400],
    ]);
    const r = s.result();
    expect(r.reps).toBe(2);
    const b = r.bestRep;
    expect(b).toBeTruthy();
    const gaps = b.pts.slice(1).map((p, i) => p[0] - b.pts[i][0]);
    expect(Math.max(...gaps)).toBeLessThan(500);
    expect(b.ms).toBeLessThan(6000);
  });

  it('человек пропал, и других повторов нет — bestRep пустой, а не путь с дырой', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    run(s, [[makePose(), 300], ...ramp(REST, UP, 1200), [makePose({ wrist: UP }), 300], [null, 3000], [makePose({ wrist: UP }), 600], ...ramp(UP, REST, 1000), [makePose(), 400]]);
    expect(s.result().reps).toBe(1);
    expect(s.result().bestRep).toBeNull();
  });

  it('повторная калибровка посреди упражнения: итоги сливают обе части, bestRep — лучший из двух, стоп-кадр ошибки — первый', () => {
    const p1 = { id: 'reach_up', reps: 2, quality: 0.5, cleanReps: 0, bestRomDeg: 150, mistakes: { SHOULDER_HIKE: 2 }, corrected: 1,
      bestRep: { quality: 0.5, romDeg: 150, ms: 3000, side: 'right', pts: [[0, 0.2, -0.6], [3000, 0.2, 1.6]] }, moments: { mistake: { code: 'SHOULDER_HIKE', message: 'a', image: 'img1' } } };
    const p2 = { id: 'reach_up', reps: 3, quality: 1, cleanReps: 3, bestRomDeg: 165, mistakes: {}, corrected: 0,
      bestRep: { quality: 1, romDeg: 165, ms: 2800, side: 'right', pts: [[0, 0.2, -0.6], [2800, 0.3, 1.7]] }, moments: { mistake: { code: 'ELBOW_BENT', message: 'b', image: 'img2' }, good: { image: 'img3', romDeg: 165 } } };
    const e = buildSummary([p1, p2], { side: 'right', durationSec: 60 }).exercises[0];
    expect(e.reps).toBe(5);
    expect(e.bestRep).toBe(p2.bestRep);
    expect(e.moments.mistake.image).toBe('img1');
    expect(e.moments.good.image).toBe('img3');
    expect(e.bestRomDeg).toBe(165);
  });

  it('повторная калибровка в самой сессии: новая сессия с новой нормой начинает свой bestRep с нуля', () => {
    const s1 = createExerciseSession('reach_up', base, ASPECT);
    run(s1, [[makePose(), 300], ...ramp(REST, UP, 1400), [makePose({ wrist: UP }), 900], ...ramp(UP, REST, 1200), [makePose(), 400]]);
    const base2 = calibrate();
    const s2 = createExerciseSession('reach_up', base2, ASPECT);
    expect(s2.result().bestRep).toBeNull();
    expect(s1.result().bestRep).toBeTruthy();
  });
});

describe('стоп-кадр (moments.js) для левой руки', () => {
  const orig = globalThis.document;
  afterEach(() => { globalThis.document = orig; });
  it('обводит ЛЕВУЮ руку (точки 11→13→15), а не правую', () => {
    const lines = [];
    const g = {
      save() {}, restore() {}, translate() {}, scale() {}, drawImage() {}, setLineDash() {}, fill() {}, stroke() {}, arc() {}, closePath() {},
      beginPath() { lines.push([]); }, moveTo(x, y) { lines.at(-1).push([x, y]); }, lineTo(x, y) { lines.at(-1).push([x, y]); },
    };
    globalThis.document = { createElement: () => ({ getContext: () => g, toDataURL: () => 'data:image/jpeg;base64,x' }) };
    const pose = makePose({ side: 'left', wrist: SIDE });
    const img = snapshot({ videoWidth: 640, videoHeight: 480 }, pose, { kind: 'mistake', side: 'left', landmarks: [11] });
    expect(img).toMatch(/^data:image\/jpeg/);
    const W = 360, H = 270;
    const arm = lines[0];
    expect(arm).toHaveLength(3);
    [11, 13, 15].forEach((i, k) => {
      expect(arm[k][0]).toBeCloseTo(pose[i].x * W, 5);
      expect(arm[k][1]).toBeCloseTo(pose[i].y * H, 5);
    });
  });
  it('видео ещё не готово → null, без исключения', () => {
    expect(snapshot({ videoWidth: 0, videoHeight: 0 }, makePose(), { kind: 'good', side: 'right' })).toBeNull();
  });
});
