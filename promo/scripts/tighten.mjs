// Ужимает паузы в озвучке: каждая тишина длиннее MAX становится KEEP секунд.
// Пишет public/voice.wav и public/voice-map.json (карта «старое время → новое», для субтитров).
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
const SRC = process.argv[2] ?? 'public/voice-raw.mp3';
const MAX = +(process.argv[3] ?? 0.26), KEEP = +(process.argv[4] ?? 0.22), TH = Math.pow(10, -45 / 20);
const ff = (args, opts) => execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-v', 'error', ...args], { maxBuffer: 1 << 30, ...opts });
ff(['-y', '-i', SRC, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', 'out/voice-pcm.wav']);
const wav = readFileSync('out/voice-pcm.wav');
const di = wav.indexOf('data') + 8; // заголовок WAV бывает разной длины
const raw = wav.subarray(di);
const sr = 44100, pcm = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + (raw.length & ~1)));
const win = 441; // 10 мс
const n = Math.floor(pcm.length / win), quiet = new Uint8Array(n);
for (let i = 0; i < n; i++) {
  let s = 0;
  for (let j = 0; j < win; j++) { const v = pcm[i * win + j] / 32768; s += v * v; }
  quiet[i] = Math.sqrt(s / win) < TH ? 1 : 0;
}
const runs = [];
for (let i = 0; i < n;) {
  if (!quiet[i]) { i++; continue; }
  let j = i; while (j < n && quiet[j]) j++;
  if ((j - i) / 100 > MAX) runs.push([i, j]);
  i = j;
}
// вырезаем середину каждой длинной паузы, оставляя KEEP/2 по краям
const keepW = Math.round((KEEP * 100) / 2);
const out = []; const map = []; let pos = 0, newT = 0;
for (const [a, b] of runs) {
  const cutA = (a + keepW) * win, cutB = (b - keepW) * win;
  out.push(pcm.subarray(pos, cutA)); newT += (cutA - pos) / sr;
  map.push([cutA / sr, newT, cutB / sr]); pos = cutB;
}
out.push(pcm.subarray(pos));
const total = out.reduce((s, x) => s + x.length, 0);
const buf = Buffer.alloc(44 + total * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + total * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(total * 2, 40);
let o = 44; for (const x of out) { Buffer.from(x.buffer, x.byteOffset, x.length * 2).copy(buf, o); o += x.length * 2; }
writeFileSync('public/voice.wav', buf);
// паузы в НОВОМ времени — границы фраз для выравнивания
writeFileSync('public/voice-map.json', JSON.stringify({ src: SRC, before: pcm.length / sr, after: total / sr, cuts: map, pauses: map.map((m) => m[1]) }));
console.log(`паузы: ${runs.length}, было ${(pcm.length / sr).toFixed(1)} c → стало ${(total / sr).toFixed(1)} c`);
