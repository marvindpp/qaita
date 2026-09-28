import { describe, it, expect } from 'vitest';
import { measure } from '../../src/engine/body.js';
import { createCalibration } from '../../src/engine/calibration.js';
import { createExerciseSession } from '../../src/engine/session.js';
import { angleDeg, elevationDeg } from '../../src/engine/geometry.js';
import { makePose, frames, ASPECT } from './synth.js';
import { createMistakeTracker } from '../../src/engine/tracker.js';

const REST = null;              // рука опущена (запястья нет в кадре)
const UP = { out: 0.2, up: 1.6 }; // личный максимум вверх

function calibrate(side = 'right') {
  const calib = createCalibration(side);
  let r;
  for (const [pose, t] of frames([
    [makePose({ side }), 6200],
    [makePose({ side, wrist: UP }), 6200],
    [makePose({ side, wrist: { out: 1.5, up: 0.1 } }), 6200],
  ])) r = calib.push(measure(pose, side, ASPECT), t);
  return r;
}

function run(session, seq, side = 'right') {
  const events = [];
  for (const [pose, t] of frames(seq, 20000)) events.push(...session.step(measure(pose, side, ASPECT), t).events);
  return events;
}
const codes = (events, type = 'mistake') => events.filter((e) => e.type === type).map((e) => e.payload.code);

describe('geometry', () => {
  it('angles', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180);
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(90);
    expect(elevationDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(0);   // вниз
    expect(elevationDeg({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(180); // вверх
  });
});

describe('calibration', () => {
  it('builds a personal baseline with max reach', () => {
    const r = calibrate();
    expect(r.done).toBe(true);
    expect(r.baseline.S).toBeCloseTo(0.3, 2);
    expect(r.baseline.maxUp.up).toBeCloseTo(1.6, 1);
    expect(r.baseline.maxSide.out).toBeCloseTo(1.5, 1);
    expect(r.baseline.earSh).toBeGreaterThan(0.5);
  });
  it('arm-raise phase waits while the wrist is not visible', () => {
    const calib = createCalibration('right');
    let r;
    for (const [pose, t] of frames([[makePose(), 6200], [makePose(), 8000]])) r = calib.push(measure(pose, 'right', ASPECT), t);
    expect(r.phase).toBe('max_up');
    expect(r.progress).toBe(0);
    expect(r.message).toMatch(/руку не видно/);
  });
  it('gives a 3-2-1 countdown before each phase', () => {
    const calib = createCalibration('right');
    const r = calib.push(measure(makePose(), 'right', ASPECT), 0);
    expect(r.message).toMatch(/· 3…/);
  });
  it('left arm calibrates too', () => {
    expect(calibrate('left').baseline.maxUp.up).toBeCloseTo(1.6, 1);
  });
});

describe('reach_up session', () => {
  const base = calibrate().baseline;
  const good = [[makePose(), 400], [makePose({ wrist: { out: 0.2, up: 0.8 } }), 300], [makePose({ wrist: UP }), 900], [makePose({ wrist: { out: 0.2, up: 0.5 } }), 200], [makePose(), 400]];

  it('target event is inside the frame, above the shoulder', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const t = s.targetEvent();
    expect(t.x).toBeGreaterThan(0.06); expect(t.x).toBeLessThan(0.94);
    expect(t.y).toBeGreaterThanOrEqual(0.06); expect(t.y).toBeLessThan(0.62);
    expect(t.radius).toBeGreaterThan(0);
  });

  it('correct movement: +1 rep and ZERO mistakes (negative control)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 1 });
    const ev = run(s, good);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(1);
    expect(codes(ev)).toEqual([]);
    expect(ev.find((e) => e.type === 'exercise-done')).toBeTruthy();
    expect(ev.find((e) => e.type === 'rep').payload.quality).toBe(1);
  });

  it('SHOULDER_HIKE blocks the star; fixing it clears and the rep counts', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [
      [makePose(), 300],
      [makePose({ wrist: UP, hike: 0.45 }), 1500],   // тянется плечом
      [makePose({ wrist: UP }), 1200],               // опустил плечо
      [makePose(), 400],
    ]);
    expect(codes(ev)).toContain('SHOULDER_HIKE');
    const m = ev.find((e) => e.payload.code === 'SHOULDER_HIKE').payload;
    expect(m.message).toMatch(/Плечо к уху/);
    expect(m.valueCm).toBeGreaterThan(0);
    expect(codes(ev, 'mistake-cleared')).toContain('SHOULDER_HIKE');
    const rep = ev.find((e) => e.type === 'rep');
    expect(rep).toBeTruthy();
    expect(rep.payload.quality).toBeLessThan(1);
    // Повтор засчитан только ПОСЛЕ исправления.
    expect(ev.indexOf(rep)).toBeGreaterThan(ev.findIndex((e) => e.type === 'mistake-cleared'));
  });

  it('hike alone never produces a rep', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, hike: 0.45 }), 2000], [makePose(), 400]]);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(0);
  });

  it('TRUNK_LEAN_FORWARD with a cm estimate', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, scale: 1.18, noseDrop: 0.25 }), 1200], [makePose(), 400]]);
    const m = ev.find((e) => e.payload.code === 'TRUNK_LEAN_FORWARD');
    expect(m).toBeTruthy();
    expect(m.payload.message).toMatch(/Наклон вперёд на \d+ см/);
  });

  it('regression 28.09: raised arm «spreads» shoulder points but head is the same → NO forward-lean false alarm', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, spread: 1.34 }), 1200], [makePose(), 400]]);
    expect(codes(ev)).not.toContain('TRUNK_LEAN_FORWARD');
  });

  it('never shows absurd distances (capped at 30 cm)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, scale: 1.8 }), 1200], [makePose(), 400]]);
    expect(ev.find((e) => e.payload?.code === 'TRUNK_LEAN_FORWARD').payload.valueCm).toBeLessThanOrEqual(30);
  });

  it('TRUNK_LEAN_SIDE names the direction', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, shift: -0.3 }), 1200], [makePose(), 400]]);
    const m = ev.find((e) => e.payload.code === 'TRUNK_LEAN_SIDE');
    expect(m).toBeTruthy();
    expect(m.payload.message).toMatch(/Корпус влево/);
  });

  it('ELBOW_BENT reports the angle', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: { out: 0.2, up: 1.3 }, elbowBend: 0.45 }), 1200], [makePose(), 400]]);
    const m = ev.find((e) => e.payload.code === 'ELBOW_BENT');
    expect(m).toBeTruthy();
    expect(m.payload.valueDeg).toBeLessThan(150);
    expect(m.payload.message).toMatch(/Локоть согнут/);
  });

  it('a compensated quick reach never counts (hold is blocked from the first frame)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP, shift: -0.3 }), 700], [makePose(), 400]]);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(0);
  });

  it('target circle stays small and fully inside the frame', () => {
    const t = createExerciseSession('reach_up', base, ASPECT).targetEvent();
    expect(t.radius).toBeLessThanOrEqual(0.11 + 1e-9);
    expect(t.x - t.radius).toBeGreaterThanOrEqual(0);
    expect(t.x + t.radius).toBeLessThanOrEqual(1);
    expect(t.y - t.radius * ASPECT).toBeGreaterThanOrEqual(0);
  });

  it('a one-frame glitch does not fire a mistake (debounce)', () => {
    const s = createExerciseSession('reach_up', base, ASPECT);
    const ev = run(s, [[makePose(), 300], [makePose({ wrist: UP }), 300], [makePose({ wrist: UP, hike: 0.45 }), 66], [makePose({ wrist: UP }), 600], [makePose(), 400]]);
    expect(codes(ev)).toEqual([]);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(1);
  });

  it('five good reps finish the exercise exactly once', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 5 });
    const ev = run(s, [...good, ...good, ...good, ...good, ...good, ...good]);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(5);
    expect(ev.filter((e) => e.type === 'exercise-done')).toHaveLength(1);
  });
});

describe('mistake tracker', () => {
  const lean = { code: 'TRUNK_LEAN_SIDE', message: 'x', severity: 3, landmarks: [] };
  const feed = (tr, seq) => {
    const ev = []; let t = 0;
    for (const [on, ms] of seq) for (let e = 0; e < ms; e += 33) { ev.push(...tr.update(on ? [lean] : [], t)); t += 33; }
    return ev;
  };
  it('re-shows a mistake that comes back after being fixed (no hidden hints)', () => {
    const ev = feed(createMistakeTracker(), [[1, 400], [0, 600], [1, 400], [0, 600]]);
    expect(ev.map((e) => e.type)).toEqual(['mistake', 'mistake-cleared', 'mistake', 'mistake-cleared']);
  });
  it('shows the highest-priority mistake first', () => {
    const tr = createMistakeTracker();
    let ev = [];
    for (let t = 0; t < 400; t += 33) ev.push(...tr.update([{ ...lean, code: 'ELBOW_BENT' }, lean], t));
    expect(ev.find((e) => e.type === 'mistake').payload.code).toBe('TRUNK_LEAN_SIDE');
  });
});

describe('adaptive target', () => {
  const base = (() => {
    const calib = createCalibration('right'); let r;
    // Калибровка «ленивая»: рука поднята только до 1.0 — звезда получится низкой.
    for (const [pose, t] of frames([[makePose(), 6200], [makePose({ wrist: { out: 0.2, up: 1.0 } }), 6200], [makePose({ wrist: { out: 1.5, up: 0.1 } }), 6200]])) r = calib.push(measure(pose, 'right', ASPECT), t);
    return r.baseline;
  })();
  const up = (u, extra = {}) => makePose({ wrist: { out: 0.2, up: u }, ...extra });

  it('star moves up to where the hand really reached', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 5 });
    const y0 = s.targetEvent().y;
    const ev = run(s, [[makePose(), 300], [up(1.6), 900], [makePose(), 400]]);
    const moved = ev.filter((e) => e.type === 'target');
    expect(moved).toHaveLength(1);
    expect(moved[0].payload.y).toBeLessThan(y0); // выше на экране
  });
  it('reach gained by compensation does NOT raise the star', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 5 });
    const ev = run(s, [[makePose(), 300], [up(1.6, { hike: 0.45 }), 900], [up(1.05), 1300], [makePose(), 400]]);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'target')).toHaveLength(0);
  });
  it('growth is capped at +40% of the calibrated reach', () => {
    const s = createExerciseSession('reach_up', base, ASPECT, { targetReps: 10 });
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push([makePose(), 300], [up(3), 900], [makePose(), 400]);
    run(s, seq);
    const t = s.targetEvent();
    const shY = 0.62; // плечо в synth
    expect((shY - t.y) / 0.3).toBeLessThanOrEqual(1.0 * 1.05 * 1.4 + 0.05);
  });
});
