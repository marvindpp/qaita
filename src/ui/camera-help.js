// Почему нет камеры [E] — конкретная подсказка вместо общего «разрешите камеру».
// Частые случаи на телефоне: ссылку открыли внутри Telegram/WhatsApp/Instagram (их окно камеру не даёт,
// и вопрос «Разрешить?» просто не появляется) или камеру для сайта уже когда-то запретили.

const IN_APP = /Telegram|WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|VKAndroid|VKClient|; wv\)/i;

export function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Ссылка открыта во встроенном окне мессенджера или соцсети, а не в обычном браузере. */
export const isInAppBrowser = () => IN_APP.test(navigator.userAgent);

const browserName = () => (isIOS() ? 'Safari' : 'Chrome');
const openInBrowser = () => ({ label: `Откройте в ${browserName()}`, sub: 'Это окно не даёт камеру. Нажмите ⋮ или «…» вверху → «Открыть в браузере»' });

/** Разрешение на камеру: 'granted' | 'denied' | 'prompt' | null (браузер не говорит). */
async function cameraPermission() {
  try {
    return (await navigator.permissions?.query({ name: 'camera' }))?.state ?? null;
  } catch {
    return null;
  }
}

/** Текст для экрана, когда камера не открылась. @returns {Promise<{label:string, sub:string}>} */
export async function cameraHelp() {
  if (!window.isSecureContext) {
    return { label: 'Нужна ссылка https://', sub: 'Откройте marvindpp.github.io/qaita' };
  }
  if (isInAppBrowser() || !navigator.mediaDevices?.getUserMedia) {
    return openInBrowser();
  }
  if ((await cameraPermission()) === 'denied') {
    return isIOS()
      ? { label: 'Камера запрещена', sub: 'Нажмите «аА» слева от адреса → Настройки веб-сайта → Камера → Разрешить. Потом обновите страницу' }
      : { label: 'Камера запрещена', sub: 'Нажмите на значок слева от адреса → Разрешения → Камера → Разрешить. Потом обновите страницу' };
  }
  return { label: 'Нет доступа к камере', sub: `Закройте другие приложения с камерой и обновите страницу. Не помогло — откройте ссылку в ${browserName()}` };
}

/** Подсказка, если вопрос «Разрешить камеру?» так и не появился (камера ещё не открыта). */
export function noPromptHelp() {
  if (isInAppBrowser()) return openInBrowser();
  return isIOS()
    ? { label: 'Не видно вопроса про камеру?', sub: 'Нажмите «аА» слева от адреса → Настройки веб-сайта → Камера → Разрешить' }
    : { label: 'Не видно вопроса про камеру?', sub: 'Нажмите на значок слева от адреса → Разрешения → Камера → Разрешить' };
}
