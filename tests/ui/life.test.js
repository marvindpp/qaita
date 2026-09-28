// «Из тренажёра — в жизнь» [E]: день задания и дозы — по местному времени, как сад (storage.dayKey).
import { describe, it, expect, beforeEach } from 'vitest';
import { giveTask, pendingTask, addDose, doseToday, GOALS } from '../../src/ui/life.js';
import { dayKey } from '../../src/ui/storage.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

describe('life: местный день', () => {
  beforeEach(() => { globalThis.localStorage = fakeStorage(); });

  it('задание дня хранится с местной датой и не спрашивается в тот же день', () => {
    const t = giveTask(GOALS[0]);
    expect(t.day).toBe(dayKey());
    expect(pendingTask()).toBeNull();
  });

  it('вчерашнее задание — спрашиваем', () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    localStorage.setItem('qaita.task.v1', JSON.stringify({ goal: 'cup', text: 'x', day: dayKey(y), answered: null }));
    expect(pendingTask()?.goal).toBe('cup');
  });

  it('доза дня копится под местной датой', () => {
    addDose(3);
    addDose(4);
    expect(doseToday()).toBe(7);
    expect(Object.keys(JSON.parse(localStorage.getItem('qaita.dose.v1')))).toEqual([dayKey()]);
  });
});
