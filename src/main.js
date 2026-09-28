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

try {
  await engine.start();
} catch (err) {
  console.error(err);
  app.ctx.camera.setWaitText('Не получилось запустить распознавание. Обновите страницу');
}
