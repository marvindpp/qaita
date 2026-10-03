// Музыка и звуки ролика — синтез кодом, без чужих сэмплов (значит, без вопросов к авторским правам).
// 120 BPM, 30 с, сетка та же, что у видео (src/timing.js): удары хука, тихая «боль» с сердцебиением,
// райзер к логотипу, дроп на 10 с, тёплый грув с домбровым «пиццикато» (Karplus–Strong), финальный удар на 26 с.
// Запуск: npm run music → public/music.wav
import { writeFileSync, mkdirSync } from 'node:fs';
import { BPM } from '../src/timing.js';

const SR = 44100;
const LEN = 30;
const N = SR * LEN;
const L = new Float32Array(N), R = new Float32Array(N);
const B = 60 / BPM; // доля, с

// ——— утилиты ———
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
function add(t0, buf, gain = 1, pan = 0) {
  const s = Math.floor(t0 * SR), gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < buf.length; i++) { const j = s + i; if (j < 0 || j >= N) continue; L[j] += buf[i] * gl; R[j] += buf[i] * gr; }
}
// Биквад (RBJ): lp / hp / bp
function biquad(type, f, q = 0.707) {
  const w = (2 * Math.PI * f) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
  let b0, b1, b2; const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = a; b1 = 0; b2 = -a; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ——— инструменты ———
function kick(len = 0.5, top = 160, bottom = 44, gain = 1) {
  const n = Math.floor(len * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; const f = bottom + (top - bottom) * Math.exp(-t / 0.045); ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t / 0.22) * gain + (i < 300 ? rnd() * 0.3 * (1 - i / 300) : 0); }
  return o;
}
function boom(len = 2.2) { // удар-«слэм»: суббас + шумовой удар + хвост
  const n = Math.floor(len * SR), o = new Float32Array(n); let ph = 0; const lp = biquad('lp', 2400);
  for (let i = 0; i < n; i++) { const t = i / SR; const f = 38 + 120 * Math.exp(-t / 0.06); ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t / 0.7) + lp(rnd()) * Math.exp(-t / 0.18) * 0.7; }
  return o;
}
function clap() {
  const n = Math.floor(0.35 * SR), o = new Float32Array(n), bp = biquad('bp', 1500, 0.9);
  for (let i = 0; i < n; i++) { const t = i / SR; const e = [0, 0.011, 0.022].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) / 0.012) : 0), 0) * 0.5 + (t > 0.022 ? Math.exp(-(t - 0.022) / 0.11) : 0); o[i] = bp(rnd()) * e * 1.6; }
  return o;
}
function hat(open = false) {
  const n = Math.floor((open ? 0.3 : 0.07) * SR), o = new Float32Array(n), hp = biquad('hp', 7500);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = hp(rnd()) * Math.exp(-t / (open ? 0.09 : 0.018)); }
  return o;
}
function pluck(midi, len = 1.2, bright = 0.5) { // Karplus–Strong: щипок струны, как домбра
  const n = Math.floor(len * SR), o = new Float32Array(n), p = Math.round(SR / hz(midi)), d = new Float32Array(p);
  for (let i = 0; i < p; i++) d[i] = rnd();
  let k = 0;
  for (let i = 0; i < n; i++) { const a = d[k], b = d[(k + 1) % p]; d[k] = (a * bright + b * (1 - bright)) * 0.996; o[i] = a; k = (k + 1) % p; }
  return o;
}
function pad(midis, len, cutoff = 1200, attack = 0.6) {
  const n = Math.floor(len * SR), o = new Float32Array(n), lp = biquad('lp', cutoff, 0.8);
  const phs = midis.flatMap((m) => [0, 0.11, -0.13].map((det) => ({ f: hz(m) * 2 ** (det / 12), p: (rnd() + 1) / 2 })));
  for (let i = 0; i < n; i++) {
    const t = i / SR; let s = 0;
    for (const v of phs) { v.p = (v.p + v.f / SR) % 1; s += v.p * 2 - 1; }
    const e = Math.min(1, t / attack) * Math.min(1, (len - t) / 0.4);
    o[i] = lp(s / phs.length) * e;
  }
  return o;
}
function bass(midi, len) {
  const n = Math.floor(len * SR), o = new Float32Array(n), lp = biquad('lp', 420, 1.1); let p = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; p = (p + hz(midi) / SR) % 1; const s = Math.sin(p * 2 * Math.PI) * 0.7 + (p * 2 - 1) * 0.3; o[i] = lp(s) * env(t, 0.005, len * 0.7) * Math.min(1, (len - t) / 0.03); }
  return o;
}
function riser(len) {
  const n = Math.floor(len * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, x = t / len; ph += (2 * Math.PI * (180 + 900 * x * x)) / SR; o[i] = (rnd() * 0.5 * x + Math.sin(ph) * 0.25 * x) * x; }
  // фильтр с меняющейся частотой: сглаживаем шум простым одним полюсом
  let y = 0; for (let i = 0; i < n; i++) { const a = 0.05 + 0.6 * (i / n); y += a * (o[i] - y); o[i] = o[i] * 0.4 + y * 0.6; }
  return o;
}
function whoosh(len = 0.45, up = true) {
  const n = Math.floor(len * SR), o = new Float32Array(n); let y = 0, y2 = 0;
  for (let i = 0; i < n; i++) { const x = i / n; const a = 0.02 + 0.5 * (up ? x : 1 - x); y += a * (rnd() - y); y2 += 0.3 * (y - y2); o[i] = (y - y2 * 0.6) * Math.sin(Math.PI * x) * 1.4; }
  return o;
}
function blip(f0, f1, len = 0.14) { // «поп» яблока / «дзинь»
  const n = Math.floor(len * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, x = i / n; ph += (2 * Math.PI * (f0 + (f1 - f0) * Math.min(1, x * 3))) / SR; o[i] = Math.sin(ph) * Math.exp(-t / (len * 0.35)); }
  return o;
}
function crash(len = 2.5) {
  const n = Math.floor(len * SR), o = new Float32Array(n), hp = biquad('hp', 4200);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = hp(rnd()) * Math.exp(-t / 0.8) * 0.8; }
  return o;
}

// ——— аранжировка ———
// 0–3 с: хук — слэм на каждую долю (под слова «КАЖДЫЙ / ГОД / 40 000 / ИНСУЛЬТОВ …»)
for (let k = 0; k < 6; k++) { add(k * B, boom(0.8), k === 2 ? 1.0 : 0.6); add(k * B, hat(true), 0.25, k % 2 ? 0.4 : -0.4); }
add(0, whoosh(0.5, false), 0.5);

// 3–9 с: «боль» — минорный пэд (Dm → Bb → C), тихо и глухо
add(3, pad([50, 53, 57, 62], 2.1, 700, 0.4), 0.38);
add(5, pad([46, 50, 53, 58], 2.1, 700, 0.3), 0.38);
add(7, pad([48, 52, 55, 60], 2.2, 600, 0.3), 0.34);
// «каждый пятый»: пять щипков — четыре тусклых, пятый ярче
[62, 62, 62, 62, 69].forEach((m, i) => add(3.5 + i * B * 0.5, pluck(m, 1.0, i === 4 ? 0.65 : 0.45), i === 4 ? 0.55 : 0.28, (i - 2) * 0.25));
// «у врача 15 минут»: сердцебиение и тиканье
for (let s = 6; s < 9; s += 1) { add(s, kick(0.4, 90, 40, 0.9), 0.7); add(s + 0.22, kick(0.35, 80, 38, 0.6), 0.5); }
for (let s = 6; s < 9; s += B) add(s, blip(2600, 2600, 0.03), 0.12, 0.5);

// 9–10 с: райзер + малый барабан ускоряется
add(9, riser(1.0), 0.9);
[0, 0.25, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375].forEach((d) => add(9 + d, clap(), 0.18 + d * 0.35));
// 10 с: ДРОП — удар + тарелка
add(10, boom(2.2), 1.1); add(10, crash(2.5), 0.6);

// 10–26 с: грув. Аккорды по тактам (такт = 4 доли = 2 с): F – C – Dm – Bb, дважды
const chords = [[53, 57, 60, 64], [48, 52, 55, 60], [50, 53, 57, 62], [46, 50, 53, 58]];
const roots = [41, 36, 38, 34];
for (let bar = 0; bar < 8; bar++) {
  const t0 = 10 + bar * 4 * B, c = bar % 4;
  add(t0, pad(chords[c].map((m) => m + 12), 4 * B + 0.05, 1600, 0.05), 0.26);
  for (let b = 0; b < 4; b++) {
    const t = t0 + b * B;
    add(t, kick(), 0.95);
    if (b % 2 === 1) add(t, clap(), 0.55);
    add(t + B / 2, hat(), 0.32, 0.3);
    if (b === 3) add(t + B * 0.75, hat(), 0.2, -0.3);
    add(t, bass(roots[c], B * 0.48), 0.55);
    add(t + B / 2, bass(roots[c] + (b === 3 ? 7 : 12), B * 0.4), 0.42);
  }
  // домбра: пентатоника F мажор, восьмые
  const scale = [65, 67, 69, 72, 74, 77, 79, 81];
  const pattern = [[0, 2, 4, 3, 2, 4, 5, 4], [1, 3, 4, 2, 1, 2, 3, 1], [2, 4, 5, 4, 2, 1, 2, 4], [1, 2, 4, 3, 5, 4, 3, 2]][c];
  pattern.forEach((idx, i) => add(t0 + i * B / 2, pluck(scale[idx], 0.7, 0.55), 0.24, i % 2 ? 0.35 : -0.35));
}
// переходы-свисты и «попы»
[15, 19, 23].forEach((t) => add(t - 0.3, whoosh(0.5, true), 0.55));
add(16.5, blip(880, 1760, 0.35), 0.3); add(16.5 + 0.12, blip(1320, 2640, 0.35), 0.25); // «Так правильно! +50»
for (let k = 0; k < 7; k++) add(19.5 + k * B, blip(520 + k * 70, 1100 + k * 90, 0.12), 0.22, (k - 3) * 0.15); // юрта по частям

// 26–30 с: финальный удар и тёплый хвост
add(26, boom(3.5), 1.05); add(26, crash(3.5), 0.5);
add(26, pad([53, 57, 60, 64, 67].map((m) => m + 12), 4, 2200, 0.02), 0.32);
[[72, 26.5], [74, 27.0], [77, 27.5], [81, 28.25]].forEach(([m, t]) => add(t, pluck(m, 1.8, 0.6), 0.3));

// ——— мастер: мягкий клип, нормализация, плавный конец ———
let peak = 0;
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (SR * 1.2));
  L[i] = Math.tanh(L[i] * 0.6) * fade; R[i] = Math.tanh(R[i] * 0.6) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.89 / peak; // ≈ −1 dBFS
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); pcm.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/music.wav', import.meta.url), pcm);
console.log('music.wav', (pcm.length / 1e6).toFixed(1), 'MB, peak before norm', peak.toFixed(2));
