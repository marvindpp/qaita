// Музыка и звуки видео-питча — синтез кодом (без чужих сэмплов), под тайминг озвучки (src/pitch/pitch-timing.json).
// Подложка приглушается, когда звучит голос; эффекты (гром, штамп, хлопушка) — поверх.
// Запуск: node music/pitch-music.mjs → public/pitch-music.wav
import { writeFileSync, readFileSync } from 'node:fs';

const T = JSON.parse(readFileSync(new URL('../src/pitch/pitch-timing.json', import.meta.url)));
const SR = 44100;
const LEN = T.scenes.reduce((s, x) => s + x, 0);
const N = Math.ceil(SR * LEN);
// две дорожки: подложка (приглушается под голос) и эффекты
const BL = new Float32Array(N), BR = new Float32Array(N), FL = new Float32Array(N), FR = new Float32Array(N);
let L = BL, R = BR;
const bed = () => { L = BL; R = BR; }, fx = () => { L = FL; R = FR; };
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

// ——— новые звуки ———
function noiseBed(len, lo = 400, hi = 6000, gain = 1) { // дождь
  const n = Math.floor(len * SR), o = new Float32Array(n), a = biquad('hp', lo), b = biquad('lp', hi);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = b(a(rnd())) * gain * Math.min(1, t / 0.8, (len - t) / 0.8) * (0.85 + 0.15 * Math.sin(t * 1.3)); }
  return o;
}
function thunder(len = 4) {
  const n = Math.floor(len * SR), o = new Float32Array(n), lp = biquad('lp', 260, 0.9), lp2 = biquad('lp', 1800);
  for (let i = 0; i < n; i++) { const t = i / SR; const crack = t < 0.25 ? lp2(rnd()) * Math.exp(-t / 0.06) * 1.2 : 0; const rumble = lp(rnd()) * 4 * env(t, 0.12, 1.1) * (0.7 + 0.3 * Math.sin(t * 9)); o[i] = crack + rumble; }
  return o;
}
function heart(gain = 1) { const o = new Float32Array(Math.floor(0.6 * SR)); const a = kick(0.3, 90, 40, 1), b = kick(0.3, 80, 38, 0.7); o.set(a, 0); for (let i = 0; i < b.length; i++) o[i + Math.floor(0.2 * SR)] += b[i]; return o.map((x) => x * gain); }
function piano(midi, len = 2.5, gain = 1) {
  const n = Math.floor(len * SR), o = new Float32Array(n), f = hz(midi);
  for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; [1, 2, 3, 4.01].forEach((h, k) => { s += Math.sin(2 * Math.PI * f * h * t) * [1, 0.45, 0.22, 0.1][k] * Math.exp(-t * (0.9 + k * 0.9)); }); o[i] = s * gain * Math.min(1, t / 0.004) * Math.min(1, (len - t) / 0.2); }
  return o;
}
function scratch() { const n = Math.floor(0.5 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 300 + 1600 * Math.abs(Math.sin(t * 18)); ph += (2 * Math.PI * f) / SR; o[i] = (Math.sin(ph) * 0.5 + rnd() * 0.5) * Math.exp(-t / 0.25) * 0.9; } return o; }
function tick() { const n = Math.floor(0.03 * SR), o = new Float32Array(n), hp = biquad('hp', 3000); for (let i = 0; i < n; i++) o[i] = hp(rnd()) * Math.exp(-i / SR / 0.004); return o; }
function boing() { const n = Math.floor(0.7 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 160 + 220 * Math.exp(-t / 0.15) + 30 * Math.sin(t * 60) * Math.exp(-t / 0.3); ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t / 0.3); } return o; }
function ping() { const a = blip(1318, 1318, 0.5), b = blip(1760, 1760, 0.6), o = new Float32Array(Math.floor(0.8 * SR)); o.set(a, 0); for (let i = 0; i < b.length; i++) o[i + Math.floor(0.11 * SR)] += b[i]; return o; }
function stamp() { const o = boom(0.8); const c = clap(); for (let i = 0; i < c.length; i++) o[i] += c[i] * 0.8; return o; }
function pop() { const n = Math.floor(0.25 * SR), o = new Float32Array(n), bp = biquad('bp', 2200, 0.7); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = bp(rnd()) * Math.exp(-t / 0.03) * 2 + Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t / 0.05) * 0.4; } return o; }
function chime(base = 76) { const o = new Float32Array(Math.floor(1.6 * SR)); [0, 4, 7, 12].forEach((d, k) => { const p = piano(base + d, 1.2, 0.6); for (let i = 0; i < p.length; i++) { const j = i + Math.floor(k * 0.07 * SR); if (j < o.length) o[j] += p[i]; } }); return o; }

// ——— тайминг ———
const NAMES = ['storm', 'sad', 'memes', 'numbers', 'turn', 'demo', 'error', 'doctor', 'home', 'proud', 'plan', 'finale', 'post'];
const S = {}; let acc = 0; NAMES.forEach((id, i) => { S[id] = [acc, acc + T.scenes[i]]; acc += T.scenes[i]; });
const at = (id, cueName, frac = 0) => S[id][0] + (T.cues[id]?.[cueName] ?? frac * (S[id][1] - S[id][0]));
const F = (fr) => fr / 30;

// ——— 1. гроза ———
bed();
add(0, noiseBed(S.turn[0] + 6 - 0, 500, 7000, 0.22), 1, 0);            // дождь до рассвета
add(0, pad([33, 40, 45], S.storm[1] + 2, 300, 2), 0.5);                  // тёмный гул
fx();
[F(8), at('storm', 'n40') - F(2), at('storm', 'mom') + F(30), at('storm', 'minutes') - F(4)].forEach((t, i) => add(t, thunder(4), i === 1 ? 0.9 : 0.65, i % 2 ? -0.3 : 0.3));
for (let t = 0.8, bpm = 70; t < S.storm[1]; t += 60 / bpm, bpm = Math.min(110, bpm + 2)) add(t, heart(0.55));
// ——— 2. грусть: пианино ля минор ———
bed();
[[57, 0], [60, 1], [64, 2], [69, 3], [65, 4.5], [64, 5.5], [60, 6.5], [57, 8], [55, 9.5], [59, 10.5], [62, 11.5], [64, 13]].forEach(([m, t]) => { if (S.sad[0] + t < S.sad[1] - 0.5) add(S.sad[0] + t, piano(m, 3, 0.5), 1, (m - 60) / 30); });
add(S.sad[0], pad([45, 52, 57], S.sad[1] - S.sad[0], 600, 2), 0.35);
// ——— 3. мемы: прыгучее пиццикато ———
const mStep = 60 / 116 / 2;
for (let t = S.memes[0], k = 0; t < S.memes[1] - 0.3; t += mStep, k++) {
  const m = [48, 55, 52, 55, 50, 57, 53, 57][k % 8];
  add(t, pluck(m + (k % 16 >= 8 ? 2 : 0), 0.35, 0.3), 0.55, k % 2 ? 0.3 : -0.3);
  if (k % 2 === 0) add(t, hat(), 0.12);
}
fx();
add(at('memes', 'reality'), boing(), 0.6);
add(at('memes', 'remote') + F(24), boom(1), 0.5);
add(at('memes', 'got') - 0.2, whoosh(0.4), 0.5); add(at('memes', 'got') + 0.1, chime(79), 0.5);
add(at('memes', 'brain') + F(12), ping(), 0.45);
// ——— 4. цифры: скретч, удары, тиканье ———
add(S.numbers[0] - 0.15, scratch(), 0.8);
bed(); add(S.numbers[0] + 0.4, pad([31, 38, 43], S.numbers[1] - S.numbers[0], 250, 1.5), 0.6);
fx();
['fifth', 'reps', 'quit'].forEach((c) => add(at('numbers', c), boom(1.6), 0.7));
for (let t = at('numbers', 'doctor'); t < at('numbers', 'blind'); t += 0.125) add(t, tick(), 0.35);
add(at('numbers', 'blind'), boom(2.2), 0.5);
// ——— 5. рассвет: райзер → гром → тёплый аккорд ———
const drop = at('turn', 'drop');
add(drop - 3, riser(3), 0.6);
add(drop - F(4), thunder(3), 0.5);
add(drop, crash(3), 0.35); add(drop, chime(72), 0.45);
bed(); add(drop, pad([48, 55, 60, 64], S.turn[1] - drop + 1, 1400, 1.2), 0.6);
// ——— 6–10. грув: демо, ошибка, врач, дом, гордость ———
function groove(t0, t1, opts = {}) {
  const B = 60 / 112, chords = opts.chords ?? [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]];
  for (let bar = 0, t = t0; t < t1 - 0.2; bar++, t += B * 4) {
    const ch = chords[bar % 4], len = Math.min(B * 4, t1 - t);
    bed(); add(t, pad(ch, len, opts.cut ?? 1500, 0.3), 0.35);
    add(t, bass(ch[0] - 12, B * 1.6), 0.5); add(t + B * 2, bass(ch[0] - 12, B * 1.6), 0.45);
    for (let b = 0; b < 4; b++) {
      const tb = t + b * B; if (tb > t1 - 0.1) break;
      if (opts.kick !== false) add(tb, kick(0.4, 140, 45, 0.7), 0.55);
      add(tb + B / 2, hat(), 0.18); if (b % 2) add(tb, clap(), 0.25);
      if (opts.dombra) { add(tb, pluck(ch[(b + 1) % 4] + 12, 0.6, 0.55), 0.3, -0.2); add(tb + B / 2, pluck(ch[(b + 2) % 4] + 12, 0.5, 0.55), 0.22, 0.2); }
    }
  }
}
groove(S.demo[0], S.doctor[1]);
fx();
add(at('demo', 'warn') - 0.05, boom(0.9), 0.45);
add(at('demo', 'warn') + F(74), stamp(), 0.7);
add(at('demo', 'ok') + F(55), pop(), 0.8); add(at('demo', 'ok') + F(55), chime(76), 0.5);
for (let k = 0; k < 6; k++) add(at('doctor', 'fingers') + 0.1 + k * 0.33, tick(), 0.6);
add(at('doctor', 'fingers') + F(30), stamp(), 0.6);
// дом: домбра, без бочки, тепло
groove(S.home[0], S.home[1], { kick: false, dombra: true, cut: 1100, chords: [[50, 53, 57, 62], [48, 52, 55, 60], [46, 50, 53, 58], [48, 52, 55, 60]] });
fx();
{ const per = (at('home', 'garden') - at('home', 'yurt')) / 7; for (let k = 0; k < 7; k++) add(at('home', 'yurt') + k * per, blip(660 + k * 110, 990 + k * 110, 0.16), 0.3); }
groove(S.proud[0], S.plan[1]);
fx(); add(Math.max(S.proud[0] + 1, at('proud', 'list') - F(70)), stamp(), 0.6);
// ——— 12. финал: пианино → подъём на «берёт её» → тишина ———
bed();
[[64, 0], [67, 1.2], [72, 2.4], [71, 3.6]].forEach(([m, t]) => add(S.finale[0] + t, piano(m, 3, 0.5), 1));
const grab = at('finale', 'grab');
add(grab, pad([48, 55, 60, 64, 67], S.finale[1] - grab, 1800, 1.5), 0.6);
[[72, 0], [76, 0.5], [79, 1], [84, 1.6]].forEach(([m, t]) => add(grab + 0.4 + t, piano(m, 3.5, 0.55), 1));
fx(); add(at('finale', 'end'), chime(72), 0.4);
// ——— 13. шутка ———
add(S.post[0] + 2.6, boing(), 0.35);

// ——— приглушение подложки под голос ———
const duck = new Float32Array(N).fill(1);
for (const [a, b] of T.units) { const i0 = Math.max(0, Math.floor((a - 0.15) * SR)), i1 = Math.min(N, Math.floor((b + 0.2) * SR)); for (let i = i0; i < i1; i++) duck[i] = 0.4; }
let g = 1; const k = 1 / (0.12 * SR);
for (let i = 0; i < N; i++) { g += (duck[i] - g) * k * (duck[i] < g ? 3 : 1); duck[i] = g; }

let peak = 0; const OL = new Float32Array(N), OR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (SR * 1.5));
  OL[i] = Math.tanh((BL[i] * duck[i] * 0.8 + FL[i]) * 0.7) * fade; OR[i] = Math.tanh((BR[i] * duck[i] * 0.8 + FR[i]) * 0.7) * fade;
  peak = Math.max(peak, Math.abs(OL[i]), Math.abs(OR[i]));
}
const G = 0.89 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(OL[i] * G * 32767), 44 + i * 4); pcm.writeInt16LE(Math.round(OR[i] * G * 32767), 46 + i * 4); }
writeFileSync(new URL('../public/pitch-music.wav', import.meta.url), pcm);
console.log('pitch-music.wav', LEN.toFixed(1), 's, peak', peak.toFixed(2));
