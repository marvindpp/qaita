// Экран 1 — Приветствие [E]. Одна мысль: «это упражнения для руки, покажите ладонь — начнём».
// Кольцо обнимает живое видео: человек видит себя и свою ладонь, пока кольцо заполняется.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';

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
  const label = el.querySelector('.ring-label');
  const sub = el.querySelector('.ring-sub');

  function syncReady() {
    const s = ctx.state.status;
    if (s?.code === 'NO_CAMERA') {
      ring.setDisabled(true);
      label.textContent = 'Нет доступа к камере';
      sub.textContent = 'Разрешите камеру в адресной строке и обновите страницу';
      return;
    }
    ring.setDisabled(!ctx.state.live);
    label.textContent = ctx.state.live ? 'Покажите ладонь' : 'Включаю камеру…';
    sub.textContent = ctx.state.live ? 'и подержите секунду — начнём' : 'Если браузер спросит — нажмите «Разрешить»';
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
    onGesture: (g) => ring.handle(g),
    destroy: () => ring.destroy(),
  };
}
