// Установка как приложение (PWA): иконка шаңырақ-Q на рабочем столе, запуск без адресной строки.
// Chrome/Android/Edge дают системный запрос (beforeinstallprompt), iPhone — только через «Поделиться → На экран Домой».
let deferred = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
}
const standalone = () => typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent ?? '');

export function installState() {
  if (standalone()) return { can: false, text: 'Qaita уже установлена — открывайте её иконкой на экране.' };
  if (deferred) return { can: true, text: 'Иконка Qaita появится на экране телефона или компьютера — бабушке не придётся искать ссылку.' };
  if (ios()) return { can: false, text: 'На iPhone: внизу Safari нажмите «Поделиться» (квадрат со стрелкой) → «На экран Домой». Появится иконка Qaita.' };
  return { can: false, text: 'В меню браузера (⋮) выберите «Установить приложение» или «Добавить на главный экран». Появится иконка Qaita.' };
}
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}
