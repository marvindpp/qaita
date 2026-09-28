// Камера [E]: одно <video> на всё приложение + canvas поверх для трафарета, скелета и звезды.
// Экран вызывает mount(slot, { overlay }) — видео переезжает к нему. Координаты движка уже зеркальные,
// видео зеркалим CSS-ом, поэтому точки рисуем как есть; учитываем только обрезку object-fit: cover.
import { html } from '../dom.js';
import { icons } from '../icons.js';

const GREEN = '#2ea36e';

export function createCamera(video, park) {
  const el = html(`
    <div class="cam" data-seen="false" data-live="false">
      <div class="cam-wait">Включаю камеру…</div>
      <canvas></canvas>
      <span class="cam-badge">${icons.check}Вижу вас</span>
    </div>`);
  el.prepend(video);
  const canvas = el.querySelector('canvas');
  const wait = el.querySelector('.cam-wait');
  const ctx = canvas.getContext('2d');

  let overlay = 'none';   // none | guide | play
  let seen = false;
  let lastFrame = null;
  let drawExtra = null;   // экран может дорисовать своё (звезда, подсветка)
  let w = 0, h = 0, dpr = 1;
  // Цифровое зеркало (зеркальная терапия, PLAN §9г): здоровая половина тела отражается на место больной.
  // healthy — сторона человека, которой он двигает (её и отслеживает движок).
  let mirror = null;      // null | 'left' | 'right'
  let midX = null;        // линия зеркала (середина плеч) в пикселях, сглаженная

  const ro = new ResizeObserver(() => resize());
  ro.observe(el);

  function resize() {
    const r = el.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw();
  }

  /** Нормированная точка кадра → пиксели контейнера (с учётом object-fit: cover). */
  function toPx(p) {
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    const s = Math.max(w / vw, h / vh);
    return { x: (w - vw * s) / 2 + p.x * vw * s, y: (h - vh * s) / 2 + p.y * vh * s, scale: vw * s };
  }

  function drawGuide() {
    // Трафарет «куда сесть» — те же пропорции, что в debug-оверлее движка.
    const head = toPx({ x: 0.5, y: 0.42 });
    const unit = toPx({ x: 1, y: 1 });
    const o = toPx({ x: 0, y: 0 });
    const W = unit.x - o.x, H = unit.y - o.y;
    ctx.save();
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = seen ? GREEN : 'rgba(255,255,255,.92)';
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = seen ? 0 : 6;
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, 0.075 * W, 0.13 * H, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x + 0.3 * W, o.y + 0.98 * H);
    ctx.quadraticCurveTo(o.x + 0.3 * W, o.y + 0.64 * H, o.x + 0.44 * W, o.y + 0.6 * H);
    ctx.moveTo(o.x + 0.7 * W, o.y + 0.98 * H);
    ctx.quadraticCurveTo(o.x + 0.7 * W, o.y + 0.64 * H, o.x + 0.56 * W, o.y + 0.6 * H);
    ctx.stroke();
    ctx.restore();
  }

  function drawMirror() {
    const pose = lastFrame?.pose;
    const l = pose?.[11], r = pose?.[12];
    if (l && r && (l.visibility ?? 1) > 0.5 && (r.visibility ?? 1) > 0.5) {
      const m = (toPx(l).x + toPx(r).x) / 2;
      midX = midX == null ? m : midX * 0.8 + m * 0.2;
    }
    if (midX == null || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(w / vw, h / vh);
    const dw = vw * s, dh = vh * s, dx = (w - dw) / 2, dy = (h - dh) / 2;
    // Зеркальные координаты: +x = правая сторона человека. Здоровая левая → слева от линии, больная — справа.
    const affectedRight = mirror === 'left';
    ctx.save();
    ctx.beginPath();
    if (affectedRight) ctx.rect(midX, 0, w - midX, h); else ctx.rect(0, 0, midX, h);
    ctx.clip();
    // Видео на экране отражено CSS (scaleX(-1)); отражение ещё раз вокруг midX = обычная картинка со сдвигом.
    ctx.translate(2 * midX - w, 0);
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();
    // Сама «плоскость зеркала» — тонкая мягкая линия.
    const g = ctx.createLinearGradient(midX - 10, 0, midX + 10, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(midX - 10, 0, 20, h);
  }

  /** В режиме зеркала всё, что рисуют экраны (звезда, ладонь), переносится на сторону больной руки. */
  function drawPx(p) {
    const q = toPx(p);
    return mirror && midX != null ? { ...q, x: 2 * midX - q.x } : q;
  }

  function draw() {
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (mirror) drawMirror();
    if (overlay === 'guide') drawGuide();
    if (drawExtra) drawExtra({ ctx, toPx: drawPx, frame: lastFrame, w, h });
  }

  return {
    el,
    mount(slot, { overlay: mode = 'none', extra = null } = {}) {
      overlay = mode;
      drawExtra = extra;
      slot.append(el);
      video.play?.().catch(() => {});
      resize();
    },
    park() {
      overlay = 'none';
      drawExtra = null;
      park.append(el);
    },
    onFrame(frame) {
      lastFrame = frame;
      if (el.dataset.live !== 'true') el.dataset.live = 'true';
      draw();
    },
    setSeen(v) {
      seen = Boolean(v);
      el.dataset.seen = String(seen);
      draw();
    },
    setWaitText(text) { wait.textContent = text; },
    /** healthy: 'left' | 'right' — какой рукой человек реально двигает; null — выключить зеркало. */
    setMirror(healthy) { mirror = healthy || null; midX = null; el.dataset.mirror = String(Boolean(mirror)); draw(); },
    toPx,
  };
}
