import { describe, it, expect } from 'vitest';
import { measure } from '../../src/engine/body.js';
import { createCalibration } from '../../src/engine/calibration.js';
import { createExerciseSession } from '../../src/engine/session.js';
import { makePose, frames, ASPECT } from './synth.js';

const base = (() => {
  const c = createCalibration('right'); let r;
  for (const [p, t] of frames([[makePose(), 6200], [makePose({ wrist: { out: 0.2, up: 1.6 } }), 6200], [makePose({ wrist: { out: 1.5, up: 0.1 } }), 6200]])) r = c.push(measure(p, 'right', ASPECT), t);
  return r.baseline;
})();

// Плавное движение руки от a к b за ms (без телепортов — реальные люди так не двигаются).
function ramp(a, b, ms, extra = {}) {
  const n = Math.max(1, Math.round(ms / 33));
  return Array.from({ length: n }, (_, i) => {
    const k = (i + 1) / n;
    return [makePose({ wrist: { out: a.out + (b.out - a.out) * k, up: a.up + (b.up - a.up) * k }, ...extra }), 33];
  });
}
function run(id, seq, hands = () => []) {
  const s = createExerciseSession(id, base, ASPECT, { targetReps: 5 });
  const ev = [];
  for (const [p, t] of frames(seq, 30000)) ev.push(...s.step(measure(p, 'right', ASPECT, hands(t)), t).events);
  return { s, ev, codes: ev.filter((e) => e.type === 'mistake').map((e) => e.payload.code), reps: ev.filter((e) => e.type === 'rep').length };
}
const REST = { out: 0.2, up: -0.6 };

describe('hand_to_mouth', () => {
  const mouth = { out: -0.5, up: 0.82 }; // к лицу: внутрь и вверх
  it('slow cup-to-mouth = 1 clean rep', () => {
    const r = run('hand_to_mouth', [[makePose(), 300], ...ramp(REST, mouth, 1200), [makePose({ wrist: mouth }), 900], ...ramp(mouth, REST, 1000), [makePose(), 400]]);
    expect(r.reps).toBe(1);
    expect(r.codes).toEqual([]);
  });
  it('bringing the head down to the hand = TRUNK_LEAN_FORWARD', () => {
    const r = run('hand_to_mouth', [[makePose(), 300], ...ramp(REST, mouth, 1200), [makePose({ wrist: mouth, noseDrop: 0.3 }), 1200], [makePose(), 400]]);
    expect(r.codes).toContain('TRUNK_LEAN_FORWARD');
  });
  it('the target does not move (mouth is where it is)', () => {
    const r = run('hand_to_mouth', [[makePose(), 300], ...ramp(REST, mouth, 1200), [makePose({ wrist: mouth }), 900], ...ramp(mouth, REST, 1000), [makePose(), 400]]);
    expect(r.ev.filter((e) => e.type === 'target')).toHaveLength(0);
  });
});

describe('reach_across', () => {
  const across = { out: -1.2, up: 0.26 };
  it('slow reach to the other shoulder = 1 rep, elbow not judged (depth movement)', () => {
    const r = run('reach_across', [[makePose(), 300], ...ramp(REST, across, 1500), [makePose({ wrist: across, elbowDrop: 0.4 }), 900], ...ramp(across, REST, 1000), [makePose(), 400]]);
    expect(r.reps).toBe(1);
    expect(r.codes).not.toContain('ELBOW_BENT');
  });
});

describe('TOO_FAST', () => {
  it('a real jerk (fast over many frames) is caught', () => {
    const r = run('reach_up', [[makePose(), 300], ...ramp(REST, { out: 0.2, up: 1.6 }, 230), [makePose({ wrist: { out: 0.2, up: 1.6 } }), 600], [makePose(), 400]]);
    expect(r.codes).toContain('TOO_FAST');
  });
  it('slow movement is fine', () => {
    const r = run('reach_up', [[makePose(), 300], ...ramp(REST, { out: 0.2, up: 1.6 }, 1500), [makePose({ wrist: { out: 0.2, up: 1.6 } }), 900], ...ramp({ out: 0.2, up: 1.6 }, REST, 1200), [makePose(), 400]]);
    expect(r.codes).toEqual([]);
    expect(r.reps).toBe(1);
  });
});

describe('INCOMPLETE_ROM', () => {
  it('went half way and came back → «не хватило N см», and it does not block the next rep', () => {
    const half = { out: 0.2, up: 0.6 };
    const up = { out: 0.2, up: 1.6 };
    const r = run('reach_up', [
      [makePose(), 300], ...ramp(REST, half, 1000), ...ramp(half, REST, 800), [makePose(), 200],
      ...ramp(REST, up, 1400), [makePose({ wrist: up }), 900], ...ramp(up, REST, 1200), [makePose(), 400],
    ]);
    const m = r.ev.find((e) => e.payload?.code === 'INCOMPLETE_ROM');
    expect(m).toBeTruthy();
    expect(m.payload.message).toMatch(/Не хватило \d+ см|Почти/);
    expect(r.reps).toBe(1);
  });
});

describe('WRONG_HAND', () => {
  it('raising the other arm while the working one rests is caught with the arm named', () => {
    const r = run('reach_up', [[makePose(), 300], [makePose({ side: 'left', wrist: { out: 0.2, up: 1.4 } }), 1200], [makePose(), 600]]);
    const m = r.ev.find((e) => e.payload?.code === 'WRONG_HAND');
    expect(m).toBeTruthy();
    expect(m.payload.message).toMatch(/правую/);
    expect(r.reps).toBe(0);
  });
});

describe('open_hand + FINGERS_NOT_OPEN', () => {
  // Кисть у рабочего (правого) запястья: зеркальные координаты, как у движка.
  const wr = () => { const p = makePose({ wrist: { out: 0.1, up: -0.5 } }); return p[16]; };
  const hand = (ext) => {
    const w = wr();
    const h = Array.from({ length: 21 }, () => ({ x: w.x, y: w.y, z: 0 }));
    [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].forEach(([mcp, pip, dip, tip], i) => {
      const x = w.x - 0.03 + i * 0.02;
      h[mcp] = { x, y: w.y - 0.05, z: 0 }; h[pip] = { x, y: w.y - 0.08, z: 0 };
      h[dip] = { x, y: w.y - (ext[i] ? 0.1 : 0.065), z: 0 }; h[tip] = { x, y: w.y - (ext[i] ? 0.12 : 0.05), z: 0 };
    });
    return h;
  };
  const pose = makePose({ wrist: { out: 0.1, up: -0.5 } });
  const FIST = [false, false, false, false], OPEN = [true, true, true, true], HALF = [true, true, false, false];

  it('fist → open palm (hold) → fist = 1 rep', () => {
    const seq = [[pose, 600], [pose, 900], [pose, 600]];
    const r = run('open_hand', seq, (t) => [hand(t - 30000 < 600 ? FIST : t - 30000 < 1500 ? OPEN : FIST)]);
    expect(r.reps).toBe(1);
    expect(r.codes).toEqual([]);
  });
  it('ring and little finger stay bent → names them', () => {
    const r = run('open_hand', [[pose, 600], [pose, 2200], [pose, 400]], (t) => [hand(t - 30000 < 600 ? FIST : t - 30000 < 2800 ? HALF : FIST)]);
    const m = r.ev.find((e) => e.payload?.code === 'FINGERS_NOT_OPEN');
    expect(m).toBeTruthy();
    expect(m.payload.message).toBe('Безымянный и мизинец согнуты. Раскройте ладонь!');
    expect(r.reps).toBe(0);
  });
});
