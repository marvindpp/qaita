// Геометрия позы. Все расчёты — в «аспектном» пространстве: x умножен на ширину/высоту кадра,
// чтобы расстояния по X и Y были в одних единицах (кадр 4:3 не квадратный).

export const LM = { NOSE: 0, L_EAR: 7, R_EAR: 8, L_SH: 11, R_SH: 12, L_EL: 13, R_EL: 14, L_WR: 15, R_WR: 16 };
export const MIN_VISIBILITY = 0.5;

// Индексы точек рабочей стороны. outSign: куда «наружу» от тела по X в зеркальном кадре.
export function sideIndex(side) {
  return side === 'left'
    ? { sh: LM.L_SH, el: LM.L_EL, wr: LM.L_WR, ear: LM.L_EAR, otherSh: LM.R_SH, outSign: -1 }
    : { sh: LM.R_SH, el: LM.R_EL, wr: LM.R_WR, ear: LM.R_EAR, otherSh: LM.L_SH, outSign: 1 };
}

export const toSpace = (p, aspect) => ({ x: p.x * aspect, y: p.y });
export const fromSpace = (p, aspect) => ({ x: p.x / aspect, y: p.y });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Угол ABC в градусах (в точке B).
export function angleDeg(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (n === 0) return 180;
  return (Math.acos(clamp((v1.x * v2.x + v1.y * v2.y) / n, -1, 1)) * 180) / Math.PI;
}

// Подъём руки: 0° — рука висит вниз, 90° — горизонтально, 180° — прямо вверх.
export function elevationDeg(shoulder, wrist) {
  const v = { x: wrist.x - shoulder.x, y: wrist.y - shoulder.y };
  const n = Math.hypot(v.x, v.y);
  if (n === 0) return 0;
  return (Math.acos(clamp(v.y / n, -1, 1)) * 180) / Math.PI;
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
