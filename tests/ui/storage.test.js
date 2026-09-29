// История сессий [E]: картинки «до/после» и путь лучшего повтора не должны попадать в localStorage (CONTRACT.md).
import { describe, it, expect, beforeEach } from 'vitest';
import { saveSession, loadSessions } from '../../src/ui/storage.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

const IMG = `data:image/jpeg;base64,${'A'.repeat(40000)}`;
const session = (n) => ({
  date: `2026-09-${10 + n}T10:00:00.000Z`, day: `2026-09-${10 + n}`, totalReps: 3,
  exercises: [{ id: 'reach_up', reps: 3, bestRomDeg: 140 + n, mistakes: { SHOULDER_HIKE: 1 },
    bestRep: { ms: 2000, quality: 1, romDeg: 150, side: 'right', pts: [[0, 0, -1], [40, 0.1, -0.5]] },
    moments: { mistake: { code: 'SHOULDER_HIKE', message: 'Плечо к уху', image: IMG }, good: { image: IMG, romDeg: 150 } } }],
});

describe('storage: история без картинок', () => {
  beforeEach(() => { globalThis.localStorage = fakeStorage(); });

  it('saveSession не кладёт moments и bestRep, но оставляет угол и ошибки', () => {
    expect(saveSession(session(1))).toBe(true);
    const [s] = loadSessions();
    expect(s.exercises[0]).toEqual({ id: 'reach_up', reps: 3, bestRomDeg: 141, mistakes: { SHOULDER_HIKE: 1 } });
    expect(localStorage.getItem('qaita.sessions.v1').length).toBeLessThan(1000);
  });

  it('старые записи с картинками чистятся при следующем сохранении', () => {
    localStorage.setItem('qaita.sessions.v1', JSON.stringify([session(1)]));
    saveSession(session(2));
    const raw = localStorage.getItem('qaita.sessions.v1');
    expect(raw).not.toContain('data:image');
    expect(loadSessions()).toHaveLength(2);
  });

  it('localStorage недоступен — не падаем', () => {
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadSessions()).toEqual([]);
    expect(saveSession(session(1))).toBe(false);
  });
});
