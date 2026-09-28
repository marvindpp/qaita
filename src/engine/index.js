// Движок Qaita [D]. Шаг 0: камера + события. Модели, калибровка, упражнения и ошибки — Шаги 1–3 (docs/BRIEF_DAULET.md).
import { createEmitter } from './emitter.js';
import { openCamera } from './camera.js';

/** @param {{ video: HTMLVideoElement }} opts */
export async function createEngine({ video }) {
  const bus = createEmitter();
  let stream = null;
  let side = 'right';

  return {
    on: bus.on,
    async start() {
      try {
        stream = await openCamera(video);
        bus.emit('status', { code: 'OK', message: 'Камера работает' });
      } catch {
        bus.emit('status', { code: 'NO_CAMERA', message: 'Нет доступа к камере. Разрешите камеру в адресной строке браузера и обновите страницу' });
      }
    },
    stop() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    },
    setSide(s) { side = s; },
    async calibrate() { return { side }; },
    setExercise() {},
    pause() {},
    resume() {},
    getSummary() {
      return { side, durationSec: 0, exercises: [], totalReps: 0, accuracy: 0, mistakesCorrected: 0 };
    },
  };
}
