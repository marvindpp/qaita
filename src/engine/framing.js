// Проверка кадра (правила подготовки, docs/PLAN.md §10): свет, расстояние, видно ли руки, есть ли место над головой.
import { LM, MIN_VISIBILITY } from './geometry.js';

export const FRAMING = {
  minBrightness: 55,        // средняя яркость кадра 0..255
  minShoulderFrac: 0.14,    // ширина плеч в долях ширины кадра: меньше — сидите далеко
  maxShoulderFrac: 0.42,    // больше — слишком близко
  minHeadroom: 1.2,         // над плечом должно помещаться ≥1,2 ширины плеч для поднятой руки
  minNoseY: 0.08,           // нос не у самого верхнего края
};

const OK = { ok: true, code: 'OK', message: 'Вижу вас' };

/**
 * @param {Array|null} pose — зеркальные нормированные точки
 * @param {ReturnType<import('./body.js').measure>|null} m
 * @param {number|null} brightness — 0..255 или null, если ещё не мерили
 */
export function checkFraming(pose, m, brightness) {
  if (brightness != null && brightness < FRAMING.minBrightness) {
    return { ok: false, code: 'LOW_LIGHT', message: 'Темно. Включите свет' };
  }
  if (!pose || !m) {
    return { ok: false, code: 'NO_PERSON', message: 'Сядьте перед камерой' };
  }
  const shoulderFrac = m.Sx / m.aspect;
  if (shoulderFrac < FRAMING.minShoulderFrac) {
    return { ok: false, code: 'TOO_FAR', message: 'Придвиньтесь ближе' };
  }
  const headroom = m.shMid.y / m.S; // сколько ширин плеч от верхнего края до плеч
  if (shoulderFrac > FRAMING.maxShoulderFrac || headroom < FRAMING.minHeadroom || (m.nose && m.nose.y < FRAMING.minNoseY)) {
    return { ok: false, code: 'TOO_CLOSE', message: 'Отодвиньтесь назад' };
  }
  const elbowsSeen = (pose[LM.L_EL]?.visibility ?? 0) >= MIN_VISIBILITY && (pose[LM.R_EL]?.visibility ?? 0) >= MIN_VISIBILITY;
  if (!elbowsSeen) {
    return { ok: false, code: 'LOW_VISIBILITY', message: 'Не видно рук. Отодвиньтесь' };
  }
  return OK;
}
