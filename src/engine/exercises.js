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
  // «Чашка ко рту» — функциональная задача (её изучали в статье про компенсации). Цель — рот, не растёт.
  hand_to_mouth: {
    adaptive: false,
    target: (base, aspect) => {
      const { outSign } = sideIndex(base.side);
      const mouth = base.nose ? { x: base.nose.x, y: base.nose.y + 0.18 * base.S } : { x: base.sh.x - 0.5 * base.S * outSign, y: base.sh.y - 0.6 * base.S };
      const edge = EDGE + RADIUS_MAX;
      return { x: clamp(mouth.x, edge * aspect, (1 - edge) * aspect), y: clamp(mouth.y, edge * aspect, 1 - edge) };
    },
    radiusScale: 0.7,
  },
  // «Через себя» — ладонью к противоположному плечу. Движение частично к камере → локоть не проверяем (2D врёт).
  reach_across: {
    target: (base, aspect) => targetFromRel(base, { out: -1.15, up: 0.25 }, aspect),
  },
  // «Раскрыть ладонь» — кулак → ладонь. Ключевое для кисти после инсульта. Цель — «покажите ладонь здесь».
  open_hand: {
    adaptive: false,
    hand: true,
    target: (base, aspect) => {
      const { outSign } = sideIndex(base.side);
      return { x: base.sh.x - 0.2 * base.S * outSign, y: base.sh.y + 0.35 * base.S };
    },
  },
};

export function createExercise(id, base, aspect) {
  const def = EXERCISE_DEFS[id];
  if (!def) return null;
  let target = def.target(base, aspect);
  const radius = clamp(TARGET_RADIUS_S * base.S * (def.radiusScale ?? 1), RADIUS_MIN * aspect, RADIUS_MAX * aspect);
  const restUp = -0.4; // запястье ниже плеча на 0,4 ширины плеч (или не видно) = рука опущена
  // Направление «плечо → цель»: по нему считаем, насколько далеко человек дотянулся.
  const dir0 = { x: target.x - base.sh.x, y: target.y - base.sh.y };
  const dirLen = Math.hypot(dir0.x, dir0.y) || 1;
  const unit = { x: dir0.x / dirLen, y: dir0.y / dirLen };
  const edge = EDGE + RADIUS_MAX;
  const clampToFrame = (p) => ({ x: clamp(p.x, edge * aspect, (1 - edge) * aspect), y: clamp(p.y, edge * aspect, 1 - edge) });
  const restPoint = { x: base.sh.x, y: base.sh.y - restUp * base.S };

  const targetLen = () => Math.hypot(target.x - base.sh.x, target.y - base.sh.y);
  const alongOf = (p) => (p.x - base.sh.x) * unit.x + (p.y - base.sh.y) * unit.y;

  return {
    id,
    adaptive: def.adaptive !== false,
    handExercise: Boolean(def.hand),
    get target() { return target; },
    radius,
    /** Для события `target` по контракту: нормированные координаты, radius — доля ширины кадра. */
    targetEvent() {
      const n = fromSpace(target, aspect);
      return { x: n.x, y: n.y, radius: radius / aspect };
    },
    /** Насколько далеко (по направлению к цели) сейчас запястье, в единицах пространства. */
    reachOf(m) { return m?.wrist ? alongOf(m.wrist) : 0; },
    /** Отодвинуть цель на длину len от плеча (в пределах кадра). @returns true, если цель сдвинулась */
    moveTo(len) {
      if (def.adaptive === false) return false;
      const next = clampToFrame({ x: base.sh.x + unit.x * len, y: base.sh.y + unit.y * len });
      if (dist(next, target) < radius * 0.25) return false;
      target = next;
      return true;
    },
    targetLen,
    evaluate(m) {
      if (def.hand) {
        const open = m?.fingers ? m.fingers.filter(Boolean).length : 0;
        return { atRest: !m?.fingers || open <= 1, inTarget: open === 4, progress: open / 4 };
      }
      const w = m?.wristRel;
      const atRest = !w || w.up < restUp;
      const wristS = m?.wrist;
      // «У цели» = внутри круга ИЛИ дотянулся дальше звезды по направлению от плеча к ней
      // (цель могла прижаться к краю кадра — перевыполнение засчитываем).
      let inTarget = false;
      if (wristS) {
        const len = targetLen();
        const perp = Math.abs((wristS.x - base.sh.x) * unit.y - (wristS.y - base.sh.y) * unit.x);
        inTarget = dist(wristS, target) < radius || (alongOf(wristS) >= len - radius && perp < radius * 1.8);
      }
      const fullPath = Math.max(0.3 * base.S, dist(restPoint, target));
      const progress = wristS ? clamp(1 - dist(wristS, target) / fullPath, 0, 1) : 0;
      return { atRest, inTarget, progress };
    },
  };
}
