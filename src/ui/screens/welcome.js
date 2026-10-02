// Экран 1 — Приветствие [E]. Одна мысль: «это упражнения для руки, покажите ладонь — начнём».
// Кольцо обнимает живое видео: человек видит себя и свою ладонь, пока кольцо заполняется.
import { mountNameAsk } from '../name-ask.js';
import { html, esc } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { cameraHelp, noPromptHelp } from '../camera-help.js';
import { loadProfile, greeting } from '../profile.js';
import { splashStar } from '../motion.js';
import { loadRx, rxToday } from '../rx.js';
import { EXERCISE_INFO } from '../exercises.js';
import { plural } from '../dom.js';

// Столько ждём вопроса «Разрешить камеру?», прежде чем подсказать, где её включить.
const NO_PROMPT_MS = 6000;

/** Карточка «План от врача» (если врач назначил упражнения по QR). */
function rxCard() {
  const rx = loadRx();
  if (!rx) return '';
  const t = rxToday(rx);
  const names = rx.ex.map((id) => EXERCISE_INFO[id]?.title).filter(Boolean).join(', ');
  return `<div class="rx-card"><b>🩺 План от врача${rx.doctor ? ` · ${esc(rx.doctor)}` : ''}</b>
    <span>${esc(names)} — по ${rx.reps} ${plural(rx.reps, 'разу', 'раза', 'раз')}, ${rx.perDay} ${plural(rx.perDay, 'раз', 'раза', 'раз')} в день · сегодня ${Math.min(t.done, t.need)} из ${t.need}</span>
    ${rx.note ? `<span class="rx-note">«${esc(rx.note)}»</span>` : ''}</div>`;
}

export default function welcome(ctx) {
  const el = html(`
    <section class="welcome" aria-labelledby="welcome-title">
      <header><span class="brand">${icons.logo}Qaita</span></header>
      <div class="welcome-main">
        <div class="stagger">
          ${loadProfile().name ? `<p class="welcome-hello">${loadProfile().avatar} ${greeting()}</p>` : ''}
          <h1 id="welcome-title">Упражнения для руки <em>дома</em></h1>
          <p class="lead">Камера считает повторы и подсказывает голосом, как делать правильно.</p>
          ${rxCard()}
        </div>
        <div class="welcome-go">
          <div class="ring-slot"></div>
          <p class="ring-label">Покажите ладонь</p>
          <p class="ring-sub">и подержите секунду — начнём</p>
          <button class="btn-start" type="button">${icons.play ?? '▶'} Начать со звуком</button>
        </div>
      </div>
      <footer class="welcome-foot">
        <span class="chip">${icons.lock}Видео никуда не отправляется</span>
        <span class="chip">${icons.heart}Не заменяет врача</span>
      </footer>
    </section>`);

  // Первый запуск: «Как вас зовут?» — одно поле и «Пропустить»; ладонь всё так же ведёт дальше.
  const doneNameAsk = mountNameAsk(el.querySelector('.stagger'), ctx);
  const camSlot = html('<div class="ring-cam"></div>');
  camSlot.append(splashStar()); // заставка: звезда из искр, пока камера и распознавание не ожили
  const ring = createRing({ center: camSlot, onFire: () => ctx.go('prep') });
  el.querySelector('.ring-slot').replaceWith(ring.el);
  // Браузер не даёт голосу говорить, пока на странице ни разу не нажали. Жюри и родственник, открывший ссылку,
  // нажмут кнопку — и голос включится сразу (app.js разблокирует звук на любое нажатие). Жест ладонью тоже работает.
  const startBtn = el.querySelector('.btn-start');
  startBtn.addEventListener('click', () => ctx.go('prep'));
  // Кнопку показываем, только если браузер реально не даёт звук (Chrome помнит сайты, где звук уже разрешали).
  // Распознавание не загрузилось (app.fail) — кнопку прячем: без него дальше всё равно не пройти.
  const syncStart = () => { startBtn.hidden = Boolean(!ctx.state.live && ctx.state.failed) || !(ctx.voice.blocked || ctx.sound.blocked); };
  syncStart();
  const offVoice = ctx.voice.onChange(syncStart);
  const startTimer = setInterval(syncStart, 700);
  const label = el.querySelector('.ring-label');
  const sub = el.querySelector('.ring-sub');

  let helpTimer = null, tipTimer = null, alive = true;

  function show(t) { label.textContent = t.label; sub.textContent = t.sub; }

  function syncReady() {
    const s = ctx.state.status;
    clearTimeout(helpTimer);
    camSlot.dataset.nocam = String(s?.code === 'NO_CAMERA');
    if (s?.code === 'NO_CAMERA') {
      ring.setDisabled(true);
      show({ label: 'Нет доступа к камере', sub: s.message });
      cameraHelp().then((t) => { if (alive && ctx.state.status?.code === 'NO_CAMERA') show(t); });
      return;
    }
    // Распознавание не загрузилось (нет интернета / CDN): говорим прямо, советы и «дыхание» кольца останавливаем.
    const failed = !ctx.state.live && ctx.state.failed;
    syncStart();
    if (failed) {
      clearInterval(tipTimer);
      el.querySelector('.welcome-go').dataset.loading = 'false';
      ring.setDisabled(true);
      return show(failed);
    }
    ring.setDisabled(!ctx.state.live);
    if (ctx.state.live) return show({ label: 'Покажите ладонь', sub: 'и подержите секунду — начнём' });
    show({ label: 'Включаю камеру…', sub: 'Если браузер спросит — нажмите «Разрешить»' });
    // Камера так и не открылась — вопрос не появился (встроенный браузер мессенджера или запрет). Подсказываем, что делать.
    // Если камера уже открыта, а кадров ещё нет — это грузится распознавание, просто ждём.
    helpTimer = setTimeout(() => {
      if (!alive || ctx.state.live || ctx.state.failed) return;
      const camOpen = Boolean(document.getElementById('camera')?.srcObject);
      if (!camOpen) return show(noPromptHelp());
      // Пока грузятся модели (на телефоне до минуты) — живая загрузка с советами, а не «зависшая» надпись.
      const TIPS = ['Сядьте лицом к свету', 'Камера — на уровне груди, примерно в метре', 'Над головой нужно место для поднятой руки', 'Больно — покажите две ладони, это пауза', 'Видео никуда не отправляется'];
      let k = 0;
      el.querySelector('.welcome-go').dataset.loading = 'true';
      show({ label: 'Готовлю распознавание…', sub: `Совет: ${TIPS[0]}` });
      tipTimer = setInterval(() => { if (!alive || ctx.state.live || ctx.state.failed) { clearInterval(tipTimer); el.querySelector('.welcome-go').dataset.loading = 'false'; return; } k += 1; show({ label: 'Готовлю распознавание…', sub: `Совет: ${TIPS[k % TIPS.length]}` }); }, 3500);
    }, NO_PROMPT_MS);
  }

  return {
    el,
    enter() {
      ctx.camera.mount(camSlot);
      syncReady();
      if (ctx.state.live) ctx.say('Покажите ладонь в камеру и подержите секунду', { hint: true });
    },
    onLive() {
      syncReady();
      const rxSay = ctx.state.newRx ? 'Врач назначил вам упражнения — я буду заниматься с вами по его плану. ' : '';
      ctx.state.newRx = null;
      ctx.say(`${greeting()} ${rxSay}Это упражнения для руки. Покажите ладонь в камеру и подержите секунду`, { hint: true });
    },
    onStatus: syncReady,
    onFailed: syncReady,
    onGesture: (g) => ring.handle(g),
    destroy() { doneNameAsk(); alive = false; clearTimeout(helpTimer); clearInterval(tipTimer); clearInterval(startTimer); offVoice?.(); ring.destroy(); },
  };
}
