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
  elbowBentDeg: 140,             // локоть согнут сильнее, чем на 140° (для пожилых допуски шире — PLAN §9)
  elbowCheckReach: 1.0,          // локоть проверяем, когда запястье дальше 1 ширины плеч от плеча (рука вытянута)
  tooFastSpeed: 8,               // запястье быстрее 8 ширин плеч в секунду — рывок (обычный подъём на живом тесте ≤ 6,2)
  fingersGraceMs: 1200,          // столько даём раскрыть ладонь, прежде чем назвать согнутые пальцы
  wrongHandUp: 0.3,              // другая рука выше своего плеча на 0,3 ширины плеч — работает не та рука
};

// Порядок = приоритет показа (одна подсказка за раз).
export const PRIORITY = ['WRONG_HAND', 'TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE', 'SHOULDER_HIKE', 'ELBOW_BENT', 'TOO_FAST', 'INCOMPLETE_ROM', 'FINGERS_NOT_OPEN'];

// Меньшее по модулю из двух смещений, если они в одну сторону; иначе 0.
const minSameSign = (a, b) => (Math.sign(a) !== Math.sign(b) ? 0 : Math.abs(a) < Math.abs(b) ? a : b);

// Насколько сильно: во сколько раз превышен порог. Сантиметры человеку не показываем — камера
// не знает точного расстояния, и «12 см» пугает/путает (решение 28.09). valueCm остаётся для отчёта врачу.
export function levelOf(over) { return over < 1.5 ? 0 : over < 2.2 ? 1 : 2; }
const LEAN_FWD = ['Чуть наклонились вперёд. Спину ровно!', 'Наклонились вперёд. Спину ровно!', 'Сильный наклон! Спину ровно!'];
const leanSide = (dir) => [`Чуть наклонились ${dir}. Сядьте ровно!`, `Наклон ${dir}. Сядьте ровно!`, `Сильный наклон ${dir}! Сядьте ровно!`];
const HIKE = ['Плечо чуть поднято. Опустите плечо!', 'Плечо поднято к уху. Опустите!', 'Плечо у самого уха! Опустите!'];

/**
 * @param {ReturnType<import('./body.js').measure>} m
 * @param {object} base — baseline из калибровки
 * @param {{exercise:string, phase:string, rest?:{shMidX:number, otherX:number, noseX:number|null}}} ctx — phase из счётчика
 *   повторов; rest — поза покоя (рука опущена) прямо перед этим повтором, в координатах пространства
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
      message: LEAN_FWD[levelOf(Math.max(noseDrop / T.leanForwardNoseDrop, (ratio - 1) / ((m.headW && base.headW ? T.leanForwardHeadRatio : T.leanForwardWidthRatio) - 1)))],
    });
  }

  // Корпус вбок: смещаются оба плеча и голова. Точка плеча рабочей стороны «едет» за поднятой рукой
  // (как с шириной плеч 28.09), поэтому берём меньшее из смещений центра плеч и НЕрабочего плеча:
  // при настоящем наклоне они равны, при «поехавшей» точке одно из них ≈ 0.
  const otherNow = base.side === 'left' ? m.rsh : m.lsh;
  const otherBase = 2 * base.shMid.x - base.sh.x;
  let shift = minSameSign((m.shMid.x - base.shMid.x) / unit, (otherNow.x - otherBase) / unit);
  let noseShift = m.nose && base.nose ? (m.nose.x - base.nose.x) / unit : 0;
  // Наклон — это движение корпуса ЗА ПОВТОР. Если человек и с опущенной рукой сидел левее/правее, чем
  // на калибровке (пересел, сдвинул стул), это не компенсация (живая запись 28.09, 72 с и 115 с:
  // в покое левое плечо уже −0,14 ширины плеч от нормы, у звезды — те же −0,13…−0,14).
  // Поэтому считаем смещение и от нормы, и от позы покоя перед этим повтором, и берём меньшее.
  const rest = ctx.rest;
  if (rest) {
    shift = minSameSign(shift, minSameSign((m.shMid.x - rest.shMidX) / unit, (otherNow.x - rest.otherX) / unit));
    if (m.nose && rest.noseX != null) noseShift = minSameSign(noseShift, (m.nose.x - rest.noseX) / unit);
  }
  // Голова одна — не корпус: при наклоне корпуса плечи тоже едут в ту же сторону. Одна точка носа «прыгает»,
  // когда кисть у рта закрывает лицо (живая запись 28.09, 145–146 с: нос −0,3, левое плечо +0,03).
  // Поэтому голова срабатывает, только если плечи сдвинулись туда же хотя бы на половину своего порога.
  const headLean = Math.abs(noseShift) > T.leanSideNoseShift && Math.sign(noseShift) === Math.sign(shift) && Math.abs(shift) > T.leanSideShift / 2;
  if (Math.abs(shift) > T.leanSideShift || headLean) {
    const main = Math.abs(noseShift) > Math.abs(shift) ? noseShift : shift;
    const dir = main > 0 ? 'вправо' : 'влево'; // зеркальный кадр: +x = правая сторона человека
    const cm = Math.min(T.maxShownCm, Math.abs(main) * SHOULDER_CM);
    out.push({
      code: 'TRUNK_LEAN_SIDE', severity: 3, landmarks: [LM.L_SH, LM.R_SH, LM.NOSE], valueCm: Math.round(cm),
      message: leanSide(dir)[levelOf(Math.max(Math.abs(shift) / T.leanSideShift, Math.abs(noseShift) / T.leanSideNoseShift))],
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
        message: HIKE[levelOf((1 - earSh / base.earShRaw) / (T.shoulderHikeDrop + topBonus))],
      });
    }
  }

  // Локоть согнут, когда рука уже вытянута к цели (там 2D-угол надёжен).
  // reach_across идёт к камере — 2D-угол локтя там врёт (ошибка 8° против 1°, PLAN §9), не проверяем.
  const straightArm = ['reach_up', 'reach_side'].includes(ctx.exercise);
  const reach = m.wristRel ? Math.hypot(m.wristRel.out, m.wristRel.up) : 0;
  if (straightArm && m.elbowDeg != null && reach > T.elbowCheckReach && m.elbowDeg < T.elbowBentDeg) {
    out.push({
      code: 'ELBOW_BENT', severity: 2, landmarks: [idx.sh, idx.el, idx.wr], valueDeg: Math.round(m.elbowDeg),
      message: `Локоть согнут. Выпрямите руку!`,
    });
  }

  return out;
}
