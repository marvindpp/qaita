// Генератор синтетической позы сидящего человека (зеркальные нормированные координаты, как отдаёт движок).
export const ASPECT = 4 / 3;

/**
 * @param {object} o
 * @param {'left'|'right'} [o.side='right'] рабочая рука
 * @param {{out:number, up:number}|null} [o.wrist] запястье рабочей руки относительно плеча, в ширинах плеч; null = рука опущена за кадр
 * @param {number} [o.elbowBend=0] смещение локтя вбок от прямой линии (ширины плеч) → сгиб
 * @param {number} [o.elbowDrop=0] смещение локтя вниз (ширины плеч) → сгиб при отведении в сторону
 * @param {number} [o.spread=1] только точки плеч шире (как у MediaPipe при поднятой руке), голова та же
 * @param {number} [o.scale=1] ширина плеч × scale (наклон к камере)
 * @param {number} [o.shift=0] сдвиг всего корпуса вбок (ширины плеч)
 * @param {number} [o.noseDrop=0] нос ниже нормы (ширины плеч)
 * @param {number} [o.hike=0] плечо рабочей стороны выше нормы (ширины плеч)
 */
export function makePose({ side = 'right', wrist = null, elbowBend = 0, elbowDrop = 0, spread = 1, scale = 1, shift = 0, noseDrop = 0, hike = 0 } = {}) {
  const S = 0.3 * scale;
  const cx = ASPECT / 2 + shift * 0.3;
  const shY = 0.62;
  const pts = Array.from({ length: 33 }, () => ({ x: cx, y: 0.9, z: 0, visibility: 0.1 }));
  const set = (i, x, y, v = 0.99) => { pts[i] = { x, y, z: 0, visibility: v }; };
  const outSign = side === 'left' ? -1 : 1;
  const L = { x: cx - (S * spread) / 2, y: shY }, R = { x: cx + (S * spread) / 2, y: shY };
  if (side === 'right') R.y -= hike * 0.3; else L.y -= hike * 0.3;
  set(11, L.x, L.y); set(12, R.x, R.y);
  set(0, cx, shY - 1.0 * 0.3 + noseDrop * 0.3);
  set(7, cx - 0.25 * S, shY - 0.9 * 0.3); set(8, cx + 0.25 * S, shY - 0.9 * 0.3);
  set(3, cx - 0.12 * S, shY - 1.05 * 0.3); set(6, cx + 0.12 * S, shY - 1.05 * 0.3); // уголки глаз
  const sh = side === 'right' ? R : L;
  const [elI, wrI] = side === 'right' ? [14, 16] : [13, 15];
  if (wrist) {
    const w = { x: sh.x + wrist.out * 0.3 * outSign, y: sh.y - wrist.up * 0.3 };
    const e = { x: (sh.x + w.x) / 2 + elbowBend * 0.3 * outSign, y: (sh.y + w.y) / 2 + elbowDrop * 0.3 };
    set(elI, e.x, e.y); set(wrI, w.x, w.y);
  }
  return pts.map((p) => ({ ...p, x: p.x / ASPECT }));
}

// Проигрывает последовательность поз: [[pose, ms], ...] с шагом 33 мс.
export function* frames(seq, start = 0) {
  let t = start;
  for (const [pose, ms] of seq) {
    for (let e = 0; e < ms; e += 33) { yield [pose, t]; t += 33; }
  }
}
