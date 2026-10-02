import { describe, it, expect } from 'vitest';
import { normalizeRx, encodeRx, decodeRx, rxAdherence } from '../../src/ui/rx.js';

describe('назначение врача', () => {
  it('туда и обратно через ссылку', async () => {
    const rx = { ex: ['reach_up', 'open_hand'], reps: 8, perDay: 2, note: 'медленно', doctor: 'д-р А.', at: '2026-10-01' };
    expect(await decodeRx(await encodeRx(rx))).toEqual(rx);
  });
  it('мусор из ссылки отбрасываем', () => {
    expect(normalizeRx({ ex: ['hack'] })).toBeNull();
    const n = normalizeRx({ ex: ['reach_up', 'reach_up', 'x'], reps: 999, perDay: 7 });
    expect(n.ex).toEqual(['reach_up']);
    expect(n.reps).toBe(5);
    expect(n.perDay).toBe(1);
  });
  it('выполнение: не больше назначенного в день', () => {
    const rx = normalizeRx({ ex: ['reach_up'], reps: 5, perDay: 2, at: '2026-10-01' });
    const s = [{ day: '2026-10-01' }, { day: '2026-10-01' }, { day: '2026-10-01' }, { day: '2026-10-02' }];
    expect(rxAdherence(rx, s, '2026-10-02')).toEqual({ done: 3, need: 4, days: 2, share: 0.75 });
  });
});
