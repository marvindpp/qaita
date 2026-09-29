// Кладём wasm распознавания (MediaPipe) рядом с сайтом: public/mediapipe/wasm. Так сайт не зависит от CDN
// (jsdelivr может быть заблокирован фильтром школы/клиники). Берём из node_modules — версия ровно та, что в package-lock.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const from = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const to = resolve(root, 'public/mediapipe/wasm');
mkdirSync(to, { recursive: true });
// module-вариант не нужен: FilesetResolver грузит vision_wasm_internal (SIMD) или nosimd.
for (const f of readdirSync(from)) if (!f.includes('module')) cpSync(resolve(from, f), resolve(to, f));
console.log('wasm → public/mediapipe/wasm');
