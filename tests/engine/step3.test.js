import { describe, it, expect } from 'vitest';
import { measure } from '../../src/engine/body.js';
import { checkFraming } from '../../src/engine/framing.js';
import { isOpenPalm, isThumbsUp, detectGesture, createGestureHold } from '../../src/engine/gestures.js';
import { createCalibration } from '../../src/engine/calibration.js';
import { createExerciseSession } from '../../src/engine/session.js';
import { makePose, frames, ASPECT } from './synth.js';

// Кисть: запястье внизу, пальцы вверх. open — все 4 пальца вытянуты; thumbUp — кулак с пальцем вверх.
function makeHand({ open = true, thumbUp = false, cx = 0.5, cy = 0.6 } = {}) {
  const h = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  h[0] = { x: cx, y: cy, z: 0 };
  const fx = [-0.03, -0.01, 0.01, 0.03];
  [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].forEach(([mcp, pip, dip, tip], i) => {
    h[mcp] = { x: cx + fx[i], y: cy - 0.06, z: 0 };
    h[pip] = { x: cx + fx[i], y: cy - 0.09, z: 0 };
    h[dip] = open ? { x: cx + fx[i], y: cy - 0.11, z: 0 } : { x: cx + fx[i], y: cy - 0.07, z: 0 };
    h[tip] = open ? { x: cx + fx[i], y: cy - 0.13, z: 0 } : { x: cx + fx[i], y: cy - 0.05, z: 0 };
  });
  if (thumbUp) { h[2] = { x: cx - 0.04, y: cy - 0.03, z: 0 }; h[3] = { x: cx - 0.04, y: cy - 0.07, z: 0 }; h[4] = { x: cx - 0.04, y: cy - 0.11, z: 0 }; }
  else { h[2] = { x: cx - 0.04, y: cy - 0.02, z: 0 }; h[3] = { x: cx - 0.06, y: cy - 0.03, z: 0 }; h[4] = { x: cx - 0.08, y: cy - 0.04, z: 0 }; }
  return h;
}

describe('framing check', () => {
  const m = (pose) => measure(pose, 'right', ASPECT);
  it('normal sitting pose is OK', () => {
    const p = makePose({ wrist: { out: 0.2, up: -0.8 } });
    p[13].visibility = 0.99; p[14].visibility = 0.99;
    expect(checkFraming(p, m(p), 120).code).toBe('OK');
  });
  it('dark room → LOW_LIGHT', () => expect(checkFraming(makePose(), m(makePose()), 20).code).toBe('LOW_LIGHT'));
  it('far away → TOO_FAR', () => { const p = makePose({ scale: 0.4 }); expect(checkFraming(p, m(p), 120).code).toBe('TOO_FAR'); });
  it('too close → TOO_CLOSE', () => { const p = makePose({ scale: 2.2 }); expect(checkFraming(p, m(p), 120).code).toBe('TOO_CLOSE'); });
  it('elbows hidden → LOW_VISIBILITY', () => { const p = makePose(); expect(checkFraming(p, m(p), 120).code).toBe('LOW_VISIBILITY'); });
  it('nobody → NO_PERSON', () => expect(checkFraming(null, null, 120).code).toBe('NO_PERSON'));
  it('calibration waits while the frame is bad', () => {
    const c = createCalibration('right');
    let r;
    for (let t = 0; t < 5000; t += 33) r = c.push(m(makePose()), t, { ok: false, message: 'Придвиньтесь ближе' });
    expect(r.phase).toBe('neutral');
    expect(r.message).toBe('Придвиньтесь ближе');
  });
});

describe('gestures', () => {
  it('recognizes open palm, fist and thumbs up', () => {
    expect(isOpenPalm(makeHand())).toBe(true);
    expect(isOpenPalm(makeHand({ open: false }))).toBe(false);
    expect(isThumbsUp(makeHand({ open: false, thumbUp: true }))).toBe(true);
    expect(isThumbsUp(makeHand())).toBe(false);
  });
  const ALL = new Set(['PALM_HOLD', 'THUMBS_UP', 'PAUSE', 'RAISE_LEFT', 'RAISE_RIGHT']);
  it('two palms = PAUSE, one = PALM_HOLD', () => {
    expect(detectGesture({ hands: [makeHand(), makeHand({ cx: 0.3 })], allow: ALL })).toBe('PAUSE');
    expect(detectGesture({ hands: [makeHand()], allow: ALL })).toBe('PALM_HOLD');
    expect(detectGesture({ hands: [makeHand()], allow: new Set(['PAUSE']) })).toBe(null);
  });
  it('raising the right arm = RAISE_RIGHT', () => {
    const mm = measure(makePose({ wrist: { out: 0.2, up: 1.2 } }), 'right', ASPECT);
    expect(detectGesture({ hands: [], m: mm, allow: ALL })).toBe('RAISE_RIGHT');
    const ml = measure(makePose({ side: 'left', wrist: { out: 0.2, up: 1.2 } }), 'right', ASPECT);
    expect(detectGesture({ hands: [], m: ml, allow: ALL })).toBe('RAISE_LEFT');
  });
  it('hold fires exactly once after 1 s and reports progress for the ring', () => {
    const g = createGestureHold();
    const ev = [];
    for (let t = 0; t <= 1500; t += 33) ev.push(...g.update('PALM_HOLD', t));
    expect(ev.filter((e) => e.fired)).toHaveLength(1);
    expect(ev.some((e) => e.progress > 0 && e.progress < 1)).toBe(true);
    expect(ev.at(-1)).toMatchObject({ type: 'PALM_HOLD', progress: 1, fired: true });
  });
  it('released early → progress resets to 0, no fire', () => {
    const g = createGestureHold();
    const ev = [];
    for (let t = 0; t <= 500; t += 33) ev.push(...g.update('PALM_HOLD', t));
    ev.push(...g.update(null, 533));
    expect(ev.some((e) => e.fired)).toBe(false);
    expect(ev.at(-1)).toMatchObject({ progress: 0, fired: false });
  });
});

describe('reach_side', () => {
  const calib = createCalibration('right');
  let r;
  for (const [pose, t] of frames([[makePose(), 6200], [makePose({ wrist: { out: 0.2, up: 1.6 } }), 6200], [makePose({ wrist: { out: 1.5, up: 0.1 } }), 6200]])) r = calib.push(measure(pose, 'right', ASPECT), t);
  const base = r.baseline;
  const run = (seq) => { const s = createExerciseSession('reach_side', base, ASPECT); const ev = []; for (const [p, t] of frames(seq, 20000)) ev.push(...s.step(measure(p, 'right', ASPECT), t).events); return ev; };

  it('target is to the side of the working shoulder', () => {
    const t = createExerciseSession('reach_side', base, ASPECT).targetEvent();
    expect(t.x).toBeGreaterThan(0.5 + 0.1); // правая рука → правая сторона зеркального кадра
  });
  it('clean side reach = 1 rep, no mistakes', () => {
    const ev = run([[makePose(), 300], [makePose({ wrist: { out: 1.5, up: 0.1 } }), 900], [makePose(), 400]]);
    expect(ev.filter((e) => e.type === 'rep')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'mistake')).toHaveLength(0);
  });
  it('bent elbow while reaching sideways is caught', () => {
    const ev = run([[makePose(), 300], [makePose({ wrist: { out: 1.3, up: 0.1 }, elbowDrop: 0.5 }), 900], [makePose(), 400]]);
    expect(ev.map((e) => e.payload?.code)).toContain('ELBOW_BENT');
  });
});
