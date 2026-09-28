// Экран 1 — Приветствие [E]. Одна мысль: «это упражнения для руки, покажите ладонь — начнём».
// Кольцо обнимает живое видео: человек видит себя и свою ладонь, пока кольцо заполняется.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { cameraHelp, noPromptHelp } from '../camera-help.js';

// Столько ждём вопроса «Разрешить камеру?», прежде чем подсказать, где её включить.
const NO_PROMPT_MS = 6000;

export default function welcome(ctx) {
  const el = html(`
    <section class="welcome" aria-labelledby="welcome-title">
      <header><span class="brand">${icons.logo}Qaita</span></header>
      <div class="welcome-main">
        <div class="stagger">
          <h1 id="welcome-title">Упражнения для руки <em>дома</em></h1>
          <p class="lead">Камера считает повторы и подсказывает голосом, как делать правильно.</p>
        </div>
        <div class="welcome-go">
          <div class="ring-slot"></div>
          <p class="ring-label">Покажите ладонь</p>
          <p class="ring-sub">и подержите секунду — начнём</p>
          <button class="btn-start" type="button">${icons.play ?? '▶'} Начать со звуком</button>
        </div>
      </div>
      <footer class="welcome-foot">
        <span class="chip">${icons.lock}Видео не записывается и никуда не отправляется</span>
        <span class="chip">${icons.heart}Не заменяет врача — помогает делать назначенные упражнения</span>
      </footer>
    </section>`);

  const camSlot = html('<div class="ring-cam"></div>');
  const ring = createRing({ center: camSlot, onFire: () => ctx.go('prep') });
  el.querySelector('.ring-slot').replaceWith(ring.el);
  // Браузер не даёт голосу говорить, пока на странице ни разу не нажали. Жюри и родственник, открывший ссылку,
  // нажмут кнопку — и голос включится сразу (app.js разблокирует звук на любое нажатие). Жест ладонью тоже работает.
  const startBtn = el.querySelector('.btn-start');
  startBtn.addEventListener('click', () => ctx.go('prep'));
  const label = el.querySelector('.ring-label');
  const sub = el.querySelector('.ring-sub');

  let helpTimer = null, alive = true;

  function show(t) { label.textContent = t.label; sub.textContent = t.sub; }

  function syncReady() {
    const s = ctx.state.status;
    clearTimeout(helpTimer);
    if (s?.code === 'NO_CAMERA') {
      ring.setDisabled(true);
      show({ label: 'Нет доступа к камере', sub: s.message });
      cameraHelp().then((t) => { if (alive && ctx.state.status?.code === 'NO_CAMERA') show(t); });
      return;
    }
    // Распознавание не загрузилось (app.fail): говорим прямо и прячем кнопку — дальше без него всё равно не пройти.
    const failed = !ctx.state.live && ctx.state.failed;
    startBtn.style.display = failed ? 'none' : '';
    if (failed) { ring.setDisabled(true); return show(ctx.state.failed); }
    ring.setDisabled(!ctx.state.live);
    if (ctx.state.live) return show({ label: 'Покажите ладонь', sub: 'и подержите секунду — начнём' });
    show({ label: 'Включаю камеру…', sub: 'Если браузер спросит — нажмите «Разрешить»' });
    // Камера так и не открылась — вопрос не появился (встроенный браузер мессенджера или запрет). Подсказываем, что делать.
    // Если камера уже открыта, а кадров ещё нет — это грузится распознавание, просто ждём.
    helpTimer = setTimeout(() => {
      if (!alive || ctx.state.live || ctx.state.failed) return;
      const camOpen = Boolean(document.getElementById('camera')?.srcObject);
      show(camOpen ? { label: 'Загружаю распознавание…', sub: 'В первый раз это до минуты' } : noPromptHelp());
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
      ctx.say('Здравствуйте! Это упражнения для руки. Покажите ладонь в камеру и подержите секунду', { hint: true });
    },
    onStatus: syncReady,
    onFailed: syncReady,
    onGesture: (g) => ring.handle(g),
    destroy() { alive = false; clearTimeout(helpTimer); ring.destroy(); },
  };
}
