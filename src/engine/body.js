// Снимок тела за кадр: всё, что нужно калибровке, детекторам ошибок и счётчику повторов.
import { LM, MIN_VISIBILITY, sideIndex, toSpace, dist, mid, angleDeg, elevationDeg } from './geometry.js';

export const FINGER_NAMES = ['указательный', 'средний', 'безымянный', 'мизинец'];
const TIPS = [8, 12, 16, 20], PIPS = [6, 10, 14, 18];
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** Какие из 4 пальцев выпрямлены: кончик заметно дальше от запястья, чем средний сустав. */
export function fingersExtended(hand) {
  return TIPS.map((tip, i) => d2(hand[tip], hand[0]) > d2(hand[PIPS[i]], hand[0]) * 1.15);
}

/**
 * @param {Array<{x:number,y:number,z:number,visibility:number}>|null} pose — зеркальные нормированные точки
 * @param {'left'|'right'} side — рабочая рука
 * @param {number} aspect — ширина/высота кадра
 * @param {Array} [hands] — кисти (21 точка, зеркальные нормированные)
 */
export function measure(pose, side, aspect, hands = []) {
  if (!pose) return null;
  const idx = sideIndex(side);
  const vis = (i) => (pose[i]?.visibility ?? 0) >= MIN_VISIBILITY;
  const P = (i) => toSpace(pose[i], aspect);
  if (!vis(LM.L_SH) || !vis(LM.R_SH)) return null;

  const lsh = P(LM.L_SH), rsh = P(LM.R_SH);
  const S = dist(lsh, rsh);
  if (S < 1e-3) return null;
  const sh = P(idx.sh);
  const wrist = vis(idx.wr) ? P(idx.wr) : null;
  const elbow = vis(idx.el) ? P(idx.el) : null;
  const otherWrist = vis(sideIndex(side === 'left' ? 'right' : 'left').wr) ? P(sideIndex(side === 'left' ? 'right' : 'left').wr) : null;

  // Рабочая кисть — та, чьё запястье ближе к запястью рабочей руки по позе (или просто на её стороне).
  let hand = null;
  if (hands?.length) {
    const ref = vis(idx.wr) ? pose[idx.wr] : { x: pose[idx.sh].x, y: pose[idx.sh].y + 0.2 };
    hand = hands.reduce((best, h) => (!best || d2(h[0], ref) < d2(best[0], ref) ? h : best), null);
    if (d2(hand[0], ref) > 0.25) hand = null; // далеко от рабочей руки — это другая кисть
  }

  return {
    side, aspect, S,
    hand,
    fingers: hand ? fingersExtended(hand) : null,
    // Горизонтальная ширина плеч: растёт при наклоне к камере, но НЕ при подъёме одного плеча.
    Sx: Math.abs(rsh.x - lsh.x),
    sh, lsh, rsh,
    shMid: mid(lsh, rsh),
    tiltDeg: (Math.atan2(rsh.y - lsh.y, rsh.x - lsh.x) * 180) / Math.PI,
    nose: vis(LM.NOSE) ? P(LM.NOSE) : null,
    // Ухо над плечом рабочей стороны, в ширинах плеч (больше = плечо ниже, норма).
    earSh: vis(idx.ear) ? (sh.y - P(idx.ear).y) / S : null,
    earShRaw: vis(idx.ear) ? sh.y - P(idx.ear).y : null,
    // Ширина лица по внешним уголкам глаз: мера расстояния до камеры. Не меняется, когда рука поднята
    // (точка плеча в MediaPipe «едет» вместе с рукой), и рука не закрывает глаза (ухо — закрывает).
    headW: vis(LM.L_EYE_OUT) && vis(LM.R_EYE_OUT) ? Math.abs(P(LM.L_EYE_OUT).x - P(LM.R_EYE_OUT).x) : null,
    wrist, elbow, otherWrist,
    elbowDeg: wrist && elbow ? angleDeg(sh, elbow, wrist) : null,
    elevationDeg: wrist ? elevationDeg(sh, wrist) : null,
    // Запястье относительно плеча, в ширинах плеч: out — наружу от тела, up — вверх.
    wristRel: wrist ? { out: ((wrist.x - sh.x) / S) * idx.outSign, up: (sh.y - wrist.y) / S } : null,
  };
}
