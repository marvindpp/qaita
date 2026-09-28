// Проверка кадра (правила подготовки, docs/PLAN.md §10): свет, расстояние, видно ли руки, есть ли место над головой.
import { LM, MIN_VISIBILITY } from './geometry.js';

export const FRAMING = {
  minBrightness: 55,        // средняя яркость кадра 0..255
  minShoulderFrac: 0.14,    // ширина плеч в долях ширины кадра: меньше — сидите далеко
  maxShoulderFrac: 0.42,    // больше — слишком близко
  minHeadroom: 1.2,         // над плечом должно помещаться ≥1,2 ширины плеч для поднятой руки
  minNoseY: 0.08,           // нос не у самого верхнего края
};

const OK = { ok: true, code: 'OK', message: 'Вас хорошо видно' };

/**
 * @param {Array|null} pose — зеркальные нормированные точки
 * @param {ReturnType<import('./body.js').measure>|null} m
 * @param {number|null} brightness — 0..255 или null, если ещё не мерили
 */
export function checkFraming(pose, m, brightness) {
  if (brightness != null && brightness < FRAMING.minBrightness) {
    return { ok: false, code: 'LOW_LIGHT', message: 'Темновато. Включите свет или сядьте лицом к окну' };
  }
  if (!pose || !m) {
    return { ok: false, code: 'NO_PERSON', message: 'Сядьте перед камерой так, чтобы были видны голова, плечи и руки' };
  }
  const shoulderFrac = m.Sx / m.aspect;
  if (shoulderFrac < FRAMING.minShoulderFrac) {
    return { ok: false, code: 'TOO_FAR', message: 'Вы далеко. Придвиньтесь к камере на полшага' };
  }
  const headroom = m.shMid.y / m.S; // сколько ширин плеч от верхнего края до плеч
  if (shoulderFrac > FRAMING.maxShoulderFrac || headroom < FRAMING.minHeadroom || (m.nose && m.nose.y < FRAMING.minNoseY)) {
    return { ok: false, code: 'TOO_CLOSE', message: 'Вы слишком близко: поднятая рука не поместится. Отодвиньтесь от камеры на полшага' };
  }
  const elbowsSeen = (pose[LM.L_EL]?.visibility ?? 0) >= MIN_VISIBILITY && (pose[LM.R_EL]?.visibility ?? 0) >= MIN_VISIBILITY;
  if (!elbowsSeen) {
    return { ok: false, code: 'LOW_VISIBILITY', message: 'Не видно локтей. Отодвиньтесь или опустите камеру, чтобы руки были в кадре' };
  }
  return OK;
}
