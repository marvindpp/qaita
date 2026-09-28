// Ночное ревью движка 28→29.09: сначала падающий тест на баг, потом фикс. Плюс граничные случаи.
import { describe, it, expect } from 'vitest';
import { measure } from '../../src/engine/body.js';
import { createCalibration } from '../../src/engine/calibration.js';
import { createExerciseSession } from '../../src/engine/session.js';
import { detectMistakes } from '../../src/engine/mistakes.js';
import { buildSummary } from '../../src/engine/summary.js';
import { makePose, frames, ASPECT } from './synth.js';

const UP = { out: 0.2, up: 1.6 };
const SIDE = { out: 1.5, up: 0.1 };

function calibrate(side = 'right', { up = UP, sideReach = SIDE } = {}) {
  const calib = createCalibration(side);
  let r;
  for (const [pose, t] of frames([
    [makePose({ side }), 6200],
    [makePose({ side, wrist: up }), 6200],
    [makePose({ side, wrist: sideReach }), 6200],
  ])) r = calib.push(measure(pose, side, ASPECT), t);
  return r.baseline;
}

// seq: [[pose|null, ms], ...]; pose=null → человека нет в кадре (measure вернёт null).
function run(session, seq, side = 'right', start = 20000) {
  const events = [];
  for (const [pose, t] of frames(seq, start)) events.push(...session.step(pose ? measure(pose, side, ASPECT) : null, t).events);
  return events;
}
const ofType = (ev, type) => ev.filter((e) => e.type === type);
const codes = (ev, type = 'mistake') => ofType(ev, type).map((e) => e.payload.code);

// ───────────────────────── Баги ─────────────────────────

describe('БАГ 1: человек пропал из кадра во время ошибки ≠ «исправился»', () => {
  const base = calibrate();
  it('уход из кадра не шлёт mistake-cleared и не засчитывает «исправление» (+50 очков)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [
      [makePose(), 300],
      [makePose({ wrist: UP, hike: 0.45 }), 1000], // компенсация → подсказка
      [null, 1500],                                 // встал и ушёл
    ]);
    expect(codes(ev)).toContain('SHOULDER_HIKE');
    expect(codes(ev, 'mistake-cleared')).toEqual([]);
    expect(s.result().corrected).toBe(0);
  });
  it('вернулся и исправился — вот тогда «исправился»', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [
      [makePose(), 300],
      [makePose({ wrist: UP, hike: 0.45 }), 1000],
      [null, 1500],
      [makePose({ wrist: UP }), 1200],
      [makePose(), 400],
    ]);
    expect(codes(ev, 'mistake-cleared')).toEqual(['SHOULDER_HIKE']);
    expect(s.result().corrected).toBe(1);
    expect(ofType(ev, 'rep')).toHaveLength(1);
  });
});

describe('БАГ 2: слабая рука на калибровке → звезда в зоне «рука опущена», повтор невозможен', () => {
  // Пациент смог поднять руку только чуть-чуть (запястье ниже плеча).
  const weak = calibrate('right', { up: { out: 0.3, up: -0.6 }, sideReach: { out: 0.5, up: -0.6 } });
  for (const id of ['reach_up', 'reach_side']) {
    it(`${id}: цель выше зоны покоя, дотянуться и вернуться = 1 повтор`, () => {
      const s = createExerciseSession(id, weak, ASPECT);
      const t = s.targetEvent();
      // Переводим цель обратно в «ширины плеч от плеча» и ставим туда запястье.
      const out = (t.x * ASPECT - weak.sh.x) / weak.S;
      const up = (weak.sh.y - t.y) / weak.S;
      expect(up).toBeGreaterThan(-0.4); // выше порога «рука опущена»
      const ev = run(s, [[makePose(), 300], [makePose({ wrist: { out, up } }), 900], [makePose(), 400]]);
      expect(ofType(ev, 'rep')).toHaveLength(1);
    });
  }
});

describe('БАГ 3: точка плеча «едет» за поднятой рукой → ложный «корпус заваливается вбок»', () => {
  // Регрессия того же рода, что 28.09 с наклоном вперёд: MediaPipe тянет точку плеча
  // рабочей стороны наружу вместе с рукой, центр плеч смещается, хотя корпус стоит.
  for (const side of ['right', 'left']) {
    it(`${side}: плечо рабочей стороны уехало на 0,4 ширины, голова на месте → нет TRUNK_LEAN_SIDE`, () => {
      const base = calibrate(side);
      const s = createExerciseSession('reach_side', base, ASPECT);
      const ev = run(s, [[makePose({ side }), 300], [makePose({ side, wrist: SIDE, slide: 0.4 }), 1200], [makePose({ side }), 400]], side);
      expect(codes(ev)).not.toContain('TRUNK_LEAN_SIDE');
    });
  }
  it('настоящий наклон вбок (весь корпус + голова) по-прежнему ловится', () => {
    const base = calibrate();
    const s = createExerciseSession('reach_side', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: SIDE, shift: 0.3 }), 1200], [makePose(), 400]]);
    expect(codes(ev)).toContain('TRUNK_LEAN_SIDE');
    expect(ofType(ev, 'mistake').find((e) => e.payload.code === 'TRUNK_LEAN_SIDE').payload.message).toMatch(/вправо/);
  });
});

describe('БАГ 4: Summary.accuracy по контракту = доля повторов БЕЗ ошибок', () => {
  it('3 чистых повтора + 1 с ошибкой → accuracy 0.75 (а было среднее quality)', () => {
    const results = [{ id: 'reach_up', reps: 4, quality: (1 + 1 + 1 + 0.5) / 4, cleanReps: 3, bestRomDeg: 150, mistakes: { SHOULDER_HIKE: 1 }, corrected: 1 }];
    const s = buildSummary(results, { side: 'right', durationSec: 60 });
    expect(s.accuracy).toBe(0.75);
    expect(s.totalReps).toBe(4);
    expect(s.mistakesCorrected).toBe(1);
  });
  it('сессия считает чистые повторы (quality ≥ 0.9, как «чистый» в игре)', () => {
    const base = calibrate();
    const s = createExerciseSession('reach_up', base, ASPECT);
    run(s, [
      [makePose(), 300], [makePose({ wrist: UP }), 900], [makePose(), 400],                                   // чистый
      [makePose(), 300], [makePose({ wrist: UP, hike: 0.45 }), 1200], [makePose({ wrist: UP }), 1200], [makePose(), 400], // с ошибкой
    ]);
    expect(s.result().reps).toBe(2);
    expect(s.result().cleanReps).toBe(1);
  });
  it('одно упражнение дважды сливается в одну строку, пустая сессия не делит на ноль', () => {
    const r = { id: 'reach_up', reps: 2, quality: 1, cleanReps: 2, bestRomDeg: 120, mistakes: { ELBOW_BENT: 1 }, corrected: 0 };
    const s = buildSummary([r, { ...r, bestRomDeg: 140 }], { side: 'left', durationSec: 5 });
    expect(s.exercises).toHaveLength(1);
    expect(s.exercises[0]).toMatchObject({ id: 'reach_up', reps: 4, bestRomDeg: 140, mistakes: { ELBOW_BENT: 2 } });
    expect(s.exercises[0].cleanReps).toBeUndefined(); // в Summary только поля контракта
    const empty = buildSummary([], { side: 'right', durationSec: 0 });
    expect(empty).toEqual({ side: 'right', durationSec: 0, exercises: [], totalReps: 0, accuracy: 0, mistakesCorrected: 0 });
  });
});

// ───────────────────────── Граничные случаи ─────────────────────────

describe('левая рука во всех реализованных упражнениях', () => {
  const base = calibrate('left');
  it('reach_up: цель над ЛЕВЫМ плечом (левая половина зеркального кадра)', () => {
    const t = createExerciseSession('reach_up', base, ASPECT).targetEvent();
    expect(t.x).toBeLessThan(0.5);
  });
  it('reach_side: цель слева от левого плеча', () => {
    const t = createExerciseSession('reach_side', base, ASPECT).targetEvent();
    expect(t.x * ASPECT).toBeLessThan(base.sh.x);
  });
  for (const [id, wrist] of [['reach_up', UP], ['reach_side', SIDE]]) {
    it(`${id}: чистый повтор левой = +1, без ошибок`, () => {
      const s = createExerciseSession(id, base, ASPECT, { targetReps: 1 });
      const ev = run(s, [[makePose({ side: 'left' }), 300], [makePose({ side: 'left', wrist }), 900], [makePose({ side: 'left' }), 400]], 'left');
      expect(ofType(ev, 'rep')).toHaveLength(1);
      expect(codes(ev)).toEqual([]);
      expect(ofType(ev, 'exercise-done')).toHaveLength(1);
    });
  }
  it('SHOULDER_HIKE левой: подсвечивает ЛЕВОЕ плечо (11) и ухо (7)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ side: 'left' }), 300], [makePose({ side: 'left', wrist: UP, hike: 0.45 }), 1000]], 'left');
    const m = ofType(ev, 'mistake').find((e) => e.payload.code === 'SHOULDER_HIKE');
    expect(m.payload.landmarks).toEqual([11, 7]);
  });
  it('ELBOW_BENT левой: подсвечивает левые плечо–локоть–запястье (11, 13, 15)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ side: 'left' }), 300], [makePose({ side: 'left', wrist: { out: 0.2, up: 1.3 }, elbowBend: 0.45 }), 1000]], 'left');
    expect(ofType(ev, 'mistake').find((e) => e.payload.code === 'ELBOW_BENT').payload.landmarks).toEqual([11, 13, 15]);
  });
  it('наклон влево при тренировке левой называется «влево»', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ side: 'left' }), 300], [makePose({ side: 'left', wrist: UP, shift: -0.3 }), 1000]], 'left');
    expect(ofType(ev, 'mistake').find((e) => e.payload.code === 'TRUNK_LEAN_SIDE').payload.message).toMatch(/влево/);
  });
  it('правая рука двигается, а тренируем левую — левая в покое, повторов нет', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose({ side: 'right', wrist: UP }), 1500]], 'left');
    expect(ofType(ev, 'rep')).toHaveLength(0);
  });
});

describe('человек пропал посреди повтора', () => {
  const base = calibrate();
  it('пропал во время удержания у звезды → повтор не засчитан, событий-мусора нет', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP }), 300], [null, 2000]]);
    expect(ev).toEqual([]);
  });
  it('вернулся и дотянул — ровно один повтор, без двойного счёта', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP }), 300], [null, 2000], [makePose({ wrist: UP }), 900], [makePose(), 400]]);
    expect(ofType(ev, 'rep')).toHaveLength(1);
  });
  it('detectMistakes без позы / без калибровки → пусто, не падает', () => {
    expect(detectMistakes(null, base, { exercise: 'reach_up', phase: 'HOLD' })).toEqual([]);
    expect(detectMistakes(measure(makePose(), 'right', ASPECT), null, { exercise: 'reach_up', phase: 'HOLD' })).toEqual([]);
  });
  it('measure без плеч в кадре → null (а не NaN дальше по цепочке)', () => {
    const p = makePose(); p[11].visibility = 0.1;
    expect(measure(p, 'right', ASPECT)).toBeNull();
    expect(measure(null, 'right', ASPECT)).toBeNull();
  });
});

describe('пауза посреди удержания', () => {
  const base = calibrate();
  it('долгая пауза (кадры не идут 10 с) не «доудерживает» звезду за человека', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = [];
    // 200 мс у цели → пауза 10 с (engine.pause() — step не вызывается) → 1 кадр → опустил руку.
    for (const [p, t] of frames([[makePose(), 300], [makePose({ wrist: UP }), 400]], 20000)) ev.push(...s.step(measure(p, 'right', ASPECT), t).events);
    ev.push(...s.step(measure(makePose({ wrist: UP }), 'right', ASPECT), 31000).events);
    ev.push(...run(s, [[makePose(), 400]], 'right', 31033));
    expect(ofType(ev, 'rep')).toHaveLength(0);
  });
  it('после паузы можно доудержать и получить повтор', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP }), 400]]);
    ev.push(...run(s, [[makePose({ wrist: UP }), 600], [makePose(), 400]], 'right', 31000));
    expect(ofType(ev, 'rep')).toHaveLength(1);
  });
  it('ошибка, начавшаяся до паузы, не «выстреливает» мгновенно после неё без подтверждения', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP }), 300], [makePose({ wrist: UP, hike: 0.45 }), 100]]);
    expect(codes(ev)).toEqual([]);
    // После паузы 10 с: один кадр с тем же нарушением — ещё не подсказка (нужно 300 мс подряд).
    const after = s.step(measure(makePose({ wrist: UP, hike: 0.45 }), 'right', ASPECT), 31000).events;
    expect(codes(after)).toEqual([]);
  });
});

describe('калибровка без видимой руки', () => {
  it('рука так и не появилась → калибровка ждёт, не завершается с мусорной нормой', () => {
    const c = createCalibration('right');
    let r;
    for (const [p, t] of frames([[makePose(), 6200], [makePose(), 20000]])) r = c.push(measure(p, 'right', ASPECT), t);
    expect(r.done).toBe(false);
    expect(r.phase).toBe('max_up');
    expect(r.message).toMatch(/руку не видно/);
  });
  it('человека нет совсем → отсчёт не идёт', () => {
    const c = createCalibration('right');
    let r;
    for (let t = 0; t < 10000; t += 33) r = c.push(null, t);
    expect(r).toMatchObject({ phase: 'neutral', progress: 0, done: false });
    expect(r.message).toMatch(/3…/);
  });
  it('рука мелькнула на 1 кадр — фаза не засчитана', () => {
    const c = createCalibration('right');
    let r;
    for (const [p, t] of frames([[makePose(), 6200], [makePose(), 3100], [makePose({ wrist: UP }), 33], [makePose(), 5000]])) r = c.push(measure(p, 'right', ASPECT), t);
    expect(r.phase).toBe('max_up');
    expect(r.progress).toBeLessThan(0.05);
  });
  it('без ушей и уголков глаз (волосы, очки): норма без headW/earSh, упражнение работает', () => {
    const noEars = (o) => { const p = makePose(o); for (const i of [3, 6, 7, 8]) p[i].visibility = 0.1; return p; };
    const c = createCalibration('right');
    let r;
    for (const [p, t] of frames([[noEars(), 6200], [noEars({ wrist: UP }), 6200], [noEars({ wrist: SIDE }), 6200]])) r = c.push(measure(p, 'right', ASPECT), t);
    expect(r.done).toBe(true);
    expect(r.baseline.headW).toBeNull();
    expect(r.baseline.earShRaw).toBeNull();
    const s = createExerciseSession('reach_up', r.baseline, ASPECT, { targetReps: 1 });
    const ev = [];
    for (const [p, t] of frames([[noEars(), 300], [noEars({ wrist: UP }), 900], [noEars(), 400]], 20000)) ev.push(...s.step(measure(p, 'right', ASPECT), t).events);
    expect(ofType(ev, 'rep')).toHaveLength(1);
    expect(codes(ev)).toEqual([]);
  });
});

describe('повторные события', () => {
  const base = calibrate();
  it('после exercise-done лишние повторы не шлют rep и второй exercise-done', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 1 });
    const one = [[makePose(), 300], [makePose({ wrist: UP }), 900], [makePose(), 400]];
    const ev = run(s, [...one, ...one, ...one]);
    expect(ofType(ev, 'rep')).toHaveLength(1);
    expect(ofType(ev, 'exercise-done')).toHaveLength(1);
  });
  it('одна длинная компенсация = одно событие mistake, а не на каждый кадр', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, hike: 0.45 }), 3000]]);
    expect(codes(ev)).toEqual(['SHOULDER_HIKE']);
  });
  it('незнакомое упражнение → понятная ошибка, а не падение внутри', () => {
    expect(() => createExerciseSession('jump', base, ASPECT)).toThrow(/не реализовано/);
  });
});
