// Калибровка «Твоя норма»: базовая поза + личная амплитуда. Таймер фазы идёт только когда человека видно.
import { median } from './geometry.js';

// prepMs — время прочитать инструкцию (отсчёт 3…2…1), данные в это время не собираем.
// needsWrist — таймер фазы идёт, только когда рабочую руку видно.
export const CALIBRATION_PHASES = [
  { id: 'neutral', prepMs: 3000, ms: 3000, needsWrist: false },
  { id: 'max_up', prepMs: 3000, ms: 3000, needsWrist: true },
  { id: 'max_side', prepMs: 3000, ms: 3000, needsWrist: true },
];

const HAND_NAME = { left: 'левую', right: 'правую' };

export function phaseMessage(phase, side) {
  switch (phase) {
    case 'neutral': return 'Сядьте ровно, спиной к спинке стула. Руки опустите и смотрите в камеру — 3 секунды';
    case 'max_up': return `Поднимите ${HAND_NAME[side]} руку вверх как можно выше — без боли`;
    case 'max_side': return `Теперь отведите ${HAND_NAME[side]} руку в сторону как можно дальше`;
    default: return 'Готово! Ваша норма сохранена';
  }
}

// Если руку в фазе так и не увидели — безопасные значения по умолчанию (в ширинах плеч).
const DEFAULT_MAX_UP = { out: 0.3, up: 1.6 };
const DEFAULT_MAX_SIDE = { out: 1.6, up: 0.2 };

export function createCalibration(side) {
  let phaseIndex = 0;
  let prep = 0;
  let elapsed = 0;
  let lastT = null;
  const neutral = { S: [], Sx: [], shMidX: [], shMidY: [], shX: [], shY: [], tilt: [], noseX: [], noseY: [], earSh: [] };
  let maxUp = null, maxSide = null, maxUpDeg = 0;

  function collect(phase, m) {
    if (phase === 'neutral') {
      neutral.S.push(m.S); neutral.Sx.push(m.Sx); neutral.shMidX.push(m.shMid.x); neutral.shMidY.push(m.shMid.y);
      neutral.shX.push(m.sh.x); neutral.shY.push(m.sh.y); neutral.tilt.push(m.tiltDeg);
      if (m.nose) { neutral.noseX.push(m.nose.x); neutral.noseY.push(m.nose.y); }
      if (m.earSh != null) neutral.earSh.push(m.earSh);
    } else if (phase === 'max_up' && m.wristRel) {
      if (!maxUp || m.wristRel.up > maxUp.up) maxUp = { ...m.wristRel };
      maxUpDeg = Math.max(maxUpDeg, m.elevationDeg ?? 0);
    } else if (phase === 'max_side' && m.wristRel) {
      if (!maxSide || m.wristRel.out > maxSide.out) maxSide = { ...m.wristRel };
    }
  }

  function baseline() {
    const noseX = median(neutral.noseX), noseY = median(neutral.noseY);
    return {
      side,
      S: median(neutral.S),
      Sx: median(neutral.Sx),
      shMid: { x: median(neutral.shMidX), y: median(neutral.shMidY) },
      sh: { x: median(neutral.shX), y: median(neutral.shY) },
      tiltDeg: median(neutral.tilt),
      nose: noseX == null ? null : { x: noseX, y: noseY },
      earSh: median(neutral.earSh),
      maxUp: maxUp ?? DEFAULT_MAX_UP,
      maxSide: maxSide ?? DEFAULT_MAX_SIDE,
      maxUpDeg: Math.round(maxUpDeg),
    };
  }

  return {
    /** @returns {{phase:string, progress:number, message:string, done:boolean, baseline?:object}} */
    /** framing — результат checkFraming: в первой фазе (сидим ровно) плохой кадр ставит калибровку на паузу. */
    push(m, t, framing = null) {
      if (phaseIndex >= CALIBRATION_PHASES.length) {
        return { phase: 'done', progress: 1, message: phaseMessage('done', side), done: true, baseline: baseline() };
      }
      const phase = CALIBRATION_PHASES[phaseIndex];
      const dt = lastT == null ? 0 : Math.min(t - lastT, 100); // не прыгаем после паузы
      lastT = t;
      if (phase.id === 'neutral' && framing && !framing.ok) {
        return { phase: phase.id, progress: 0, message: framing.message, done: false };
      }
      if (prep < phase.prepMs) {
        if (m) prep += dt;
        const left = Math.max(1, Math.ceil((phase.prepMs - prep) / 1000));
        return { phase: phase.id, progress: 0, message: `${phaseMessage(phase.id, side)}. Начинаем через ${left}…`, done: false };
      }
      const counts = m && (!phase.needsWrist || m.wristRel);
      if (counts) { elapsed += dt; collect(phase.id, m); }
      if (elapsed >= phase.ms) {
        phaseIndex += 1; elapsed = 0; prep = 0;
        if (phaseIndex >= CALIBRATION_PHASES.length) {
          return { phase: 'done', progress: 1, message: phaseMessage('done', side), done: true, baseline: baseline() };
        }
        const next = CALIBRATION_PHASES[phaseIndex];
        return { phase: next.id, progress: 0, message: `${phaseMessage(next.id, side)}. Начинаем через 3…`, done: false };
      }
      const hint = phase.needsWrist && m && !m.wristRel ? ' — руку не видно, отодвиньтесь от камеры' : '';
      return { phase: phase.id, progress: elapsed / phase.ms, message: `${phaseMessage(phase.id, side)}${hint}`, done: false };
    },
  };
}
