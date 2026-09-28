// Точка входа [E]. ?mock=1 → mock-движок (src/mock), иначе настоящий (src/engine).
// &screen=prep — открыть сразу нужный экран (для разработки).
import '../styles/main.css';
import { createApp } from './ui/app.js';

const params = new URLSearchParams(location.search);
const mock = params.has('mock');
const { createEngine } = mock
  ? await import('./mock/mockEngine.js')
  : await import('./engine/index.js');

const video = document.querySelector('#camera');
const engine = await createEngine({ video });
const app = createApp({ engine, video, mock });
app.start(params.get('screen') ?? 'welcome');
if (mock) window.qaita = app; // для отладки в консоли: qaita.ctx.go('garden')

// Распознавание (MediaPipe) качается с CDN. Нет интернета или CDN молчит — говорим об этом словами,
// а не показываем вечное «Загружаю…». Если модели всё же догрузятся позже, экран сам вернётся в норму.
// Считаем только время, когда камера уже открыта: пока человек думает над «Разрешить камеру?», это не загрузка.
const LOAD_TIMEOUT_S = 60;
let loadingFor = 0;
const slow = setInterval(() => {
  if (app.ctx.state.live) return clearInterval(slow);
  if (video.srcObject) loadingFor += 1;
  if (loadingFor === LOAD_TIMEOUT_S) app.fail({ label: 'Загрузка идёт слишком долго', sub: 'Проверьте интернет и обновите страницу' });
}, 1000);
try {
  await engine.start();
} catch (err) {
  console.error(err);
  app.fail({ label: 'Не загрузилось распознавание', sub: 'Проверьте интернет и обновите страницу' });
} finally {
  clearInterval(slow);
}
