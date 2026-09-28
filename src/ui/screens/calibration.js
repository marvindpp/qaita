// Экран 4 — Калибровка «Твоя норма» [E]. Движок ведёт фазы (сидим ровно → вверх → в сторону) и пишет текст.
// UI: огромный текст, отсчёт 3-2-1 кружком, полоска прогресса по фазам — без цифр и процентов.
// В конце не листаем сами: «Готово!» и кольцо «ладонь» (правило: дальше только по жесту).
import { html } from '../dom.js';
import { createRing } from '../components/ring.js';

const PHASES = [
  { id: 'neutral', label: 'Сидим ровно' },
  { id: 'max_up', label: 'Вверх' },
  { id: 'max_side', label: 'В сторону' },
];

export default function calibration(ctx) {
  const el = html(`
    <section class="calib" aria-labelledby="calib-title">
      <h2 id="calib-title" class="visually-hidden">Калибровка</h2>
      <ol class="steps">
        ${PHASES.map((p) => `<li data-phase="${p.id}" data-state="todo"><span class="step-fill"></span><span class="step-label">${p.label}</span></li>`).join('')}
      </ol>
      <div class="calib-main">
        <div class="cam-slot"></div>
        <div class="calib-side">
          <p class="calib-msg" aria-live="polite">Готовимся…</p>
          <div class="count" aria-hidden="true"></div>
          <div class="calib-done">
            <div class="ring-slot"></div>
            <div><p class="ring-label">Покажите ладонь</p><p class="ring-sub">и начнём упражнения</p></div>
          </div>
        </div>
      </div>
    </section>`);

  const msg = el.querySelector('.calib-msg');
  const count = el.querySelector('.count');
  const steps = Object.fromEntries(PHASES.map((p) => [p.id, el.querySelector(`[data-phase="${p.id}"]`)]));
  const ring = createRing({ onFire: () => ctx.go('demo', { index: 0 }) });
  el.querySelector('.ring-slot').replaceWith(ring.el);
  let lastMain = '', lastCount = '', done = false, alive = true;

  function setPhase(phase, progress) {
    const idx = PHASES.findIndex((p) => p.id === phase);
    PHASES.forEach((p, i) => {
      const li = steps[p.id];
      const state = phase === 'done' || i < idx ? 'done' : i === idx ? 'now' : 'todo';
      li.dataset.state = state;
      const k = state === 'done' ? 1 : state === 'now' ? progress : 0;
      li.querySelector('.step-fill').style.transform = `scaleX(${k})`;
    });
  }

  function onCalibration({ phase, progress, message }) {
    if (done) return;
    // Движок дописывает отсчёт в конец: «Правую руку — вверх до упора · 3…».
    const [main, tail] = message.split(' · ');
    const n = tail ? tail.replace(/\D/g, '') : '';
    if (main !== lastMain) {
      lastMain = main;
      msg.textContent = main;
      msg.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      ctx.say(main, { hint: true });
    }
    if (n !== lastCount) {
      lastCount = n;
      count.textContent = n;
      count.dataset.show = String(Boolean(n));
      if (n) {
        count.animate([{ transform: 'scale(1.25)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
        ctx.sound.tick();
      }
    }
    setPhase(phase, progress);
    if (phase === 'done') finish();
  }

  function finish() {
    if (done) return;
    done = true;
    el.dataset.done = 'true';
    msg.textContent = 'Готово! Ваша норма сохранена';
    count.dataset.show = 'false';
    setPhase('done', 1);
    ctx.sound.done();
    ctx.say('Готово! Ваша норма сохранена. Покажите ладонь, и начнём упражнения', { force: true, hint: true });
  }

  return {
    el,
    wantsStatus: true,
    enter() {
      ctx.camera.mount(el.querySelector('.cam-slot'));
      ctx.engine.calibrate().then(() => { if (alive) finish(); });
    },
    onCalibration,
    onGesture: (g) => done && ring.handle(g),
    destroy() { alive = false; ring.destroy(); },
  };
}
