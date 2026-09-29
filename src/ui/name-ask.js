// Первый запуск: ненавязчивое «Как вас зовут?» на приветствии. Одно поле и «Пропустить».
// Жестовый поток не трогаем: кольцо «ладонь» работает как обычно, ладонь = «дальше» (имя, если успели
// написать, сохраняем; не написали — больше не спрашиваем). Хранилище — тот же профиль (profile.js).
import { html, esc } from './dom.js';
import { loadProfile, saveProfile, greeting } from './profile.js';

/** Спросить ли имя: его нет и человек ещё ни разу не проходил мимо вопроса. */
export const shouldAskName = (p = loadProfile()) => !p.name && !p.asked;

/**
 * Вставляет карточку в конец `slot` (блок заголовка приветствия). Возвращает done() — вызвать при уходе с экрана.
 * @param {HTMLElement} slot
 * @param {{ say: Function }} ctx
 */
export function mountNameAsk(slot, ctx) {
  if (!slot || !shouldAskName()) return () => {};
  const card = html(`
    <form class="name-ask" autocomplete="off" aria-label="Как вас зовут?">
      <label class="name-ask-q" for="name-ask-field">Как вас зовут?</label>
      <div class="name-ask-row">
        <input id="name-ask-field" class="name-ask-field" type="text" maxlength="30" placeholder="Имя" enterkeyhint="done" autocapitalize="words">
        <button type="submit" class="name-ask-ok">Готово</button>
        <button type="button" class="name-ask-skip">Пропустить</button>
      </div>
      <p class="name-ask-hint">Можно не писать — просто покажите ладонь</p>
    </form>`);
  slot.append(card);
  const field = card.querySelector('input');
  // Буквы и пробел не должны доходить до глобальных клавиш (в ?mock=1 пробел = «ладонь»).
  field.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });

  let open = true;
  const finish = (name, leaving = false) => {
    if (!open) return;
    open = false;
    const p = loadProfile();
    saveProfile({ ...p, name: name || p.name, asked: true });
    if (leaving) return; // экран и так уезжает — карточку не трогаем, чтобы не дёргалась
    card.remove();
    if (name) {
      const p2 = loadProfile();
      slot.prepend(html(`<p class="welcome-hello">${esc(p2.avatar)} ${esc(greeting(p2))}</p>`));
      ctx.say?.(`${greeting(p2)} Покажите ладонь — начнём`, { interrupt: true, hint: true });
    }
    // Экран стал другой высоты — app.js подгонит масштаб по событию resize.
    dispatchEvent(new Event('resize'));
  };
  card.addEventListener('submit', (e) => { e.preventDefault(); field.blur(); finish(field.value.trim().slice(0, 30)); });
  card.querySelector('.name-ask-skip').addEventListener('click', () => finish(''));

  // Ушли с приветствия (ладонь, кнопка, меню) — вопрос считаем показанным; успели написать имя — сохраняем.
  return () => finish(field.value.trim().slice(0, 30), true);
}
