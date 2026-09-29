// Профиль «Мой Qaita»: имя и аватар — без сервера и паролей, только в этом браузере.
// Регистрация без пароля: пожилому человеку (и жюри) достаточно назваться — данные никуда не уходят.
const KEY = 'qaita.profile.v1';
export const AVATARS = ['👵', '👴', '🧓', '👩‍🦳', '👨‍🦳', '🙂', '🌸', '⭐'];

export function loadProfile() {
  try { return { name: '', avatar: '🙂', ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) }; } catch { return { name: '', avatar: '🙂' }; }
}
export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
}
/** «Айгуль» → «Здравствуйте, Айгуль!»; без имени — «Здравствуйте!». */
export const greeting = (p = loadProfile()) => (p.name ? `Здравствуйте, ${p.name}!` : 'Здравствуйте!');

/** Стереть всё, что Qaita хранит в браузере (история, цели, голоса). */
export async function wipeAll() {
  try { Object.keys(localStorage).filter((k) => k.startsWith('qaita')).forEach((k) => localStorage.removeItem(k)); } catch { /* приватный режим */ }
  try { indexedDB.deleteDatabase('qaita'); } catch { /* нет IndexedDB */ }
}
