// Описание упражнений: где цель, когда рука «у цели», когда «в покое».
// Цель ставится на 105% ЛИЧНОГО максимума из калибровки — адаптивная сложность.
import { clamp, dist, fromSpace, sideIndex } from './geometry.js';

const STRETCH = 1.05;
const TARGET_RADIUS_S = 0.45; // радиус цели в ширинах плеч
const EDGE = 0.06;            // цель не ближе 6% к краю кадра
const RADIUS_MIN = 0.05, RADIUS_MAX = 0.11; // радиус цели в долях ширины кадра

// Точка цели в аспектном пространстве от НОРМЫ плеча (калибровка), а не от текущего:
// если человек дотягивается наклоном корпуса — это компенсация, её поймают детекторы.
function targetFromRel(base, rel, aspect) {
  const { outSign } = sideIndex(base.side);
  const p = {
    x: base.sh.x + rel.out * STRETCH * base.S * outSign,
    y: base.sh.y - rel.up * STRETCH * base.S,
  };
  const edge = EDGE + RADIUS_MAX; // весь круг, а не только центр, внутри кадра
  return { x: clamp(p.x, edge * aspect, (1 - edge) * aspect), y: clamp(p.y, edge * aspect, 1 - edge) };
}

export const EXERCISE_DEFS = {
  reach_up: {
    target: (base, aspect) => targetFromRel(base, base.maxUp, aspect),
  },
  // Отведение в сторону — фронтальная плоскость, камера видит его точнее всего.
  reach_side: {
    target: (base, aspect) => targetFromRel(base, base.maxSide, aspect),
  },
};

export function createExercise(id, base, aspect) {
  const def = EXERCISE_DEFS[id];
  if (!def) return null;
  const target = def.target(base, aspect);
  const radius = clamp(TARGET_RADIUS_S * base.S, RADIUS_MIN * aspect, RADIUS_MAX * aspect);
  const restUp = -0.4; // запястье ниже плеча на 0,4 ширины плеч (или не видно) = рука опущена
  // Путь от «рука опущена» до цели — для прогресса (доля пути).
  const restPoint = { x: base.sh.x, y: base.sh.y - restUp * base.S };
  const fullPath = Math.max(0.3 * base.S, dist(restPoint, target));

  return {
    id,
    target,
    radius,
    /** Для события `target` по контракту: нормированные координаты, radius — доля ширины кадра. */
    targetEvent() {
      const n = fromSpace(target, aspect);
      return { x: n.x, y: n.y, radius: radius / aspect };
    },
    evaluate(m) {
      const w = m?.wristRel;
      const atRest = !w || w.up < restUp;
      const wristS = m?.wrist;
      // «У цели» = внутри круга ИЛИ дотянулся дальше звезды по направлению от плеча к ней
      // (цель могла прижаться к краю кадра — перевыполнение засчитываем).
      let inTarget = false;
      if (wristS) {
        const v = { x: target.x - base.sh.x, y: target.y - base.sh.y };
        const w2 = { x: wristS.x - base.sh.x, y: wristS.y - base.sh.y };
        const len = Math.hypot(v.x, v.y) || 1;
        const along = (w2.x * v.x + w2.y * v.y) / len;
        const perp = Math.abs(w2.x * v.y - w2.y * v.x) / len;
        inTarget = dist(wristS, target) < radius || (along >= len - radius && perp < radius * 1.8);
      }
      const progress = wristS ? clamp(1 - dist(wristS, target) / fullPath, 0, 1) : 0;
      return { atRest, inTarget, progress };
    },
  };
}
