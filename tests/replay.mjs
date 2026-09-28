// Прогон записанной сессии (?debug=1&auto=1&rec=1) через движок без камеры.
// node tests/replay.mjs qaita-rec-....json   → таймлайн событий и итог по каждому упражнению.
import { readFileSync } from 'node:fs';
import { measure } from '../src/engine/body.js';
import { createCalibration } from '../src/engine/calibration.js';
import { createExerciseSession } from '../src/engine/session.js';
import { checkFraming } from '../src/engine/framing.js';

const file = process.argv[2];
if (!file) { console.error('usage: node tests/replay.mjs <recording.json>'); process.exit(2); }
const rec = JSON.parse(readFileSync(file, 'utf8'));
const unpackPose = (p) => p && Array.from({ length: 33 }, (_, i) => (p[i] ? { x: p[i][0], y: p[i][1], z: 0, visibility: p[i][2] } : { x: 0, y: 0, z: 0, visibility: 0 }));
const unpackHands = (hs) => hs.map((h) => h.map(([x, y]) => ({ x, y, z: 0 })));

let side = 'right', calib = null, baseline = null, session = null, mi = 0;
const out = [], summary = [];
const t0 = rec.frames[0]?.[0] ?? 0;
const ts = (t) => `${((t - t0) / 1000).toFixed(1).padStart(6)}s`;

for (const [t, p, hs] of rec.frames) {
  while (mi < rec.marks.length && rec.marks[mi].t <= t) {
    const mk = rec.marks[mi++];
    if (mk.type === 'side') side = mk.side;
    if (mk.type === 'calibrate') calib = createCalibration(side);
    if (mk.type === 'exercise') {
      if (session) summary.push(session.result());
      session = createExerciseSession(mk.id, baseline, rec.aspect, { targetReps: mk.targetReps });
      out.push(`${ts(t)}  ▶ ${mk.id}  target=${JSON.stringify(session.targetEvent(), (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v))}`);
    }
  }
  const pose = unpackPose(p);
  const m = measure(pose, side, rec.aspect, unpackHands(hs));
  if (calib) {
    const r = calib.push(m, t, checkFraming(pose, m, null));
    if (r.done) { baseline = r.baseline; calib = null; out.push(`${ts(t)}  ✔ calibrated armLen=${baseline.armLen.toFixed(2)} maxUp=${JSON.stringify(baseline.maxUp)} maxSide=${JSON.stringify(baseline.maxSide)}`); }
  } else if (session && baseline) {
    for (const e of session.step(m, t).events) {
      const p2 = e.payload;
      if (e.type === 'mistake') out.push(`${ts(t)}    ✗ ${p2.code.padEnd(18)} ${p2.message}`);
      else if (e.type === 'mistake-cleared') out.push(`${ts(t)}    ✓ cleared ${p2.code}`);
      else if (e.type === 'rep') out.push(`${ts(t)}    ★ rep ${p2.count}/${p2.targetReps} quality=${p2.quality.toFixed(2)} rom=${p2.romDeg}°`);
      else if (e.type === 'target') out.push(`${ts(t)}    ↗ target moved`);
      else if (e.type === 'exercise-done') out.push(`${ts(t)}  ■ done`);
    }
  }
}
if (session) summary.push(session.result());
console.log(out.join('\n'));
console.log('\nИТОГ');
for (const r of summary) console.log(`  ${r.id.padEnd(14)} reps=${r.reps} quality=${r.quality.toFixed(2)} mistakes=${JSON.stringify(r.mistakes)}`);
console.log('REPLAY_OK');
