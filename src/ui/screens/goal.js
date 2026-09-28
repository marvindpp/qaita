// Экран «Ради чего?» — цель из жизни (PLAN §9г). Выбор без мыши: ДОТЯНУТЬСЯ ладонью до пузыря с целью
// и подержать 1,2 с — это уже первое движение тренировки. Для родственника рядом — те же цели кнопками.
import { html, esc } from '../dom.js';
import { GOALS, loadGoal, saveGoal } from '../life.js';

const HOLD_MS = 1200;
const IDX = { left: { sh: 11, el: 13, wr: 15, other: 12 }, right: { sh: 12, el: 14, wr: 16, other: 11 } };
const vis = (p) => p && (p.visibility ?? 1) >= 0.5;

export default function goal(ctx) {
  const saved = loadGoal();
  const el = html(`
    <section class="goal" aria-labelledby="goal-title">
      <div class="goal-head stagger">
        <h1 id="goal-title">Ради чего вы занимаетесь?</h1>
        <p class="lead">Дотянитесь рукой до своей цели и подержите</p>
      </div>
      <div class="goal-main">
        <div class="cam-slot"></div>
      </div>
      <div class="goal-buttons">
        ${GOALS.map((g) => `<button type="button" class="goal-btn" data-id="${g.id}" data-saved="${saved?.id === g.id}"><span>${g.emoji}</span>${esc(g.title)}</button>`).join('')}
      </div>
    </section>`);

  const side = ctx.state.side ?? 'right';
  const idx = IDX[side];
  const outSign = side === 'left' ? -1 : 1;
  let hover = null, hoverSince = 0, chosen = null, alive = true, mockTimer = null;
  let bubbles = [];

  function choose(id) {
    if (chosen) return;
    chosen = id;
    saveGoal(id);
    ctx.state.goal = id;
    const g = GOALS.find((x) => x.id === id);
    ctx.sound.confirm();
    ctx.say(`Отлично. Цель — ${g.short}. Каждое упражнение — шаг к ней`, { interrupt: true, force: true });
    setTimeout(() => { if (alive) ctx.go('calibration'); }, 1600);
  }
  el.querySelectorAll('.goal-btn').forEach((b) => b.addEventListener('click', () => choose(b.dataset.id)));

  function draw({ ctx: g, toPx, frame, w, h }) {
    const pose = frame?.pose;
    const now = performance.now();
    if (!pose || !vis(pose[idx.sh]) || !vis(pose[idx.other])) return;
    const sh = toPx(pose[idx.sh]), other = toPx(pose[idx.other]);
    const S = Math.hypot(sh.x - other.x, sh.y - other.y);
    // Пузыри — дугой вокруг плеча рабочей руки, на длине вытянутой руки: от «в сторону» до «вверх».
    const R = S * 1.75, r = Math.max(46, S * 0.5);
    const angles = [62, 101, 140, 179];
    bubbles = GOALS.map((goalItem, i) => {
      const a = (angles[i] * Math.PI) / 180;
      // Угол от «рука вниз» (0°) к «рука вверх» (180°), наружу от тела.
      const x = Math.min(w - r - 6, Math.max(r + 6, sh.x + Math.sin(a) * R * outSign));
      const y = Math.min(h - r - 6, Math.max(r + 6, sh.y + Math.cos(a) * R));
      return { ...goalItem, x, y, r };
    });
    // Ладонь = запястье + 0,3 ширины плеч по предплечью (как в движке).
    let palm = null;
    if (vis(pose[idx.wr])) {
      const wr = toPx(pose[idx.wr]);
      const from = vis(pose[idx.el]) ? toPx(pose[idx.el]) : sh;
      const dx = wr.x - from.x, dy = wr.y - from.y, n = Math.hypot(dx, dy) || 1;
      palm = { x: wr.x + (dx / n) * 0.3 * S, y: wr.y + (dy / n) * 0.3 * S };
    }
    const hit = palm && bubbles.find((b) => Math.hypot(b.x - palm.x, b.y - palm.y) < b.r * 1.15);
    if ((hit?.id ?? null) !== hover) { hover = hit?.id ?? null; hoverSince = now; }
    const progress = hover && !chosen ? Math.min(1, (now - hoverSince) / HOLD_MS) : 0;
    if (progress >= 1) choose(hover);

    for (const b of bubbles) {
      const active = b.id === hover || b.id === chosen;
      const pulse = 1 + 0.04 * Math.sin(now / 300 + b.x);
      g.save();
      g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 16;
      g.fillStyle = active ? '#fff7df' : 'rgba(255,255,255,.9)';
      g.beginPath(); g.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2); g.fill();
      g.restore();
      if (active) {
        g.save();
        g.strokeStyle = '#2ea36e'; g.lineWidth = Math.max(6, b.r * 0.14); g.lineCap = 'round';
        g.beginPath(); g.arc(b.x, b.y, b.r * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.id === chosen ? 1 : progress)); g.stroke();
        g.restore();
      }
      // Эмодзи сверху, подпись внутри пузыря — подписи соседей не налезают друг на друга.
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${Math.round(b.r * 0.72)}px system-ui, sans-serif`;
      g.fillText(b.emoji, b.x, b.y - b.r * 0.2);
      let fs = Math.max(14, Math.round(b.r * 0.27));
      g.font = `800 ${fs}px Manrope, system-ui, sans-serif`;
      const tw = g.measureText(b.title).width;
      if (tw > b.r * 1.7) { fs = Math.max(12, Math.floor(fs * (b.r * 1.7) / tw)); g.font = `800 ${fs}px Manrope, system-ui, sans-serif`; }
      g.fillStyle = '#1d3a2c'; g.fillText(b.title, b.x, b.y + b.r * 0.5);
    }
    if (palm) {
      g.save();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.shadowColor = '#ffd76a'; g.shadowBlur = 18;
      g.beginPath(); g.arc(palm.x, palm.y, Math.max(8, S * 0.07), 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  return {
    el,
    wantsStatus: true,
    enter() {
      ctx.camera.mount(el.querySelector('.cam-slot'), { extra: draw });
      ctx.say('Ради чего вы занимаетесь? Дотянитесь рукой до своей цели и подержите', { hint: true });
      // ?mock=1: виртуальный пациент к пузырям не тянется — цель выбираем сами, чтобы сценарий шёл без рук (&manual — ждём клик).
      if (ctx.state.mock && !new URLSearchParams(location.search).has('manual')) mockTimer = setTimeout(() => { if (alive) choose(saved?.id ?? GOALS[0].id); }, 4000);
    },
    destroy() { alive = false; clearTimeout(mockTimer); },
  };
}
