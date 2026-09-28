// Фейковый человек на стуле для mock-движка [E]: 33 точки позы, 21 точка кисти и «видео с камеры».
// Координаты как у настоящего движка: нормированы 0..1 и уже зеркалены (+x = правая сторона человека).
// Расчёты — в аспектном пространстве (x × 4/3), чтобы длины рук по X и Y совпадали.

export const ASPECT = 4 / 3;
export const VIDEO_W = 640;
export const VIDEO_H = 480;

// Поза в покое (нормированные координаты). Плечи 0,2 ширины кадра — «хороший кадр» по правилам движка.
const REST = {
  nose: { x: 0.5, y: 0.285 },
  sh: { left: { x: 0.4, y: 0.45 }, right: { x: 0.6, y: 0.45 } },
  hip: { left: { x: 0.43, y: 0.8 }, right: { x: 0.57, y: 0.8 } },
  wrist: { left: { x: 0.44, y: 0.77 }, right: { x: 0.56, y: 0.77 } },
};
const OUT = { left: -1, right: 1 };
const S = (REST.sh.right.x - REST.sh.left.x) * ASPECT; // ширина плеч в аспектных единицах
const UPPER_ARM = 0.82 * S;
const FOREARM = 0.74 * S;

const toA = (p) => ({ x: p.x * ASPECT, y: p.y });
const fromA = (p) => ({ x: p.x / ASPECT, y: p.y });
const lerp = (a, b, k) => a + (b - a) * k;
const lerpP = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

export const shoulderOf = (side) => ({ ...REST.sh[side] });
export const restWristOf = (side) => ({ ...REST.wrist[side] });
export const mouth = () => ({ x: REST.nose.x, y: REST.nose.y + 0.06 });

// Подъём руки как в движке: 0° — висит, 90° — горизонтально, 180° — вверх.
export function elevationDeg(sh, wr) {
  const a = toA(sh), b = toA(wr);
  const n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (b.y - a.y) / n))) * 180) / Math.PI;
}

// Двухзвенная рука: по плечу и желаемому запястью находим локоть (локоть уходит наружу и вниз).
// bend 0..1 — насколько «не дотягивается» (для ошибки «локоть согнут»).
function solveArm(shN, wristN, side, bend = 0) {
  const sh = toA(shN);
  let w = toA(wristN);
  const maxReach = (UPPER_ARM + FOREARM) * (1 - 0.28 * bend) - 1e-4;
  let dx = w.x - sh.x, dy = w.y - sh.y;
  let d = Math.hypot(dx, dy) || 1e-4;
  if (d > maxReach) { w = { x: sh.x + (dx / d) * maxReach, y: sh.y + (dy / d) * maxReach }; dx = w.x - sh.x; dy = w.y - sh.y; d = maxReach; }
  const a = (UPPER_ARM ** 2 - FOREARM ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - a ** 2));
  const ux = dx / d, uy = dy / d;
  const base = { x: sh.x + ux * a, y: sh.y + uy * a };
  // Две возможные точки локтя — берём ту, что снаружи от тела (и ниже).
  const e1 = { x: base.x - uy * h, y: base.y + ux * h };
  const e2 = { x: base.x + uy * h, y: base.y - ux * h };
  const score = (e) => (e.x - sh.x) * OUT[side] + (e.y - sh.y) * 0.6;
  const elbow = score(e1) >= score(e2) ? e1 : e2;
  return { elbow: fromA(elbow), wrist: fromA(w) };
}

/**
 * Кисть из 21 точки (MediaPipe HandLandmarker): 0 — запястье, 1–4 большой, 5–8 указательный, 9–12 средний, 13–16 безымянный, 17–20 мизинец.
 * @param {{x,y}} wristN — запястье (норм.)
 * @param {number} angle — куда смотрят пальцы, радианы (−π/2 = вверх)
 * @param {number[]} curl — согнутость [большой, указ., средний, безым., мизинец], 0 = прямой, 1 = кулак
 * @param {'left'|'right'} side — с какой стороны большой палец
 */
export function makeHand(wristN, angle, curl, side, size = 0.62 * S) {
  const w = toA(wristN);
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const perp = { x: -dir.y * -OUT[side], y: dir.x * -OUT[side] }; // к большому пальцу
  const at = (p, v, k) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
  const pts = [w];
  // Большой палец: от основания ладони по диагонали наружу.
  const tDir = { x: dir.x * 0.55 + perp.x * 0.85, y: dir.y * 0.55 + perp.y * 0.85 };
  let p = at(at(w, perp, 0.22 * size), dir, 0.12 * size);
  pts.push(p);
  const tc = curl[0];
  for (const [len, k] of [[0.3, 1], [0.25, 1 - 1.4 * tc], [0.2, 1 - 1.8 * tc]]) {
    const v = { x: lerp(tDir.x, dir.x * -0.2 - perp.x * 0.9, tc * (k < 1 ? 1 : 0.4)), y: lerp(tDir.y, dir.y * -0.2 - perp.y * 0.9, tc * (k < 1 ? 1 : 0.4)) };
    p = at(p, v, len * size);
    pts.push(p);
  }
  // Четыре пальца: основания веером поперёк ладони, суставы при сгибании «возвращаются» к ладони.
  const spread = [0.3, 0.1, -0.1, -0.28];
  const lens = [[0.38, 0.24, 0.2], [0.42, 0.27, 0.21], [0.39, 0.25, 0.2], [0.31, 0.2, 0.17]];
  for (let f = 0; f < 4; f += 1) {
    const c = curl[f + 1];
    const fan = spread[f] * 0.35 * (1 - c);
    const fd = { x: dir.x + perp.x * fan, y: dir.y + perp.y * fan };
    let q = at(at(w, dir, 0.88 * size), perp, spread[f] * size);
    pts.push(q);
    const k = [1 - 0.45 * c, 1 - 1.7 * c, 1 - 2.3 * c];
    for (let j = 0; j < 3; j += 1) {
      q = at(q, fd, lens[f][j] * size * k[j]);
      pts.push(q);
    }
  }
  return pts.map((pt) => ({ ...fromA(pt), z: 0 }));
}

export const OPEN = [0, 0, 0, 0, 0];
export const FIST = [0.9, 1, 1, 1, 1];
export const THUMB_UP = [0, 1, 1, 1, 1];

/**
 * Собрать позу из «состояния тела». Всё плавно меняется снаружи (mockEngine), тут только геометрия.
 * @param {{ wrist:{left,right}, bend:{left,right}, hike:{left,right}, leanSide:number, leanFwd:number, breath:number, visible:boolean }} b
 */
export function buildPose(b) {
  if (!b.visible) return null;
  const pose = new Array(33);
  const vis = (p, v = 0.99) => ({ x: p.x, y: p.y, z: 0, visibility: v });
  // Наклоны: вбок — сдвиг корпуса и головы; вперёд — тело «растёт» в кадре вокруг бёдер.
  const hipMid = { x: 0.5, y: REST.hip.left.y };
  const lean = (p, headK = 1) => {
    const scale = 1 + b.leanFwd * 0.12;
    const x = hipMid.x + (p.x - hipMid.x) * scale + b.leanSide * 0.045 * headK * ((hipMid.y - p.y) / (hipMid.y - 0.3));
    const y = hipMid.y + (p.y - hipMid.y) * scale + b.leanFwd * 0.05 * headK * ((hipMid.y - p.y) / (hipMid.y - 0.3));
    return { x, y: y + b.breath };
  };
  const nose = lean(REST.nose, 1.15);
  const face = (dx, dy) => ({ x: nose.x + dx, y: nose.y + dy });
  pose[0] = vis(nose);
  pose[1] = vis(face(-0.014, -0.022)); pose[2] = vis(face(-0.024, -0.024)); pose[3] = vis(face(-0.034, -0.022));
  pose[4] = vis(face(0.014, -0.022)); pose[5] = vis(face(0.024, -0.024)); pose[6] = vis(face(0.034, -0.022));
  pose[7] = vis(face(-0.058, -0.004)); pose[8] = vis(face(0.058, -0.004));
  pose[9] = vis(face(-0.016, 0.036)); pose[10] = vis(face(0.016, 0.036));

  for (const side of ['left', 'right']) {
    const [iSh, iEl, iWr, iPi, iIn, iTh, iHip, iKn, iAn, iHe, iFt] = side === 'left'
      ? [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31] : [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
    const baseSh = REST.sh[side];
    const sh = lean({ x: baseSh.x, y: baseSh.y - b.hike[side] * 0.045 });
    const { elbow, wrist } = solveArm(sh, b.wrist[side], side, b.bend[side]);
    pose[iSh] = vis(sh);
    pose[iEl] = vis(elbow);
    pose[iWr] = vis(wrist);
    const f = { x: (wrist.x - elbow.x) * 0.35, y: (wrist.y - elbow.y) * 0.35 };
    pose[iPi] = vis({ x: wrist.x + f.x - 0.008 * OUT[side], y: wrist.y + f.y });
    pose[iIn] = vis({ x: wrist.x + f.x + 0.004 * OUT[side], y: wrist.y + f.y - 0.004 });
    pose[iTh] = vis({ x: wrist.x + f.x * 0.6 + 0.012 * OUT[side], y: wrist.y + f.y * 0.6 });
    const hip = REST.hip[side];
    pose[iHip] = vis({ x: hip.x, y: hip.y + b.breath * 0.3 }, 0.9);
    pose[iKn] = vis({ x: hip.x + 0.01 * OUT[side], y: 1.02 }, 0.35);
    pose[iAn] = vis({ x: hip.x, y: 1.3 }, 0.05);
    pose[iHe] = vis({ x: hip.x, y: 1.33 }, 0.05);
    pose[iFt] = vis({ x: hip.x, y: 1.35 }, 0.05);
  }
  return pose;
}

// ——— «Видео с камеры»: рисуем комнату и человека на canvas и отдаём в <video> как поток ———
// UI зеркалит видео через CSS (как настоящую вебкамеру), поэтому здесь рисуем НЕзеркально: x → 1 − x.

const SKIN = '#e2b79a';
const SWEATER = '#6f8f86';
const SWEATER_DARK = '#5d7b73';
const HAIR = '#4a3a33';

export function createFakeCamera(video) {
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext('2d');
  const X = (p) => (1 - p.x) * VIDEO_W;
  const Y = (p) => p.y * VIDEO_H;
  const px = S / ASPECT * VIDEO_W; // ширина плеч в пикселях

  function background(dim) {
    const g = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
    g.addColorStop(0, '#efe7da');
    g.addColorStop(1, '#d9ccb8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
    // Окно с мягким светом.
    const win = ctx.createRadialGradient(120, 90, 10, 120, 90, 260);
    win.addColorStop(0, 'rgba(255,250,235,0.9)');
    win.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = win;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(52, 40, 120, 150);
    ctx.fillStyle = 'rgba(170,150,120,0.35)';
    ctx.fillRect(110, 40, 4, 150);
    ctx.fillRect(52, 112, 120, 4);
    // Спинка стула.
    ctx.fillStyle = '#8a6a52';
    roundRect(VIDEO_W / 2 - px * 0.95, VIDEO_H * 0.36, px * 1.9, VIDEO_H * 0.7, 28);
    ctx.fill();
    if (dim) { ctx.fillStyle = `rgba(20,16,12,${dim})`; ctx.fillRect(0, 0, VIDEO_W, VIDEO_H); }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function limb(a, b, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(b), Y(b));
    ctx.stroke();
  }

  function drawHand(hand) {
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = SKIN;
    ctx.lineCap = 'round';
    ctx.lineWidth = px * 0.075;
    for (const chain of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20]]) {
      ctx.beginPath();
      chain.forEach((i, k) => (k ? ctx.lineTo(X(hand[i]), Y(hand[i])) : ctx.moveTo(X(hand[i]), Y(hand[i]))));
      ctx.stroke();
    }
    ctx.beginPath();
    for (const i of [0, 5, 9, 13, 17]) ctx.lineTo(X(hand[i]), Y(hand[i]));
    ctx.closePath();
    ctx.fill();
  }

  function person(pose, hands) {
    const L = (i) => pose[i];
    // Торс.
    ctx.fillStyle = SWEATER;
    ctx.beginPath();
    const pad = 0.018;
    ctx.moveTo(X({ x: L(11).x - pad, y: L(11).y }), Y(L(11)) - 6);
    ctx.lineTo(X({ x: L(12).x + pad, y: L(12).y }), Y(L(12)) - 6);
    ctx.lineTo(X({ x: L(24).x + 0.03, y: 0 }), VIDEO_H);
    ctx.lineTo(X({ x: L(23).x - 0.03, y: 0 }), VIDEO_H);
    ctx.closePath();
    ctx.fill();
    // Шея и голова.
    const nose = L(0);
    const neck = { x: (L(11).x + L(12).x) / 2, y: (L(11).y + L(12).y) / 2 };
    limb({ x: neck.x, y: neck.y - 0.01 }, { x: nose.x, y: nose.y + 0.05 }, px * 0.28, SKIN);
    const headR = px * 0.34;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(X(nose), Y(nose) - headR * 0.15, headR * 0.82, headR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.ellipse(X(nose), Y(nose) - headR * 0.62, headR * 0.86, headR * 0.58, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Глаза и улыбка — чтобы «человек» читался.
    ctx.fillStyle = '#3b2f2a';
    for (const i of [2, 5]) { ctx.beginPath(); ctx.arc(X(L(i)), Y(L(i)), 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#a0685a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(X(nose), Y(nose) + headR * 0.22, headR * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // Руки: плечо → локоть (рукав), локоть → запястье (рукав), кисть.
    for (const [sh, el, wr] of [[11, 13, 15], [12, 14, 16]]) {
      limb(L(sh), L(el), px * 0.24, SWEATER_DARK);
      limb(L(el), L(wr), px * 0.2, SWEATER_DARK);
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(X(L(wr)), Y(L(wr)), px * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const h of hands) drawHand(h);
  }

  let stream = null;
  return {
    async attach() {
      background(0);
      stream = canvas.captureStream?.(30) ?? null;
      if (!stream || !video) return;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try { await video.play(); } catch { /* автоплей без звука обычно разрешён; если нет — UI всё равно работает */ }
    },
    draw(pose, hands, dim = 0) {
      background(0);
      if (pose) person(pose, hands);
      if (dim) { ctx.fillStyle = `rgba(20,16,12,${dim})`; ctx.fillRect(0, 0, VIDEO_W, VIDEO_H); }
    },
    detach() {
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    },
  };
}
