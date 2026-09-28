// Снимок тела за кадр: всё, что нужно калибровке, детекторам ошибок и счётчику повторов.
import { LM, MIN_VISIBILITY, sideIndex, toSpace, dist, mid, angleDeg, elevationDeg } from './geometry.js';

/**
 * @param {Array<{x:number,y:number,z:number,visibility:number}>|null} pose — зеркальные нормированные точки
 * @param {'left'|'right'} side — рабочая рука
 * @param {number} aspect — ширина/высота кадра
 */
export function measure(pose, side, aspect) {
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

  return {
    side, aspect, S,
    // Горизонтальная ширина плеч: растёт при наклоне к камере, но НЕ при подъёме одного плеча.
    Sx: Math.abs(rsh.x - lsh.x),
    sh, lsh, rsh,
    shMid: mid(lsh, rsh),
    tiltDeg: (Math.atan2(rsh.y - lsh.y, rsh.x - lsh.x) * 180) / Math.PI,
    nose: vis(LM.NOSE) ? P(LM.NOSE) : null,
    // Ухо над плечом рабочей стороны, в ширинах плеч (больше = плечо ниже, норма).
    earSh: vis(idx.ear) ? (sh.y - P(idx.ear).y) / S : null,
    wrist, elbow, otherWrist,
    elbowDeg: wrist && elbow ? angleDeg(sh, elbow, wrist) : null,
    elevationDeg: wrist ? elevationDeg(sh, wrist) : null,
    // Запястье относительно плеча, в ширинах плеч: out — наружу от тела, up — вверх.
    wristRel: wrist ? { out: ((wrist.x - sh.x) / S) * idx.outSign, up: (sh.y - wrist.y) / S } : null,
  };
}
