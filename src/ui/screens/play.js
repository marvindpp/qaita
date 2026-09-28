// Экран 6 — Игра [E]. Видео + упрощённый скелет (плечи и рабочая рука) + пульсирующая ★ + пунктир «тянись сюда»
// + «тень-тренер» (полупрозрачная рука из плеча показывает путь, пока человек в покое) + огромная подсказка.
// Всё, что «знает о теле», приходит событиями движка; здесь только показ, звук, голос и очки по правилам игры.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createGame } from '../game.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO, TARGET_REPS, SESSION_PLAN } from '../exercises.js';
import { demoFigure } from '../demo-figure.js';

const IDX = { left: { sh: 11, el: 13, wr: 15, other: 12 }, right: { sh: 12, el: 14, wr: 16, other: 11 } };
// Цикл тени 6,5 с: 40% подъём (2,6 с), 25% держим, 35% опускаем — как src/engine/debug.js.
// Быстрее нельзя: тень показывала бы рывок, за который движок ругает «Слишком быстро».
const GHOST_MS = 6500;
const REP_MESSAGE_MS = 1100;
// Подсказки, которые движок снимает сам по таймеру, а не потому что человек исправился (src/engine/tracker.js).
const SELF_EXPIRING = new Set(['INCOMPLETE_ROM', 'TOO_FAST']);
const WORDS = ['Раз!', 'Два!', 'Три!', 'Четыре!', 'Пять!', 'Шесть!'];

const GOLD = '#f2b42a', GOLD_DEEP = '#d48f0f', RED = '#e0553f', GREEN = '#2ea36e';

const ease = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;
const vis = (p) => p && (p.visibility ?? 1) >= 0.5;

function starPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}

function label(g, text, x, y, size) {
  g.font = `800 ${size}px Manrope, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.28;
  g.strokeStyle = 'rgba(20, 28, 24, .72)';
  g.strokeText(text, x, y);
  g.fillStyle = '#fff';
  g.fillText(text, x, y);
}

export default function play(ctx, { index = 0 } = {}) {
  const id = SESSION_PLAN[index];
  const info = EXERCISE_INFO[id];
  const side = ctx.state.side ?? 'right';
  const idx = IDX[side];
  const game = createGame(id, TARGET_REPS);

  const el = html(`
    <section class="play" data-hint="go" aria-label="${info.title}">
      <aside class="hud hud-left">
        <p class="hud-ex">${info.title}</p>
        <p class="hud-count" aria-live="polite"><b>0</b><span>из ${TARGET_REPS}</span></p>
        <ol class="bed" aria-label="Грядка">${Array.from({ length: TARGET_REPS }, () => '<li class="plot"></li>').join('')}</ol>
        <div class="hud-demo" aria-hidden="true">${demoFigure(id, side)}</div>
      </aside>
      <div class="play-cam"><div class="cam-slot"></div><div class="flash" aria-hidden="true"></div></div>
      <aside class="hud hud-right">
        <p class="score"><span class="score-star">${icons.star}</span><b>0</b></p>
        <p class="combo" data-show="false">Комбо <b>×2</b></p>
        <ul class="legend">
          <li><span class="legend-ico">${icons.stop}</span>Две ладони — пауза</li>
          <li><span class="legend-ico">👍</span>Палец вверх — повторить</li>
        </ul>
      </aside>
      <div class="hint" role="status" aria-live="assertive">
        <span class="hint-ico"></span><p class="hint-text"></p><span class="hint-pts"></span>
      </div>
      <div class="pause" data-show="false" aria-hidden="true">
        <div class="pause-card">
          <h2>Пауза</h2>
          <p>Больно? Отдохните.<br>Не занимайтесь через боль.</p>
          <div class="pause-go"><div class="ring-slot"></div><div><p class="ring-label">Покажите ладонь</p><p class="ring-sub">чтобы продолжить</p></div></div>
        </div>
      </div>
    </section>`);

  const $ = (s) => el.querySelector(s);
  const countEl = $('.hud-count b');
  const scoreEl = $('.score b');
  const comboEl = $('.combo');
  const plots = [...el.querySelectorAll('.plot')];
  const hintIco = $('.hint-ico'), hintText = $('.hint-text'), hintPts = $('.hint-pts');
  const pauseEl = $('.pause');
  const flash = $('.flash');

  let target = null;          // { x, y, radius } — нормированные, radius в долях ширины кадра
  let mistake = null;         // текущая подсказка движка
  let paused = false, done = false, alive = true;
  let lastRepAt = -Infinity, hintTimer = null;
  let bursts = [];            // вспышки-звёздочки на повторе

  const resumeRing = createRing({ onFire: resume });
  $('.pause-go .ring-slot').replaceWith(resumeRing.el);

  // ——— подсказка внизу: одна мысль за раз ———
  function setHint(kind, text, pts = '') {
    el.dataset.hint = kind;
    hintIco.innerHTML = kind === 'mistake' ? icons.alert : kind === 'good' || kind === 'rep' ? icons.check : icons.star;
    if (hintText.dataset.text !== text) {
      hintText.dataset.text = text;
      // «Корпус влево на 5 см. Сядьте ровно!» → что не так / что сделать — отдельными строками; число с единицей не разрываем.
      hintText.replaceChildren(...text.replace(/(\d) (см|°)/g, '$1\u00a0$2').split(/(?<=[.!?])\s+/).map((part) => {
        const line = document.createElement('span');
        line.className = 'hint-line';
        line.textContent = part;
        return line;
      }));
      hintText.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }
    hintPts.textContent = pts;
  }
  const idleHint = () => setHint('go', info.phrase);
  function hintFor(ms, kind, text, pts) {
    clearTimeout(hintTimer);
    setHint(kind, text, pts);
    hintTimer = setTimeout(() => { if (!mistake && !done && !paused) idleHint(); }, ms);
  }

  function bump(node) {
    node.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  function floatPoints(text) {
    const f = html(`<span class="float-pts">${text}</span>`);
    $('.score').append(f);
    f.animate([{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, transform: 'translate(-50%, -18px)', offset: 0.25 }, { opacity: 0, transform: 'translate(-50%, -56px)' }],
      { duration: 1100, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).finished.then(() => f.remove(), () => f.remove());
  }

  function setScore() {
    scoreEl.textContent = String(game.score);
    bump(scoreEl);
    const m = game.multiplier;
    comboEl.dataset.show = String(m > 1);
    comboEl.querySelector('b').textContent = `×${m}`;
  }

  // ——— события движка ———
  function onTarget(t) {
    const moved = target && (Math.abs(t.x - target.x) > 0.005 || Math.abs(t.y - target.y) > 0.005);
    target = t;
    if (moved) ctx.sound.star();
  }

  function onMistake(m) {
    if (done) return;
    mistake = m;
    // «Не хватило N см» — про прошлую попытку: следующий повтор из-за неё не должен стать ростком.
    if (m.code !== 'INCOMPLETE_ROM') game.mistake();
    clearTimeout(hintTimer);
    setHint('mistake', m.message);
    ctx.sound.mistake();
    ctx.say(m.message, { interrupt: true, hint: true });
  }

  function onMistakeCleared() {
    if (!mistake || done) return;
    const expired = SELF_EXPIRING.has(mistake.code);
    mistake = null;
    // «Не хватило N см» и «Слишком быстро» гаснут сами по таймеру движка — это не исправление, +50 не даём.
    if (expired) { idleHint(); return; }
    const pts = game.cleared();
    setScore();
    floatPoints(`+${pts}`);
    hintFor(1600, 'good', 'Так правильно!', `+${pts}`);
    ctx.sound.fixed();
    ctx.say('Отлично, так правильно!', { interrupt: true });
  }

  function onRep(r) {
    if (r.exercise !== id || done) return;
    const res = game.rep(r);
    lastRepAt = performance.now();
    countEl.textContent = String(Math.min(r.count, TARGET_REPS));
    bump(countEl);
    const plot = plots[r.count - 1];
    if (plot) {
      plot.innerHTML = res.plant === 'flower' ? icons.flower : icons.sprout;
      plot.dataset.plant = res.plant;
      plot.firstElementChild.animate([{ transform: 'translateY(40%) scale(0.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
    setScore();
    floatPoints(`+${res.points}`);
    flash.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
    if (target) bursts.push({ t0: performance.now(), x: target.x, y: target.y });
    ctx.sound.rep();
    if (res.comboUp) {
      ctx.sound.combo(res.multiplier);
      comboEl.animate([{ transform: 'scale(1.35) rotate(-4deg)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
    if (!mistake) {
      const word = WORDS[r.count - 1] ?? 'Есть!';
      hintFor(REP_MESSAGE_MS, 'rep', res.comboUp ? `${word} Комбо ×${res.multiplier}!` : word, `+${res.points}`);
      ctx.say(word.replace('!', ''), { force: true });
    }
  }

  function onExerciseDone(d) {
    if (d.exercise !== id || done) return;
    done = true;
    mistake = null;
    clearTimeout(hintTimer);
    setHint('good', 'Упражнение готово!');
    ctx.sound.done();
    const result = game.result();
    ctx.state.session?.results.push(result);
    setTimeout(() => { if (alive) ctx.go('exercise-done', { index, result }); }, 1200);
  }

  // ——— пауза: две ладони; продолжить — ладонь ———
  function pause() {
    if (paused || done) return;
    paused = true;
    ctx.engine.pause();
    pauseEl.dataset.show = 'true';
    pauseEl.setAttribute('aria-hidden', 'false');
    resumeRing.reset();
    ctx.say('Пауза. Если больно — отдохните. Не занимайтесь через боль. Покажите ладонь, чтобы продолжить', { interrupt: true, force: true, hint: true });
  }
  function resume() {
    paused = false;
    ctx.engine.resume();
    pauseEl.dataset.show = 'false';
    pauseEl.setAttribute('aria-hidden', 'true');
    // Подсказку не сбрасываем: движок на паузе её помнит и не засчитает звезду, пока человек не исправится.
    // Сбросить её здесь = человек видит «Поднимите руку…», а звезда молча не берётся.
    if (mistake) setHint('mistake', mistake.message);
    else idleHint();
    ctx.say('Продолжаем', { interrupt: true, force: true });
  }

  // ——— рисование поверх видео ———
  function draw({ ctx: g, toPx, frame, w }) {
    const now = performance.now();
    const pose = frame?.pose;
    const unit = Math.max(8, w / 120);
    const sh = pose && vis(pose[idx.sh]) ? toPx(pose[idx.sh]) : null;
    const other = pose && vis(pose[idx.other]) ? toPx(pose[idx.other]) : null;
    const el_ = pose && vis(pose[idx.el]) ? toPx(pose[idx.el]) : null;
    const wr = pose && vis(pose[idx.wr]) ? toPx(pose[idx.wr]) : null;
    const S = sh && other ? Math.hypot(sh.x - other.x, sh.y - other.y) : w * 0.18;
    // Звезду «берёт» ладонь: запястье + продолжение предплечья (локоть→запястье) на 0,3 ширины плеч (как в движке).
    const from = el_ ?? sh;
    const palm = wr && from ? (() => {
      const dx = wr.x - from.x, dy = wr.y - from.y;
      const n = Math.hypot(dx, dy) || 1;
      return { x: wr.x + (dx / n) * 0.3 * S, y: wr.y + (dy / n) * 0.3 * S };
    })() : wr;
    const bad = new Set(mistake?.landmarks ?? []);
    const star = target ? { ...toPx(target), r: Math.max(26, target.radius * toPx(target).scale) } : null;

    // Тень-тренер: пока рука внизу и никто не ошибается — показываем путь «старт → звезда → держим → вниз».
    const armDown = sh && wr && wr.y - sh.y > 0.55 * S;
    const showGhost = star && sh && !paused && !done && !mistake && armDown && now - lastRepAt > 900;
    if (showGhost) drawGhost(g, now, sh, S, star, unit);

    // Пунктир от кисти к звезде: «тянись сюда». Точки бегут к звезде.
    if (star && palm && id !== 'open_hand' && !done) {
      const d = Math.hypot(star.x - palm.x, star.y - palm.y);
      if (d > star.r * 1.1) {
        const k = (d - star.r) / d;
        g.save();
        g.lineCap = 'round';
        g.setLineDash([0.1, unit * 2.2]);
        g.lineDashOffset = -(now / 28) % (unit * 2.2);
        g.lineWidth = unit * 0.9;
        g.strokeStyle = 'rgba(255,255,255,.92)';
        g.shadowColor = 'rgba(0,0,0,.35)';
        g.shadowBlur = 4;
        g.beginPath();
        g.moveTo(palm.x, palm.y);
        g.lineTo(palm.x + (star.x - palm.x) * k, palm.y + (star.y - palm.y) * k);
        g.stroke();
        g.restore();
      }
    }

    // Звезда: мягкое свечение + пульс. На паузе приглушена, после exercise-done не рисуется (движок уже молчит).
    if (star && !done) {
      const pulse = 1 + 0.07 * Math.sin(now / 320);
      const r = star.r * pulse;
      g.save();
      g.globalAlpha = paused ? 0.45 : 1;
      const glow = g.createRadialGradient(star.x, star.y, r * 0.2, star.x, star.y, r * 1.7);
      glow.addColorStop(0, 'rgba(255, 214, 102, .55)');
      glow.addColorStop(1, 'rgba(255, 214, 102, 0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(star.x, star.y, r * 1.7, 0, Math.PI * 2);
      g.fill();
      starPath(g, star.x, star.y, r);
      const fill = g.createLinearGradient(star.x, star.y - r, star.x, star.y + r);
      fill.addColorStop(0, '#ffd666');
      fill.addColorStop(1, GOLD);
      g.fillStyle = fill;
      g.fill();
      g.lineJoin = 'round';
      g.lineWidth = Math.max(3, unit * 0.45);
      g.strokeStyle = '#fff';
      g.stroke();
      g.restore();
    }

    // Упрощённый скелет: линия плеч + рабочая рука. Точки ошибки — красные и пульсируют.
    if (sh && other) {
      const seg = (a, b, ia, ib) => {
        if (!a || !b) return;
        const red = bad.has(ia) && bad.has(ib);
        g.strokeStyle = 'rgba(20,28,24,.35)';
        g.lineWidth = unit * 1.6;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.strokeStyle = red ? RED : '#fff';
        g.lineWidth = unit;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      };
      g.save();
      g.lineCap = 'round';
      seg(other, sh, idx.other, idx.sh);
      seg(sh, el_, idx.sh, idx.el);
      seg(el_, wr, idx.el, idx.wr);
      seg(wr, palm, idx.wr, idx.wr);
      for (const [p, i] of [[other, idx.other], [sh, idx.sh], [el_, idx.el], [palm, idx.wr]]) {
        if (!p) continue;
        g.beginPath();
        g.arc(p.x, p.y, unit * 0.95, 0, Math.PI * 2);
        g.fillStyle = bad.has(i) ? RED : '#fff';
        g.fill();
        g.lineWidth = unit * 0.4;
        g.strokeStyle = bad.has(i) ? '#fff' : GREEN;
        g.stroke();
      }
      g.restore();
    }
    if (pose && bad.size) {
      const pr = unit * (2.4 + 0.5 * Math.sin(now / 160));
      g.save();
      for (const i of bad) {
        if (!vis(pose[i])) continue;
        const p = toPx(pose[i]);
        g.beginPath();
        g.arc(p.x, p.y, pr, 0, Math.PI * 2);
        g.fillStyle = 'rgba(224, 85, 63, .22)';
        g.fill();
        g.lineWidth = unit * 0.55;
        g.strokeStyle = RED;
        g.stroke();
      }
      g.restore();
    }

    // Вспышка звёздочек на повторе.
    bursts = bursts.filter((b) => now - b.t0 < 700);
    for (const b of bursts) {
      const k = (now - b.t0) / 700;
      const c = toPx(b);
      g.save();
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const d = ease(k) * unit * 11;
        starPath(g, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, unit * (1.3 - k * 0.6));
        g.fillStyle = i % 2 ? GOLD : GREEN;
        g.fill();
      }
      g.restore();
    }
  }

  function drawGhost(g, now, sh, S, star, unit) {
    const cyc = (now % GHOST_MS) / GHOST_MS;
    const k = cyc < 0.4 ? ease(cyc / 0.4) : cyc < 0.65 ? 1 : 1 - ease((cyc - 0.65) / 0.35);
    const text = cyc < 0.4 ? 'Медленно…' : cyc < 0.65 ? 'Держим' : 'Опускаем';
    const fontSize = Math.max(22, unit * 3.2);
    if (id === 'open_hand') {
      g.save();
      g.font = `${Math.round(star.r * 1.4)}px system-ui`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = 0.95;
      g.fillText(k > 0.5 ? '🖐' : '✊', star.x, star.y);
      g.restore();
      label(g, k > 0.5 ? 'Раскройте' : 'Сожмите', star.x, star.y - star.r * 1.6, fontSize);
      return;
    }
    // Прямая рука поворачивается вокруг плеча от «висит вниз» к звезде; длина — до звезды.
    const out = side === 'left' ? -1 : 1;
    const R = Math.hypot(star.x - sh.x, star.y - sh.y);
    const a0 = Math.atan2(1, 0.12 * out);
    const a1 = Math.atan2(star.y - sh.y, star.x - sh.x);
    let dA = a1 - a0;
    if (dA > Math.PI) dA -= 2 * Math.PI;
    if (dA < -Math.PI) dA += 2 * Math.PI;
    const a = a0 + dA * k;
    const hand = { x: sh.x + Math.cos(a) * R, y: sh.y + Math.sin(a) * R };
    const rest = { x: sh.x + Math.cos(a0) * R, y: sh.y + Math.sin(a0) * R };
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = S * 0.26;
    g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(hand.x, hand.y); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.72)';
    g.beginPath(); g.arc(hand.x, hand.y, S * 0.17, 0, Math.PI * 2); g.fill();
    g.setLineDash([unit, unit]);
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.lineWidth = Math.max(2, unit * 0.35);
    g.beginPath(); g.arc(rest.x, rest.y, S * 0.2, 0, Math.PI * 2); g.stroke();
    g.restore();
    label(g, text, hand.x, hand.y - S * 0.42, fontSize);
  }

  return {
    el,
    wantsStatus: true,
    enter() {
      ctx.camera.mount(el.querySelector('.cam-slot'), { extra: draw });
      idleHint();
      try {
        ctx.engine.setExercise(id, { targetReps: TARGET_REPS });
      } catch (err) {
        console.warn(err);
        // Упражнение ещё не реализовано в движке — тихо идём дальше по плану.
        setTimeout(() => { if (alive) ctx.go(index + 1 < SESSION_PLAN.length ? 'demo' : 'garden', { index: index + 1 }); }, 0);
      }
    },
    onTarget,
    onMistake,
    onMistakeCleared,
    onRep,
    onExerciseDone,
    onGesture(g) {
      if (g.type === 'PAUSE' && g.fired && !paused) { pause(); return true; }
      if (paused) return resumeRing.handle(g);
      return false;
    },
    destroy() { alive = false; clearTimeout(hintTimer); resumeRing.destroy(); },
  };
}
