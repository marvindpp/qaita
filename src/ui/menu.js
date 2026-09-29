// Меню-бургер: для родственника или самого человека — Тренировка, Мой прогресс, Профиль, Отчёт врачу, О Qaita,
// музыка и голос. Во время упражнений кнопки нет (там всё управляется жестами и ничего не должно мешать).
import { html, esc } from './dom.js';
import { loadProfile } from './profile.js';
import { MOODS, MOOD_IDS } from './music.js';

const ITEMS = [
  { go: 'welcome', ico: '▶', label: 'Тренировка' },
  { go: 'progress', ico: '📈', label: 'Мой прогресс и рекорды' },
  { go: 'garden', ico: '🌸', label: 'Мой сад' },
  { go: 'profile', ico: '👤', label: 'Профиль и близкие' },
  { go: 'doctor', ico: '🩺', label: 'Отчёт для врача' },
  { go: 'about', ico: 'ℹ️', label: 'О Qaita' },
];
// На этих экранах бургер показываем; на остальных (калибровка, демо, игра, итоги упражнения) — нет.
export const MENU_SCREENS = new Set(['welcome', 'prep', 'hand', 'goal', 'garden', 'doctor', 'progress', 'profile', 'about']);

export function createMenu({ go, music, voice }) {
  const btn = html('<button type="button" class="burger" aria-label="Меню" aria-expanded="false"><span></span><span></span><span></span></button>');
  const drawer = html(`
    <div class="drawer" data-open="false" aria-hidden="true">
      <nav class="drawer-panel" aria-label="Меню">
        <div class="drawer-head"><span class="drawer-ava"></span><div><b class="drawer-name"></b><small>Мой Qaita</small></div></div>
        <ul>${ITEMS.map((i) => `<li><button type="button" data-go="${i.go}"><span aria-hidden="true">${i.ico}</span>${i.label}</button></li>`).join('')}</ul>
        <div class="drawer-toggles">
          <label class="switch"><input type="checkbox" data-t="music"><span></span>🎵 Спокойная музыка</label>
          <div class="moods" role="group" aria-label="Настроение музыки">${MOOD_IDS.map((id) => `<button type="button" data-mood="${id}" aria-pressed="false" title="${MOODS[id].title}"><span aria-hidden="true">${MOODS[id].ico}</span>${MOODS[id].label}</button>`).join('')}</div>
          <label class="switch"><input type="checkbox" data-t="voice"><span></span>🗣 Голос тренера</label>
        </div>
        <p class="drawer-note">🔒 Видео не записывается. Всё хранится только на этом устройстве.</p>
      </nav>
    </div>`);
  document.getElementById('app').append(btn, drawer);

  const setOpen = (v) => {
    drawer.dataset.open = String(v);
    drawer.setAttribute('aria-hidden', String(!v));
    btn.setAttribute('aria-expanded', String(v));
    if (v) {
      const p = loadProfile();
      drawer.querySelector('.drawer-ava').textContent = p.avatar;
      drawer.querySelector('.drawer-name').textContent = p.name || 'Гость';
      drawer.querySelector('[data-t="music"]').checked = music.on;
      syncMoods();
      drawer.querySelector('[data-t="voice"]').checked = !voice.muted;
    }
  };
  btn.addEventListener('click', () => setOpen(drawer.dataset.open !== 'true'));
  drawer.addEventListener('click', (e) => { if (e.target === drawer) setOpen(false); });
  drawer.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { setOpen(false); go(b.dataset.go); }));
  drawer.querySelector('[data-t="music"]').addEventListener('change', (e) => { music.set(e.target.checked); syncMoods(); });
  // Настроение музыки: выбрать = сразу услышать (если музыка была выключена — включаем).
  function syncMoods() {
    drawer.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(music.on && b.dataset.mood === music.mood)));
  }
  drawer.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => {
    music.setMood?.(b.dataset.mood);
    if (!music.on) { music.set(true); drawer.querySelector('[data-t="music"]').checked = true; }
    syncMoods();
  }));
  drawer.querySelector('[data-t="voice"]').addEventListener('change', (e) => voice.setMuted(!e.target.checked));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  return {
    /** Показывать ли бургер на этом экране. */
    sync(name) { btn.hidden = !MENU_SCREENS.has(name); if (btn.hidden) setOpen(false); },
    get open() { return drawer.dataset.open === 'true'; },
    esc,
  };
}
