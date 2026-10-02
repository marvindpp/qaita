import { describe, it, expect } from 'vitest';
import { encodeReport, decodeReport, packSessions } from '../../src/ui/report-link.js';

const sessions = Array.from({ length: 20 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
  day: `2026-10-${String(i + 1).padStart(2, '0')}`,
  side: i % 2 ? 'left' : 'right',
  durationSec: 300 + i,
  accuracy: 0.8,
  mistakesCorrected: 2,
  totalReps: 9,
  exercises: [
    { id: 'reach_up', reps: 3, bestRomDeg: 90 + i, mistakes: { TRUNK_LEAN_FORWARD: 2 } },
    { id: 'open_hand', reps: 6, bestRomDeg: 0, mistakes: {} },
  ],
}));

describe('ссылка для врача', () => {
  it('туда и обратно — те же цифры, только последние 14 тренировок', async () => {
    const payload = await encodeReport({ sessions, name: 'Айгуль', goal: 'cup' });
    const r = await decodeReport(payload);
    expect(r.name).toBe('Айгуль');
    expect(r.goal).toBe('cup');
    expect(r.sessions).toHaveLength(14);
    const last = r.sessions.at(-1);
    expect(last.day).toBe('2026-10-20');
    expect(last.side).toBe('left');
    expect(last.accuracy).toBe(0.8);
    expect(last.exercises[0]).toEqual({ id: 'reach_up', reps: 3, bestRomDeg: 109, mistakes: { TRUNK_LEAN_FORWARD: 2 } });
    expect(last.totalReps).toBe(9);
  });

  it('ссылка короткая — влезает в QR', async () => {
    const payload = await encodeReport({ sessions });
    expect(payload.length).toBeLessThan(1200);
  });

  it('битая ссылка — null, а не падение', async () => {
    expect(await decodeReport('zzzz')).toBeNull();
    expect(await decodeReport('xabc')).toBeNull();
  });

  it('пустая история', () => {
    expect(packSessions([])).toEqual([]);
  });
});
