// Экран 2 — Подготовка [E] (docs/PLAN.md §10). Видео с трафаретом «куда сесть» + 6 правил.
// Три правила движок проверяет сам (свет, расстояние, видно ли тело) — они загораются галочками.
// Дальше пускаем только когда кадр хороший: кольцо «ладонь» до этого неактивно.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { pendingTask } from '../life.js';

const RULES = [
  { id: 'chair', icon: icons.chair, title: 'Сядьте на стул', hint: 'Лучше без подлокотников' },
  { id: 'distance', icon: icons.laptop, title: 'Камера на уровне груди', hint: 'Примерно в 1 метре от вас' },
  { id: 'light', icon: icons.sun, title: 'Свет спереди', hint: 'Лицом к окну или лампе' },
  { id: 'frame', icon: icons.person, title: 'Видно голову и руки', hint: 'И место над головой' },
  { id: 'clothes', icon: icons.shirt, title: 'Одежда с рукавами', hint: 'Не балахон' },
  { id: 'pain', icon: icons.stop, title: 'Больно — стоп', hint: 'Две ладони к камере = пауза' },
];

// Движок проверяет кадр по порядку: свет → человек в кадре → расстояние → видно локти.
// Поэтому по одному коду статуса понятно, что уже в порядке, что нет, а что ещё не проверено.
function checksFor(code) {
  switch (code) {
    case 'OK': return { light: 'ok', frame: 'ok', distance: 'ok' };
    case 'LOW_LIGHT': return { light: 'bad', frame: 'wait', distance: 'wait' };
    case 'NO_PERSON': return { light: 'ok', frame: 'bad', distance: 'wait' };
    case 'TOO_CLOSE':
    case 'TOO_FAR': return { light: 'ok', frame: 'ok', distance: 'bad' };
    case 'LOW_VISIBILITY': return { light: 'ok', frame: 'bad', distance: 'ok' };
    default: return { light: 'wait', frame: 'wait', distance: 'wait' };
  }
}
const BAD_RULE = { LOW_LIGHT: 'light', NO_PERSON: 'frame', LOW_VISIBILITY: 'frame', TOO_CLOSE: 'distance', TOO_FAR: 'distance' };

const STABLE_MS = 700; // кадр должен побыть хорошим чуть-чуть, чтобы кольцо не мигало

export default function prep(ctx) {
  const el = html(`
    <section class="prep" aria-labelledby="prep-title">
      <h1 id="prep-title">Сядьте в пунктир</h1>
      <div class="prep-main">
        <div class="cam-slot"></div>
        <ul class="rules stagger">
          ${RULES.map((r) => `
            <li class="rule" data-rule="${r.id}" data-state="${['chair', 'clothes', 'pain'].includes(r.id) ? 'info' : 'wait'}">
              <span class="ico">${r.icon}</span>
              <span>${r.title}<small>${r.hint}</small></span>
              <span class="tick" aria-hidden="true"></span>
            </li>`).join('')}
        </ul>
      </div>
      <div class="prep-go">
        <div class="ring-slot"></div>
        <div>
          <p class="ring-label">Поправьте, что отмечено</p>
          <p class="ring-sub">Когда всё зелёное — покажите ладонь</p>
        </div>
      </div>
    </section>`);

  const camSlot = el.querySelector('.cam-slot');
  const ring = createRing({ onFire: () => ctx.go(pendingTask() ? 'checkin' : 'hand') });
  el.querySelector('.ring-slot').replaceWith(ring.el);
  const label = el.querySelector('.ring-label');
  const sub = el.querySelector('.ring-sub');
  const rules = Object.fromEntries(RULES.map((r) => [r.id, el.querySelector(`[data-rule="${r.id}"]`)]));
  let okTimer = null;

  function setRule(id, state, message) {
    const li = rules[id];
    const was = li.dataset.state;
    li.dataset.state = state;
    li.querySelector('.tick').innerHTML = state === 'ok' ? icons.check : state === 'bad' ? icons.cross : '';
    const small = li.querySelector('small');
    small.textContent = state === 'bad' && message ? message : RULES.find((r) => r.id === id).hint;
    if (was !== state && (state === 'ok' || state === 'bad')) {
      li.querySelector('.tick').animate([{ transform: 'scale(0.6)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }
  }

  function sync() {
    const s = ctx.state.status;
    const checks = checksFor(s?.code);
    for (const id of ['light', 'frame', 'distance']) setRule(id, checks[id], BAD_RULE[s?.code] === id ? s.message : '');
    clearTimeout(okTimer);
    if (s?.code === 'OK') {
      okTimer = setTimeout(() => {
        ring.setDisabled(false);
        ctx.say('Всё готово! Покажите ладонь', { hint: true });
        label.textContent = 'Всё готово!';
        sub.textContent = 'Покажите ладонь — идём дальше';
      }, STABLE_MS);
    } else {
      ring.setDisabled(true);
      if (s) ctx.say(s.message, { hint: true });
      label.textContent = s ? s.message : 'Проверяю кадр…';
      sub.textContent = 'Когда всё зелёное — покажите ладонь';
    }
  }

  return {
    el,
    enter() {
      ctx.camera.mount(camSlot, { overlay: 'guide' });
      ctx.say('Сядьте так, чтобы голова и плечи были в пунктире', { hint: true });
      ring.setDisabled(true);
      sync();
    },
    onStatus: sync,
    onGesture: (g) => ring.handle(g),
    destroy() { clearTimeout(okTimer); ring.destroy(); },
  };
}
