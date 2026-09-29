// Экран 6 — Игра [E]. Видео + тонкие линии (плечи и рабочая рука) + пульсирующая ★ + пунктир «тянись сюда» от ЛАДОНИ
// + искры за ладонью и взрыв звезды на повторе (engine/fx.js) + пока человек в покое — тень «Вы вчера»
// (путь лучшего повтора из истории) или, если истории нет, «тень-тренер» + огромная подсказка.
// Всё, что «знает о теле», приходит событиями движка; здесь только показ, звук, голос и очки по правилам игры.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createGame } from '../game.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO, TARGET_REPS, SESSION_PLAN } from '../exercises.js';
import { demoFigure } from '../demo-figure.js';
import { bestRepFor, bestRepLabel, saveBestRep, loadSessions } from '../storage.js';
import { createSparkles, drawYesterday } from '../../engine/fx.js';

const IDX = { left: { sh: 11, el: 13, wr: 15, other: 12 }, right: { sh: 12, el: 14, wr: 16, other: 11 } };
const GHOST_MS = 6500;      // цикл тени: вверх 40% → держим 25% → вниз 35%. Медленно — иначе тень сама «делает рывок» (engine/debug.js)
const HAND_EXT = 0.3;       // ладонь = запястье + 0,3 ширины плеч по предплечью (как engine/body.js)
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

  let demoLift = null;        // угол руки человечка-подсказки (под звезду этого человека)
  let target = null;          // { x, y, radius } — нормированные, radius в долях ширины кадра
  let mistake = null;         // текущая подсказка движка
  let paused = false, done = false, alive = true;
  let lastRepAt = -Infinity, hintTimer = null;
  let splashes = 0;           // сколько раз плеснуть водой из чашки (hand_to_mouth + рывок/наклон)
  let lastPalm = null;
  let bursts = [];            // взрывы звезды на повторе: { x, y, clean } — нормированные, рисуем в draw()
  const fx = createSparkles();
  // «Вы вчера»: путь ладони лучшего повтора из истории. Нет истории — возьмём лучший сегодняшний после чистого повтора.
  let yesterday = id === 'open_hand' ? null : bestRepFor(id);
  let yesterdayLabel = bestRepLabel(yesterday);
  const fromHistory = Boolean(yesterday);
  // «Новый рекорд!»: лучший угол этого упражнения за все прошлые занятия. Побил на 3°+ — отдельный праздник (один раз).
  const prevBest = id === 'open_hand' ? 0 : Math.max(0, ...loadSessions().flatMap((s) => (s.exercises ?? []).filter((e) => e.id === id).map((e) => e.bestRomDeg ?? 0)));
  let recordShown = false;

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
    if (id === 'hand_to_mouth' && ['TOO_FAST', 'TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE'].includes(m.code)) splashes += 1;
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
    if (target) bursts.push({ x: target.x, y: target.y, clean: res.clean });
    if (!fromHistory && res.clean && id !== 'open_hand') {
      const best = todayBest();
      if (best) { yesterday = best; yesterdayLabel = 'Ваш лучший'; }
    }
    ctx.sound.rep();
    if (res.comboUp) {
      ctx.sound.combo(res.multiplier);
      comboEl.animate([{ transform: 'scale(1.35) rotate(-4deg)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
    if (prevBest && !recordShown && r.romDeg >= prevBest + 3) {
      recordShown = true;
      if (target) bursts.push({ x: target.x, y: target.y, clean: true });
      ctx.sound.done();
      hintFor(2600, 'rep', 'Новый рекорд! Выше, чем раньше', `+${res.points}`);
      ctx.say('Новый рекорд! Рука поднялась выше, чем раньше', { interrupt: true, force: true });
      return;
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
    const best = todayBest();
    if (best && id !== 'open_hand') saveBestRep(id, best); // только путь (числа) — картинки остаются в памяти
    const moments = summaryOf()?.moments;                 // стоп-кадры «до/после» → на экран итогов
    setTimeout(() => { if (alive) ctx.go('exercise-done', { index, result, moments }); }, 1200);
  }

  // Необязательные поля итогов движка (CONTRACT.md): мок или старый движок может их не отдавать.
  function summaryOf() {
    try { return ctx.engine.getSummary()?.exercises?.find((e) => e.id === id) ?? null; } catch { return null; }
  }
  function todayBest() {
    const b = summaryOf()?.bestRep;
    return b?.pts?.length && b.ms > 0 ? b : null;
  }

  // ——— пауза: две ладони; продолжить — ладонь ———
  function pause(tired = false) {
    if (paused || done) return;
    paused = true;
    ctx.engine.pause();
    pauseEl.dataset.show = 'true';
    pauseEl.setAttribute('aria-hidden', 'false');
    pauseEl.querySelector('h2').textContent = tired ? 'Отдохните' : 'Пауза';
    pauseEl.querySelector('.pause-card > p').innerHTML = tired ? 'Рука устала — это нормально.<br>Опустите её и подышите.' : 'Больно? Отдохните.<br>Не занимайтесь через боль.';
    resumeRing.reset();
    ctx.say(tired
      ? 'Похоже, рука устала. Это нормально. Опустите руку и отдохните. Покажите ладонь, когда будете готовы'
      : 'Пауза. Если больно — отдохните. Не занимайтесь через боль. Покажите ладонь, чтобы продолжить', { interrupt: true, force: true, hint: true });
  }
  // Движок заметил усталость (компенсации подряд или долгая попытка) — сам ставим паузу «Отдохните».
  function onRest(r) {
    if (r.exercise !== id || done || paused) return;
    pause(true);
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
  // Меньше линий (PLAN §9б): только плечи и рабочая рука тонкой линией, светящаяся точка на ЛАДОНИ, звезда, пунктир.
  function draw({ ctx: g, toPx, frame, w }) {
    const now = performance.now();
    const pose = frame?.pose;
    const unit = Math.max(8, w / 120);
    const P = (i) => (pose && vis(pose[i]) ? toPx(pose[i]) : null);
    const sh = P(idx.sh), other = P(idx.other), el_ = P(idx.el), wr = P(idx.wr);
    const S = sh && other ? Math.hypot(sh.x - other.x, sh.y - other.y) : w * 0.18;
    // Ладонь = запястье + 0,3 ширины плеч по линии предплечья (локоть → запястье). Ей движок «берёт» звезду.
    let palm = null;
    if (wr) {
      const from = el_ ?? sh;
      const dx = from ? wr.x - from.x : 0, dy = from ? wr.y - from.y : 0, n = Math.hypot(dx, dy);
      palm = n ? { x: wr.x + (dx / n) * HAND_EXT * S, y: wr.y + (dy / n) * HAND_EXT * S } : wr;
    }
    const bad = new Set(mistake?.landmarks ?? []);
    const live = !paused && !done;
    // После «упражнение готово» движок молчит — звезду, тень и пунктир прячем.
    const star = target && !done ? { ...toPx(target), r: Math.max(26, target.radius * toPx(target).scale) } : null;
    const outSign = side === 'left' ? -1 : 1;

    // Пока рука внизу и никто не ошибается: «Вы вчера» (путь лучшего повтора) или тень-тренер.
    const armDown = sh && palm && palm.y - sh.y > 0.55 * S;
    // Человечек слева тянется туда, где звезда у ЭТОГО человека (угол от плеча), а не в типовую точку.
    // Меряем, пока рука внизу: точка плеча в MediaPipe «едет» за поднятой рукой.
    if (star && sh && armDown && (id === 'reach_up' || id === 'reach_side')) {
      const lift = (Math.atan2(Math.abs(star.x - sh.x), star.y - sh.y) * 180) / Math.PI;
      if (demoLift == null || Math.abs(lift - demoLift) > 8) {
        demoLift = lift;
        const box = el.querySelector('.hud-demo');
        if (box) box.innerHTML = demoFigure(id, side, { liftDeg: lift });
      }
    }
    const calm = star && sh && live && !mistake && armDown && now - lastRepAt > 900;
    if (calm) {
      if (yesterday && other) {
        drawYesterday(g, yesterday, now, { shoulder: sh, S, outSign }, ''); // подпись рисуем сами — крупнее
        const ball = yesterdayBall(yesterday, now, sh, S, outSign);
        if (ball) {
          g.save();
          g.globalAlpha = ball.fade;
          label(g, yesterdayLabel, ball.x, ball.y - S * 0.42, Math.max(28, unit * 3.6));
          g.restore();
        }
      } else {
        drawGhost(g, now, sh, S, star, unit);
      }
    }

    // Искры за ладонью, пока рука идёт к звезде.
    if (star && palm && live && !armDown && id !== 'open_hand' && Math.hypot(star.x - palm.x, star.y - palm.y) > star.r) {
      fx.trail(palm.x, palm.y, now);
    }

    // Пунктир от ладони к звезде: «тянись сюда». Точки бегут к звезде.
    if (star && palm && id !== 'open_hand') {
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

    // Звезда: мягкое свечение + пульс. На паузе — приглушена.
    if (star) {
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

    // Тонкие линии: плечи + рабочая рука до ладони. Без точек-суставов. Участок с ошибкой — красный.
    if (sh && other) {
      const thin = Math.max(3, unit * 0.5);
      const seg = (a, b, ia, ib) => {
        if (!a || !b) return;
        const red = bad.has(ia) && bad.has(ib);
        g.strokeStyle = red ? RED : 'rgba(255,255,255,.6)';
        g.lineWidth = red ? thin * 1.6 : thin;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      };
      g.save();
      g.lineCap = 'round';
      g.shadowColor = 'rgba(0,0,0,.3)';
      g.shadowBlur = 3;
      seg(other, sh, idx.other, idx.sh);
      seg(sh, el_, idx.sh, idx.el);
      seg(el_, wr, idx.el, idx.wr);
      seg(wr, palm, idx.wr, idx.wr);
      g.restore();
    }
    // Точка на ладони — то, чем «берём» звезду.
    if (palm && !done) {
      g.save();
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.shadowColor = '#ffd76a';
      g.shadowBlur = unit * 2;
      g.beginPath();
      g.arc(palm.x, palm.y, Math.max(8, S * 0.07), 0, Math.PI * 2);
      g.fill();
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

    // Взрыв звезды на повторе: чистый (🌸) — богаче, с зеленью и кольцом.
    for (const b of bursts) {
      const c = toPx(b);
      fx.burst(c.x, c.y, now, b.clean);
    }
    bursts = [];
    // «Чашка ко рту»: настоящая чашка в руке. Дёрнулся или наклонился — вода плеснула.
    if (id === 'hand_to_mouth' && palm && live) {
      lastPalm = palm;
      const size = Math.max(40, S * 0.55);
      g.save();
      g.font = `${Math.round(size)}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('☕', palm.x, palm.y - size * 0.15);
      g.restore();
    }
    for (; splashes > 0; splashes -= 1) if (lastPalm) fx.splash(lastPalm.x, lastPalm.y - S * 0.3, now);
    fx.draw(g, now);
  }

  // Где сейчас шар «Вы вчера» (тот же расчёт, что в engine/fx.js drawYesterday) — чтобы подписать его крупно.
  function yesterdayBall(rep, now, sh, S, outSign) {
    const REST_MS = 1000;
    const t = now % (rep.ms + REST_MS);
    if (t > rep.ms) return null;
    let i = rep.pts.findIndex((p) => p[0] > t);
    if (i < 0) i = rep.pts.length - 1;
    const [, o, u] = rep.pts[i];
    return { x: sh.x + o * S * outSign, y: sh.y - u * S, fade: Math.max(0, Math.min(1, t / 250, (rep.ms - t) / 250)) };
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
    onRest,
    onExerciseDone,
    onGesture(g) {
      if (g.type === 'PAUSE' && g.fired && !paused) { pause(); return true; }
      if (paused) return resumeRing.handle(g);
      return false;
    },
    destroy() { alive = false; clearTimeout(hintTimer); resumeRing.destroy(); },
  };
}
