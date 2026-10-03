// Проверка ключевых кадров: один бандл, много кадров → out/frames/*.png (для просмотра перед рендером видео).
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
const HS = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const frames = (process.argv[2] ?? '').split(',').filter(Boolean).map(Number);
const serveUrl = await bundle({ entryPoint: new URL('../src/index.jsx', import.meta.url).pathname });
const comp = await selectComposition({ serveUrl, id: process.env.COMP ?? 'Promo', browserExecutable: HS });
mkdirSync('out/frames', { recursive: true });
for (const f of frames) {
  await renderStill({ composition: comp, serveUrl, frame: f, output: `out/frames/${String(f).padStart(5, '0')}.png`, browserExecutable: HS, scale: 0.5 });
  process.stdout.write(`${f} `);
}
console.log();
