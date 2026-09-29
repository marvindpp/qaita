// Экран «Ради чего?» — цель из жизни (PLAN §9г). Выбор без мыши: ДОТЯНУТЬСЯ ладонью до пузыря с целью
// и подержать 1,2 с — это уже первое движение тренировки. Для родственника рядом — те же цели кнопками.
import { html, esc } from '../dom.js';
import { GOALS, loadGoal, saveGoal } from '../life.js';
import { setPlanForGoal, GOAL_PLANS, EXERCISE_INFO } from '../exercises.js';

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
  // Зеркальная тренировка: camera.js переносит точки на сторону больной руки — пузыри тоже должны быть снаружи от неё.
  const outSign = (side === 'left' ? -1 : 1) * (ctx.state.mirror ? -1 : 1);
  let hover = null, hoverSince = 0, chosen = null, alive = true;
  let bubbles = [];
  let mockTimer = null;

  function choose(id) {
    if (chosen) return;
    chosen = id;
    saveGoal(id);
    ctx.state.goal = id;
    setPlanForGoal(id);
    const g = GOALS.find((x) => x.id === id);
    ctx.sound.confirm();
    ctx.say(`Отлично. Цель — ${g.short}. Для неё — ${GOAL_PLANS[id].length} упражнения: ${GOAL_PLANS[id].map(([e]) => EXERCISE_INFO[e].title).join(', ')}`, { interrupt: true, force: true });
    setTimeout(() => { if (alive) ctx.go('calibration'); }, 2600);
  }
  el.querySelectorAll('.goal-btn').forEach((b) => b.addEventListener('click', () => choose(b.dataset.id)));

  function draw({ ctx: g, toPx, frame, w, h }) {
    const pose = frame?.pose;
    const now = performance.now();
    if (!pose || !vis(pose[idx.sh]) || !vis(pose[idx.other])) return;
    const sh = toPx(pose[idx.sh]), other = toPx(pose[idx.other]);
    const S = Math.hypot(sh.x - other.x, sh.y - other.y);
    // Пузыри — дугой вокруг плеча рабочей руки: от «в сторону» до «вверх». Угол от «рука вниз» (0°) к «вверх» (180°).
    // Радиус дуги общий: вытянутая рука (1,75 ширины плеч), но не дальше края кадра ни для одного пузыря.
    // Раньше каждый пузырь прижимался к краю отдельно — и они налезали друг на друга (29.09).
    const angles = [62, 101, 140, 179].map((d) => (d * Math.PI) / 180);
    let r = Math.max(52, S * 0.52);
    const reachTo = (a) => {
      const dx = Math.sin(a) * outSign, dy = Math.cos(a);
      const lim = (d, pos, size) => (d > 0.01 ? (size - r - 6 - pos) / d : d < -0.01 ? (pos - r - 6) / -d : Infinity);
      return Math.min(lim(dx, sh.x, w), lim(dy, sh.y, h));
    };
    const R = Math.max(r * 1.6, Math.min(S * 1.75, ...angles.map(reachTo)));
    // Соседние пузыри на дуге не должны касаться (с учётом «дыхания» +4%): хорда между ними ≥ 2,3 радиуса.
    r = Math.min(r, (2 * R * Math.sin((angles[1] - angles[0]) / 2)) / 2.3);
    bubbles = GOALS.map((goalItem, i) => {
      const a = angles[i];
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
      // Маленький пузырь (телефон) — только значок: подпись не влезет, названия есть на кнопках под видео.
      if (b.r < 46) {
        g.font = `${Math.round(b.r * 1.05)}px system-ui, sans-serif`;
        g.fillText(b.emoji, b.x, b.y + b.r * 0.04);
        continue;
      }
      g.font = `${Math.round(b.r * 0.72)}px system-ui, sans-serif`;
      g.fillText(b.emoji, b.x, b.y - b.r * 0.2);
      let fs = Math.max(16, Math.round(b.r * 0.3));
      g.font = `800 ${fs}px Manrope, system-ui, sans-serif`;
      const tw = g.measureText(b.title).width;
      if (tw > b.r * 1.8) { fs = Math.max(14, Math.floor(fs * (b.r * 1.8) / tw)); g.font = `800 ${fs}px Manrope, system-ui, sans-serif`; }
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
