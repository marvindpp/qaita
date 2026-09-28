// Режим «ошибка»: детекторы компенсаций относительно ЛИЧНОЙ нормы (калибровки).
// Каждый детектор возвращает конкретную подсказку: что не так + что сделать + цифра, если её можно посчитать.
import { LM, clamp, sideIndex } from './geometry.js';

// Средняя ширина плеч взрослого ≈ 37 см — переводим «ширины плеч» в сантиметры (поэтому «~»).
export const SHOULDER_CM = 37;
// Типичное расстояние до ноутбучной камеры ≈ 60 см: наклон к камере на N см растит ширину плеч ~ в (1 + N/60) раз.
const CAMERA_CM = 60;

export const THRESHOLDS = {
  leanForwardHeadRatio: 1.12,    // лицо (уголки глаз) в кадре больше нормы на 12%+ → корпус пошёл к камере
  leanForwardWidthRatio: 1.15,   // запасной признак, если ушей не видно: плечи шире нормы на 15%+
  leanForwardNoseDrop: 0.15,     // нос ниже нормы на 0,15 ширины плеч
  maxShownCm: 30,                // больше 30 см на экран не пишем — это уже «вы пересели», а не наклон
  leanSideShift: 0.12,           // центр плеч сместился вбок на 0,12 ширины плеч
  leanSideNoseShift: 0.18,       // голова сместилась вбок на 0,18 ширины плеч
  shoulderHikeDrop: 0.20,        // ухо–плечо короче нормы на 20%+ ...
  shoulderHikeExtraAtTop: 0.15,  // ... плюс до 15% допуска, когда рука выше 90° (плечо естественно чуть поднимается)
  elbowBentDeg: 150,             // локоть согнут сильнее, чем на 150°
  elbowCheckReach: 1.0,          // локоть проверяем, когда запястье дальше 1 ширины плеч от плеча (рука вытянута)
};

// Порядок = приоритет показа (одна подсказка за раз).
export const PRIORITY = ['WRONG_HAND', 'TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE', 'SHOULDER_HIKE', 'ELBOW_BENT', 'TOO_FAST', 'INCOMPLETE_ROM', 'FINGERS_NOT_OPEN'];

const cmText = (cm) => (cm >= 3 ? ` на ${Math.round(cm)} см` : '');

/**
 * @param {ReturnType<import('./body.js').measure>} m
 * @param {object} base — baseline из калибровки
 * @param {{exercise:string, phase:string}} ctx — phase из счётчика повторов
 */
export function detectMistakes(m, base, ctx) {
  if (!m || !base) return [];
  const out = [];
  const moving = ctx.phase === 'REACHING' || ctx.phase === 'HOLD';
  if (!moving) return out;
  const idx = sideIndex(base.side);
  const T = THRESHOLDS;

  // Масштаб: насколько человек сейчас ближе/дальше к камере, чем при калибровке (по ширине головы).
  const scale = m.headW && base.headW ? m.headW / base.headW : 1;
  const unit = base.S * scale; // ширина плеч «в текущем масштабе» — делим на неё все смещения

  // Корпус вперёд: голова «растёт» в кадре или опускается к руке.
  const noseDrop = m.nose && base.nose ? (m.nose.y - base.nose.y) / unit : 0;
  const closer = m.headW && base.headW ? scale > T.leanForwardHeadRatio : m.Sx / base.Sx > T.leanForwardWidthRatio;
  if (closer || noseDrop > T.leanForwardNoseDrop) {
    const ratio = m.headW && base.headW ? scale : m.Sx / base.Sx;
    const cm = Math.min(T.maxShownCm, Math.max(noseDrop * SHOULDER_CM, (ratio - 1) * CAMERA_CM));
    out.push({
      code: 'TRUNK_LEAN_FORWARD', severity: 3, landmarks: [LM.L_SH, LM.R_SH, LM.NOSE], valueCm: Math.round(cm),
      message: `Наклон вперёд${cmText(cm)}. Спину ровно!`,
    });
  }

  // Корпус вбок: смещаются центр плеч и голова.
  const shift = (m.shMid.x - base.shMid.x) / unit;
  const noseShift = m.nose && base.nose ? (m.nose.x - base.nose.x) / unit : 0;
  if (Math.abs(shift) > T.leanSideShift || Math.abs(noseShift) > T.leanSideNoseShift) {
    const main = Math.abs(noseShift) > Math.abs(shift) ? noseShift : shift;
    const dir = main > 0 ? 'вправо' : 'влево'; // зеркальный кадр: +x = правая сторона человека
    const cm = Math.min(T.maxShownCm, Math.abs(main) * SHOULDER_CM);
    out.push({
      code: 'TRUNK_LEAN_SIDE', severity: 3, landmarks: [LM.L_SH, LM.R_SH, LM.NOSE], valueCm: Math.round(cm),
      message: `Корпус ${dir}${cmText(cm)}. Сядьте ровно!`,
    });
  }

  // Плечо к уху: расстояние ухо–плечо рабочей стороны короче нормы.
  if (m.earShRaw != null && base.earShRaw) {
    const topBonus = T.shoulderHikeExtraAtTop * clamp(((m.elevationDeg ?? 0) - 90) / 90, 0, 1);
    const earSh = m.earShRaw / scale; // приводим к масштабу калибровки
    if (earSh < base.earShRaw * (1 - T.shoulderHikeDrop - topBonus)) {
      const cm = Math.min(T.maxShownCm, ((base.earShRaw - earSh) / base.S) * SHOULDER_CM);
      out.push({
        code: 'SHOULDER_HIKE', severity: 2, landmarks: [idx.sh, idx.ear], valueCm: Math.round(cm),
        message: `Плечо к уху${cmText(cm)}. Опустите плечо!`,
      });
    }
  }

  // Локоть согнут, когда рука уже вытянута к цели (там 2D-угол надёжен).
  const straightArm = ['reach_up', 'reach_side', 'reach_across'].includes(ctx.exercise);
  const reach = m.wristRel ? Math.hypot(m.wristRel.out, m.wristRel.up) : 0;
  if (straightArm && m.elbowDeg != null && reach > T.elbowCheckReach && m.elbowDeg < T.elbowBentDeg) {
    out.push({
      code: 'ELBOW_BENT', severity: 2, landmarks: [idx.sh, idx.el, idx.wr], valueDeg: Math.round(m.elbowDeg),
      message: `Локоть согнут. Выпрямите руку!`,
    });
  }

  return out;
}
