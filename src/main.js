// Точка входа [E]. ?mock=1 → mock-движок (src/mock), иначе настоящий (src/engine).
import './../styles/main.css';

const params = new URLSearchParams(location.search);
const { createEngine } = params.has('mock')
  ? await import('./mock/mockEngine.js')
  : await import('./engine/index.js');

const video = document.querySelector('#camera');
const status = document.querySelector('#status');

const engine = await createEngine({ video });
engine.on('status', ({ message }) => { status.textContent = message; });
await engine.start();
