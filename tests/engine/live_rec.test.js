// Регрессия на ЖИВОЙ записи Даулета 28.09 (tests/fixtures/rec-2026-09-28-daulet.json, ?rec=1).
// Движения нормальные, ошибки в 1–2 повторах — нарочно.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { replay } from '../replay.mjs';

const rec = JSON.parse(readFileSync(new URL('../fixtures/rec-2026-09-28-daulet.json', import.meta.url), 'utf8'));
const { summary, events } = replay(rec);

describe('live recording 28.09', () => {
  it('all 5 exercises get their 3 reps', () => {
    expect(summary.map((r) => r.id)).toEqual(['reach_up', 'reach_side', 'hand_to_mouth', 'reach_across', 'open_hand']);
    for (const r of summary) expect(r.reps, r.id).toBe(3);
  });
  it('normal-speed movement is not "too fast" (was 12 times, lowering the arm counted too)', () => {
    const n = events.filter((e) => e.type === 'mistake' && e.payload.code === 'TOO_FAST').length;
    expect(n).toBeLessThanOrEqual(1);
  });
  it('engine is silent after exercise-done (no hints while the next one is being picked)', () => {
    const doneAt = new Map();
    for (const e of events) {
      if (e.type === 'exercise-done') doneAt.set(e.ex, e.t);
      else expect(doneAt.has(e.ex), `${e.type} ${e.payload.code ?? ''} after done in ${e.ex}`).toBe(false);
    }
  });
  it('the reach_up star is up at the top edge, not at 2/3 of the arm (was y=0.227)', () => {
    const start = events.find((e) => e.type === 'start' && e.ex === 'reach_up');
    expect(start.payload.y).toBeLessThan(0.17);
  });
});
