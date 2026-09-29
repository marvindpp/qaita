// Экран «Вчерашнее задание» (PLAN §9г, CIMT «пакет переноса»): главное — чтобы рука работала в ЖИЗНИ.
// 👍 — получилось (цветок «из жизни» в саду), ладонь — «пока нет» (без упрёков). Оба ответа — дальше.
import { html, esc } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { pendingTask, answerTask, goalById } from '../life.js';

export default function checkin(ctx) {
  // В демо-режиме (?mock=1) показываем пример задания, даже если вчера не занимались — чтобы экран можно было увидеть.
  const t = pendingTask() ?? (ctx.state.mock ? { goal: 'cup', text: 'Возьмите чашку больной рукой 3 раза (можно пустую)', day: 'demo' } : null);
  const g = goalById(t?.goal);
  const el = html(`
    <section class="checkin" aria-labelledby="checkin-title">
      <p class="demo-step">${g ? `${g.emoji} Цель: ${esc(g.short)}` : 'Задание из жизни'}</p>
      <h1 id="checkin-title">Вчерашнее задание</h1>
      <p class="checkin-task">«${esc(t?.text ?? '')}»</p>
      <p class="lead">Получилось?</p>
      <div class="checkin-go">
        <div class="checkin-opt" data-kind="yes"><div class="ring-slot"></div><p class="ring-label">Да!</p><p class="ring-sub">палец вверх</p></div>
        <div class="checkin-opt" data-kind="no"><div class="ring-slot"></div><p class="ring-label">Пока нет</p><p class="ring-sub">покажите ладонь</p></div>
      </div>
    </section>`);

  // Ответ — один раз: жест и нажатие (или оба кольца) могли сработать подряд и записать ответ дважды.
  let answered = false, alive = true;
  const done = (yes) => {
    if (answered) return;
    answered = true;
    answerTask(yes);
    if (yes) { ctx.sound.combo?.(3); ctx.say('Это важнее любых упражнений! В саду вырос цветок из жизни', { interrupt: true, force: true }); }
    else ctx.say('Ничего страшного. Сегодня тренируемся — и попробуем снова', { interrupt: true, force: true });
    setTimeout(() => { if (alive) ctx.go('hand'); }, yes ? 2600 : 1800);
  };
  const yes = createRing({ gesture: 'THUMBS_UP', icon: '<span style="font-size:52px">👍</span>', onFire: () => done(true) });
  const no = createRing({ onFire: () => done(false) });
  el.querySelector('[data-kind="yes"] .ring-slot').replaceWith(yes.el);
  el.querySelector('[data-kind="no"] .ring-slot').replaceWith(no.el);
  el.querySelector('[data-kind="yes"]').addEventListener('click', () => done(true));
  el.querySelector('[data-kind="no"]').addEventListener('click', () => done(false));

  return {
    el,
    enter() {
      if (!t) { setTimeout(() => { if (alive) ctx.go('hand'); }, 0); return; } // задания нет — сразу дальше
      ctx.say(`Вчера было задание: ${t?.text ?? ''}. Получилось? Палец вверх — да. Ладонь — пока нет`, { hint: true });
    },
    onGesture: (e) => yes.handle(e) || no.handle(e),
    destroy() { alive = false; yes.destroy(); no.destroy(); },
  };
}
