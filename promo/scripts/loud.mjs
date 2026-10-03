// Поднимает громкость звука готового видео: усиление + мягкий лимитер (пик ≈ −1 dBFS). Видео не перекодируется.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, dst, gainDb = '11'] = process.argv.slice(2);
const ff = (a) => execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-v', 'error', '-y', ...a]);
ff(['-i', src, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', 'out/mix-st.wav']);
const w = readFileSync('out/mix-st.wav'); const di = w.indexOf('data') + 8;
const p = new Int16Array(w.buffer.slice(w.byteOffset + di, w.byteOffset + di + ((w.length - di) & ~1)));
const g = 10 ** (+gainDb / 20), ceil = 0.89, knee = 0.6;
// лимитер с упреждением 5 мс и плавным отпусканием
const n = p.length, x = Float32Array.from(p, (v) => (v / 32768) * g), env = new Float32Array(n);
const look = 480; let e = 0;
for (let i = n - 1; i >= 0; i--) { const a = Math.max(Math.abs(x[i]), Math.abs(x[Math.min(n - 1, i + 1)])); e = Math.max(a, e * 0.99995); env[i] = e; }
let gr = 1;
for (let i = 0; i < n; i++) {
  const peak = env[Math.min(n - 1, i + look)];
  const target = peak > knee ? Math.min(1, (knee + (ceil - knee) * Math.tanh((peak - knee) / (ceil - knee))) / peak) : 1;
  gr = target < gr ? gr + (target - gr) * 0.02 : gr + (target - gr) * 0.0005;
  p[i] = Math.max(-32767, Math.min(32767, Math.round(Math.max(-ceil, Math.min(ceil, x[i] * gr)) * 32767)));
}
Buffer.from(p.buffer).copy(w, di);
writeFileSync('out/mix-loud.wav', w);
ff(['-i', src, '-i', 'out/mix-loud.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', dst]);
console.log('ok', dst);
