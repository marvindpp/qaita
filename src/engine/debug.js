// Debug-оверлей движка (?debug=1): скелет, руки, FPS, сырые метрики. Для настройки порогов, не для пользователя.
const POSE_EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [0, 7], [0, 8], [7, 11], [8, 12]];
const HAND_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

// Цикл: 40% подъём (2,6 с), 25% держим, 35% опускаем. Тень сама двигается МЕДЛЕННО — иначе она показывает
// рывок, за который движок ругает «Слишком быстро» (живой тест 28.09: подъём был 1,3 с).
const GHOST_MS = 6500;
import { createSparkles, drawYesterday } from './fx.js';

function drawGhost(ctx, pose, side, target, ex, w, h) {
  const sh = pose[side === 'left' ? 11 : 12];
  const other = pose[side === 'left' ? 12 : 11];
  if (!sh || sh.visibility < 0.5) return;
  const dpr = devicePixelRatio;
  const S = Math.abs(sh.x - other.x); // ширина плеч в долях ширины кадра
  const out = side === 'left' ? -1 : 1;
  const rest = { x: sh.x + 0.12 * S * out, y: sh.y + 1.05 * S * (w / h) }; // рука висит вниз
  const cyc = (performance.now() % GHOST_MS) / GHOST_MS;
  const k = cyc < 0.4 ? ease(cyc / 0.4) : cyc < 0.65 ? 1 : 1 - ease((cyc - 0.65) / 0.35);

  if (ex === 'open_hand') { // кисть: кулак ↔ ладонь у цели
    ctx.font = `${Math.round(w / 9)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText(k > 0.5 ? '🖐' : '✊', target.x * w, target.y * h);
    ctx.globalAlpha = 1; ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    label(ctx, k > 0.5 ? 'Раскройте' : 'Сожмите', target.x * w, (target.y - 0.14) * h, w);
    return;
  }
  // ПРЯМАЯ рука: поворачивается вокруг плеча от «вниз» к звезде, длина постоянная (как у звезды).
  const toPx = (p) => ({ x: p.x * w, y: p.y * h });
  const s = toPx(sh), a0 = toPx(rest), a1 = toPx(target);
  const ang0 = Math.atan2(a0.y - s.y, a0.x - s.x), ang1 = Math.atan2(a1.y - s.y, a1.x - s.x);
  let dAng = ang1 - ang0;
  if (dAng > Math.PI) dAng -= 2 * Math.PI;
  if (dAng < -Math.PI) dAng += 2 * Math.PI;
  const R = Math.hypot(a1.x - s.x, a1.y - s.y);
  const ang = ang0 + dAng * k;
  const hand = { x: (s.x + Math.cos(ang) * R) / w, y: (s.y + Math.sin(ang) * R) / h };
  const elbow = { x: (sh.x + hand.x) / 2, y: (sh.y + hand.y) / 2 };
  rest.x = (s.x + Math.cos(ang0) * R) / w; rest.y = (s.y + Math.sin(ang0) * R) / h;

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = S * w * 0.28;
  ctx.beginPath(); ctx.moveTo(sh.x * w, sh.y * h); ctx.lineTo(elbow.x * w, elbow.y * h); ctx.lineTo(hand.x * w, hand.y * h); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath(); ctx.arc(hand.x * w, hand.y * h, S * w * 0.2, 0, Math.PI * 2); ctx.fill();
  // «Старт»: где рука начинает движение.
  ctx.setLineDash([8 * dpr, 8 * dpr]);
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3 * dpr;
  ctx.beginPath(); ctx.arc(rest.x * w, rest.y * h, S * w * 0.22, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  label(ctx, cyc < 0.4 ? 'Медленно вверх…' : cyc < 0.65 ? 'Держим' : 'Опускаем', hand.x * w, hand.y * h - S * w * 0.35, w);
}
const ease = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;
function label(ctx, text, x, y, w) {
  ctx.font = `700 ${Math.round(w / 26)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff'; ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}

export function createDebugOverlay(video, { showNumbers = false } = {}) {
  const canvas = document.createElement('canvas');
  const panel = document.createElement('pre');
  Object.assign(canvas.style, { position: 'fixed', pointerEvents: 'none', zIndex: 9998 });
  Object.assign(panel.style, {
    position: 'fixed', left: '8px', bottom: '8px', margin: 0, padding: '8px 10px', zIndex: 9999,
    font: '13px/1.35 ui-monospace, monospace', background: 'rgba(0,0,0,.75)', color: '#9ff5c9',
    borderRadius: '8px', maxWidth: '46vw', whiteSpace: 'pre-wrap', pointerEvents: 'none',
  });
  document.body.append(canvas);
  if (showNumbers) document.body.append(panel);
  const ctx = canvas.getContext('2d');

  const line = (a, b, w, h) => { ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); };
  // Чистый вид (debug=1): только своё видео, рабочая рука тонко, ладонь, звезда, искры, «вы вчера».
  // Технический вид (debug=2): весь скелет, кисти, номера точек, цифры.
  const clean = !showNumbers;
  const fx = createSparkles();
  let yesterday = null, yesterdayLabel = 'Вы вчера';
  let lastStarPx = null, lastPalmPx = null;

  return {
    /** Путь лучшего повтора (bestRep из итогов) — его проходит тень «вы вчера». */
    setYesterday(rep, label = 'Вы вчера') { yesterday = rep; yesterdayLabel = label; },
    /** На засчитанный повтор — взрыв искр у звезды. */
    onRep({ quality }) { const p = lastStarPx ?? lastPalmPx; if (p) fx.burst(p.x, p.y, performance.now(), quality >= 0.9); },
    draw({ pose, hands, fps, delegate, info = {}, target, framing, side = 'right', showGuide = false }) {
      const r = video.getBoundingClientRect();
      Object.assign(canvas.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      canvas.width = r.width * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 3 * devicePixelRatio;
      const now = performance.now();
      const I = side === 'left' ? { sh: 11, el: 13, wr: 15, o: 12 } : { sh: 12, el: 14, wr: 16, o: 11 };
      const V = (i) => pose?.[i] && pose[i].visibility > 0.5;
      const Spx = pose && V(I.sh) && V(I.o) ? Math.hypot((pose[I.sh].x - pose[I.o].x) * w, (pose[I.sh].y - pose[I.o].y) * h) : 0;
      // Ладонь = запястье + 0,3 ширины плеч по предплечью (как в движке, body.js HAND_EXT).
      lastPalmPx = null;
      if (V(I.wr)) {
        const wr = { x: pose[I.wr].x * w, y: pose[I.wr].y * h };
        const from = V(I.el) ? { x: pose[I.el].x * w, y: pose[I.el].y * h } : { x: pose[I.sh].x * w, y: pose[I.sh].y * h };
        const dx = wr.x - from.x, dy = wr.y - from.y, n = Math.hypot(dx, dy) || 1;
        lastPalmPx = { x: wr.x + (dx / n) * 0.3 * Spx, y: wr.y + (dy / n) * 0.3 * Spx };
      }
      if (pose && clean) {
        // Рабочая рука — одна мягкая линия, без точек и номеров.
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(4, Spx * 0.06);
        const arm = [I.sh, I.el, I.wr].filter(V).map((i) => ({ x: pose[i].x * w, y: pose[i].y * h }));
        if (lastPalmPx) arm.push(lastPalmPx);
        ctx.beginPath(); arm.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        ctx.restore();
      }
      if (pose && !clean) {
        ctx.strokeStyle = '#46c38b';
        for (const [a, b] of POSE_EDGES) if (pose[a].visibility > 0.5 && pose[b].visibility > 0.5) line(pose[a], pose[b], w, h);
        ctx.fillStyle = '#ffffff';
        pose.forEach((p, i) => {
          if (p.visibility < 0.5) return;
          ctx.fillRect(p.x * w - 3, p.y * h - 3, 6, 6);
          if ([0, 7, 8, 11, 12, 13, 14, 15, 16].includes(i)) ctx.fillText(String(i), p.x * w + 6, p.y * h - 6);
        });
      }
      // Силуэт-трафарет «куда сесть»: голова по центру сверху, плечи ниже, место над головой для руки.
      if (showGuide) {
        const ok = framing?.ok;
        ctx.save();
        ctx.setLineDash([14 * devicePixelRatio, 10 * devicePixelRatio]);
        ctx.lineWidth = 5 * devicePixelRatio;
        ctx.strokeStyle = ok ? '#46c38b' : 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.ellipse(0.5 * w, 0.42 * h, 0.075 * w, 0.13 * h, 0, 0, Math.PI * 2); // голова
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.3 * w, 0.98 * h);
        ctx.quadraticCurveTo(0.3 * w, 0.64 * h, 0.44 * w, 0.6 * h); // левое плечо
        ctx.moveTo(0.7 * w, 0.98 * h);
        ctx.quadraticCurveTo(0.7 * w, 0.64 * h, 0.56 * w, 0.6 * h); // правое плечо
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = ok ? '#46c38b' : '#fff';
        ctx.font = `700 ${Math.round(w / 16)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(ok ? 'На месте ✓' : 'Сядьте в пунктир', 0.5 * w, 0.1 * h);
        ctx.textAlign = 'start';
      }
      // «Тень-тренер»: полупрозрачная рука растёт из ТВОЕГО плеча и показывает путь старт → звезда → назад.
      // Видна, пока человек в покое; как только сам пошёл — исчезает (не мешает).
      if (target && pose && info.phase === 'REST') {
        if (yesterday && Spx && info.ex !== 'open_hand') drawYesterday(ctx, yesterday, now, { shoulder: { x: pose[I.sh].x * w, y: pose[I.sh].y * h }, S: Spx, outSign: side === 'left' ? -1 : 1 }, yesterdayLabel);
        else drawGhost(ctx, pose, side, target, info.ex, w, h);
      }
      if (target && lastPalmPx && info.phase === 'REACHING') fx.trail(lastPalmPx.x, lastPalmPx.y, now);
      lastStarPx = target ? { x: target.x * w, y: target.y * h } : null;
      if (target && clean) {
        // Звезда: мягкое свечение + золотая звезда, круг не рисуем (лишняя линия).
        const cx = target.x * w, cy = target.y * h, R = target.radius * w;
        const pulse = 1 + 0.08 * Math.sin(now / 220);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3 * pulse);
        glow.addColorStop(0, 'rgba(255,220,120,.55)'); glow.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.fillStyle = '#f2b42a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * devicePixelRatio;
        ctx.beginPath();
        for (let i = 0; i < 10; i += 1) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = (i % 2 ? 0.26 : 0.6) * R * pulse; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (lastPalmPx && clean && target) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 18 * devicePixelRatio;
        ctx.beginPath(); ctx.arc(lastPalmPx.x, lastPalmPx.y, Math.max(8, Spx * 0.07), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      fx.draw(ctx, now);
      if (target && !clean) {
        // Пунктир от кисти рабочей руки к звезде — «тянись сюда».
        const wr0 = pose?.[side === 'left' ? 15 : 16], el = pose?.[side === 'left' ? 13 : 14];
        const shp = pose?.[side === 'left' ? 11 : 12], osh = pose?.[side === 'left' ? 12 : 11];
        // Точка — середина ЛАДОНИ (как в движке: запястье + 0,3 ширины плеч по предплечью): ей и «берём» звезду.
        let wr = wr0;
        if (wr0 && el && shp && osh && el.visibility > 0.5) {
          const dx = (wr0.x - el.x) * w, dy = (wr0.y - el.y) * h, n = Math.hypot(dx, dy) || 1;
          const S = Math.hypot((shp.x - osh.x) * w, (shp.y - osh.y) * h);
          wr = { x: wr0.x + (dx / n) * 0.3 * S / w, y: wr0.y + (dy / n) * 0.3 * S / h, visibility: wr0.visibility };
        }
        if (wr && wr.visibility > 0.5) {
          ctx.save();
          ctx.setLineDash([10 * devicePixelRatio, 10 * devicePixelRatio]);
          ctx.strokeStyle = 'rgba(255,212,0,.9)';
          ctx.lineWidth = 4 * devicePixelRatio;
          ctx.beginPath(); ctx.moveTo(wr.x * w, wr.y * h); ctx.lineTo(target.x * w, target.y * h); ctx.stroke();
          ctx.restore();
          ctx.fillStyle = '#ffd400';
          ctx.beginPath(); ctx.arc(wr.x * w, wr.y * h, 12 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
        }
        const pulse = 1 + 0.12 * Math.sin(performance.now() / 180);
        ctx.font = `${56 * pulse * devicePixelRatio}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd400';
        ctx.fillText('★', target.x * w, target.y * h);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = '#ffd400';
        ctx.lineWidth = 4 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(target.x * w, target.y * h, target.radius * w, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.strokeStyle = '#ffb347';
      if (!clean) for (const hand of hands ?? []) for (const [a, b] of HAND_EDGES) line(hand[a], hand[b], w, h);
      const rows = [`FPS ${fps}  ${delegate}`, `pose ${pose ? 'yes' : 'no'}  hands ${hands?.length ?? 0}`];
      for (const [k, v] of Object.entries(info)) rows.push(`${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`);
      panel.textContent = rows.join('\n');
    },
  };
}

// Сценарий для проверки движка без UI: ?debug=1&auto=1 (это НЕ интерфейс продукта — его делает Ерсултан).
// Запись сессии (?rec=1): точки скелета + шаги сценария → JSON-файл. Потом `node tests/replay.mjs файл.json`
// прогоняет его через движок без камеры — Claude тестирует изменения на реальных движениях сам.
const r3 = (v) => Math.round(v * 1000) / 1000;
export function createRecorder(video) {
  const frames = [], marks = [];
  return {
    frame(t, pose, hands) {
      frames.push([Math.round(t), pose ? pose.slice(0, 17).map((p) => [r3(p.x), r3(p.y), r3(p.visibility)]) : null, hands.map((h) => h.map((p) => [r3(p.x), r3(p.y)]))]);
    },
    mark(t, type, data = {}) { marks.push({ t: Math.round(t), type, ...data }); },
    download() {
      const blob = new Blob([JSON.stringify({ v: 1, aspect: video.videoWidth / video.videoHeight, marks, frames })], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qaita-rec-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      a.click();
    },
  };
}

export function runDebugScenario(engine, bus, overlay, params, recorder = null) {
  const mark = (type, data) => recorder?.mark(performance.now(), type, data);
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
    padding: '16px 26px', borderRadius: '16px', background: 'rgba(0,0,0,.85)', color: '#fff',
    font: '700 clamp(28px, 5vw, 56px)/1.2 system-ui', maxWidth: '92vw', textAlign: 'center',
  });
  const ring = document.createElement('div');
  Object.assign(ring.style, { font: '600 clamp(22px, 3.5vw, 40px)/1.2 system-ui', color: '#ffd400', marginTop: '8px' });
  banner.append(document.createElement('span'), ring);
  document.body.append(banner);
  const say = (text, color = '#fff') => { banner.firstChild.textContent = text; banner.style.color = color; };

  let lastStatus = 'OK';
  let waiting = null; // { types:Set, resolve }
  const waitGesture = (types, hint) => new Promise((resolve) => { waiting = { types: new Set(types), resolve }; ring.textContent = hint; });

  bus.on('status', ({ code, message }) => { lastStatus = code; if (code !== 'OK') say(message, '#ffb3b3'); });
  bus.on('gesture', ({ type, progress, fired }) => {
    if (!waiting || !waiting.types.has(type)) return;
    ring.textContent = fired ? '✓' : `${'●'.repeat(Math.round(progress * 10))}${'○'.repeat(10 - Math.round(progress * 10))}`;
    if (fired) { const w = waiting; waiting = null; setTimeout(() => w.resolve(type), 300); }
  });
  bus.on('calibration', ({ message }) => say(message));
  bus.on('mistake', ({ message }) => say(message, '#ff8a80'));
  bus.on('mistake-cleared', () => say('Отлично! ✓', '#9ff5c9'));
  bus.on('rep', (p) => {
    say(`${p.quality >= 0.9 ? '🌸' : '🌱'} ${p.count} из ${p.targetReps}`, '#9ff5c9');
    overlay.onRep?.(p);
    // Вчерашнего пути нет — тенью становится ваш лучший повтор сегодня (сразу видно, как это работает).
    if (!yesterdayOf(currentId)) {
      const best = engine.getSummary().exercises.find((e) => e.id === currentId)?.bestRep;
      if (best) overlay.setYesterday?.(best, 'Ваш лучший');
    }
  });

  // «Вы вчера»: лучший повтор каждого упражнения храним в браузере (только путь ладони, без видео).
  const KEY = 'qaita-debug-best';
  const loadBest = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
  const yesterdayOf = (id) => loadBest()[id] ?? null; // путь в «наружу/вверх» — подходит для любой руки
  const saveBest = (id, rep) => { try { const all = loadBest(); all[id] = rep; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* приватный режим */ } };
  let currentId = null;

  // «До / после»: две карточки со стоп-кадрами после упражнения.
  const cards = document.createElement('div');
  Object.assign(cards.style, { position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)', zIndex: 10000, display: 'none', gap: '16px', padding: '14px', borderRadius: '18px', background: 'rgba(0,0,0,.8)' });
  document.body.append(cards);
  const card = (img, title, color) => `<figure style="margin:0;text-align:center;color:${color};font:700 clamp(16px,2.2vw,26px)/1.2 system-ui"><img src="${img}" style="display:block;width:min(38vw,360px);border-radius:12px;border:4px solid ${color}"><figcaption style="margin-top:8px">${title}</figcaption></figure>`;
  function showMoments(id) {
    const mo = engine.getSummary().exercises.find((e) => e.id === id)?.moments ?? {};
    const parts = [];
    if (mo.mistake?.image) parts.push(card(mo.mistake.image, `✗ ${mo.mistake.message.split('.')[0]}`, '#ff8a80'));
    if (mo.good?.image) parts.push(card(mo.good.image, '✓ Так правильно!', '#9ff5c9'));
    cards.innerHTML = parts.join('');
    cards.style.display = parts.length ? 'flex' : 'none';
  }

  const NAMES = { reach_up: 'Рукой вверх до ★', reach_side: 'Рукой в сторону до ★', hand_to_mouth: 'Кисть ко рту, как чашку', reach_across: 'Рукой к другому плечу', open_hand: 'Кулак → раскрыть ладонь' };
  (async () => {
    say('✋ Покажите ладонь');
    await waitGesture(['PALM_HOLD'], '○○○○○○○○○○');
    say('Поднимите руку для тренировки');
    const raised = await waitGesture(['RAISE_LEFT', 'RAISE_RIGHT'], '○○○○○○○○○○');
    engine.setSide(raised === 'RAISE_LEFT' ? 'left' : 'right');
    mark('side', { side: raised === 'RAISE_LEFT' ? 'left' : 'right' });
    ring.textContent = '';
    say('Опустите руку');
    await new Promise((r) => setTimeout(r, 1500));
    mark('calibrate');
    const base = await engine.calibrate();
    mark('calibrated');
    console.log('[qaita] baseline', base);
    const list = (params.get('ex') ?? 'reach_up,reach_side,hand_to_mouth,reach_across,open_hand').split(',');
    for (const id of list) {
      say(`${NAMES[id]} · ✋ готов?`);
      await waitGesture(['PALM_HOLD'], '○○○○○○○○○○');
      ring.textContent = '✋✋ = пауза';
      cards.style.display = 'none';
      currentId = id;
      const y = yesterdayOf(id);
      overlay.setYesterday?.(y, 'Вы вчера');
      engine.setExercise(id, { targetReps: Number(params.get('reps')) || 3 });
      mark('exercise', { id, targetReps: Number(params.get('reps')) || 3 });
      say(`${NAMES[id]} · повторяйте за тенью`);
      await new Promise((r) => { const off = bus.on('exercise-done', () => { off(); r(); }); });
      say('★★★ Готово!', '#9ff5c9');
      const best = engine.getSummary().exercises.find((e) => e.id === id)?.bestRep;
      if (best) saveBest(id, best);
      showMoments(id);
      await new Promise((r) => setTimeout(r, 1500));
    }
    const s = engine.getSummary();
    console.log('[qaita] summary', s);
    if (recorder) { recorder.download(); say('🌸 Готово! Файл записи скачан — отправь его Claude', '#9ff5c9'); return; }
    say(`🌸 Повторов: ${s.totalReps} · исправлено: ${s.mistakesCorrected}`, '#9ff5c9');
    ring.textContent = '';
  })();
}
