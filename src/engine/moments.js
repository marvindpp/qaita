// Стоп-кадры «до/после» для итогов: маленький JPEG из видео (зеркально, как видит человек) + метки.
// Картинка остаётся в памяти браузера — никуда не отправляется (PLAN §9: страх записи).
const W = 360;
const RED = '#e0553f', GOLD = '#f2b42a', GREEN = '#2ea36e';
let canvas = null;

/**
 * @param {HTMLVideoElement} video
 * @param {Array<{x:number,y:number}>} pose — зеркальные нормированные точки
 * @param {{kind:'mistake'|'good', side:'left'|'right', landmarks?:number[], target?:{x:number,y:number,radius:number}}} o
 * @returns {string} data:image/jpeg
 */
export function snapshot(video, pose, { kind, side, landmarks = [], target = null }) {
  if (!video.videoWidth) return null;
  const H = Math.round((W * video.videoHeight) / video.videoWidth);
  canvas ??= document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(video, 0, 0, W, H); g.restore();
  const P = (i) => pose[i] && { x: pose[i].x * W, y: pose[i].y * H };
  const s = side === 'left' ? { sh: 11, el: 13, wr: 15 } : { sh: 12, el: 14, wr: 16 };
  const color = kind === 'mistake' ? RED : GREEN;

  // Только рабочая рука и линия плеч — без полного скелета.
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = color; g.lineWidth = 6;
  const arm = [P(s.sh), P(s.el), P(s.wr)].filter(Boolean);
  g.beginPath(); arm.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
  const l = P(11), r = P(12);
  if (l && r) { g.lineWidth = 4; g.setLineDash(kind === 'mistake' ? [] : [8, 6]); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke(); g.setLineDash([]); }

  if (kind === 'mistake') {
    for (const i of landmarks) {
      const p = P(i);
      if (!p) continue;
      g.fillStyle = 'rgba(224,85,63,.35)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = RED; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, 16, 0, Math.PI * 2); g.stroke();
    }
  } else if (target) {
    const t = { x: target.x * W, y: target.y * H };
    g.fillStyle = GOLD; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 9 : 20;
      g.lineTo(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill(); g.stroke();
  }
  return canvas.toDataURL('image/jpeg', 0.75);
}
