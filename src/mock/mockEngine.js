// Mock-движок [E] — Шаг 1 в docs/BRIEF_ERSULTAN.md. Пока заглушка с тем же API.
import { createEmitter } from '../engine/emitter.js';

export async function createEngine() {
  const bus = createEmitter();
  return {
    on: bus.on,
    async start() { bus.emit('status', { code: 'OK', message: 'Mock-движок: камера не нужна' }); },
    stop() {}, setSide() {}, async calibrate() { return {}; }, setExercise() {}, pause() {}, resume() {},
    getSummary() { return { side: 'right', durationSec: 0, exercises: [], totalReps: 0, accuracy: 0, mistakesCorrected: 0 }; },
  };
}
