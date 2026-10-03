// Выравнивание сцен под озвучку без распознавания речи.
// Текст (docs/final/voiceover-v3.txt) режем на фразы, звук — на куски речи между паузами,
// и динамическим программированием раскладываем фразы по кускам (длительность ~ число букв).
// Результат: src/pitch/pitch-timing.json — длины сцен и ключевые моменты (сек от начала сцены).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const LEAD = 1.5; // гроза до первого слова
const MINP = +(process.env.MINP ?? 9); // пауза от 0,12 с (между фразами бывает совсем коротко)
const SRC = 'public/voice.mp3';
execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', SRC, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', 'out/voice-pcm.wav']);
const wav = readFileSync('out/voice-pcm.wav');
const di = wav.indexOf('data') + 8;
const pcm = new Int16Array(wav.buffer.slice(wav.byteOffset + di, wav.byteOffset + di + ((wav.length - di) & ~1)));
const sr = 16000, win = 160, n = Math.floor(pcm.length / win), TH = Math.pow(10, -45 / 20);
const q = new Uint8Array(n);
for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < win; j++) { const v = pcm[i * win + j] / 32768; s += v * v; } q[i] = Math.sqrt(s / win) < TH ? 1 : 0; }
// куски речи: между паузами ≥ 0.22 с
const segs = []; let st = null, quietRun = 0;
for (let i = 0; i <= n; i++) {
  const quiet = i === n || q[i];
  if (!quiet) { if (st === null) st = i; quietRun = 0; }
  else if (st !== null) { quietRun++; if (quietRun >= MINP || i === n) { segs.push([st / 100, (i - quietRun + 1) / 100]); st = null; quietRun = 0; } }
}
const total = n / 100;

// фразы
const txt = readFileSync('../docs/final/voiceover-v3.txt', 'utf8').replace(/́/g, '');
const units = [];
for (const para of txt.split(/\n\s*\n/)) {
  const parts = para.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…»])\s+(?=[\[«А-ЯЁA-Z…])/);
  for (const p of parts) {
    const plain = p.replace(/\[laughs\]/g, 'хахаха').replace(/\[[a-z ]+\]/g, '').trim();
    if (plain) units.push({ text: plain, w: plain.replace(/[^А-Яа-яЁёA-Za-z0-9]/g, '').length + 3 });
  }
}
// DP: каждая фраза = 1+ подряд идущих кусков
const S = segs.length, U = units.length;
const speech = segs.reduce((s, [a, b]) => s + b - a, 0);
const rate = speech / units.reduce((s, u) => s + u.w, 0);
const PEN = +(process.env.PEN ?? 6);
const INF = 1e18, dp = Array.from({ length: U + 1 }, () => new Float64Array(S + 1).fill(INF)), bk = Array.from({ length: U + 1 }, () => new Int32Array(S + 1));
dp[0][0] = 0;
for (let i = 1; i <= U; i++) for (let j = 1; j <= S; j++) {
  const exp = units[i - 1].w * rate;
  for (let k = j - 1; k >= 0 && j - k <= 30; k--) {
    if (dp[i - 1][k] >= INF) continue;
    const dur = segs[j - 1][1] - segs[k][0];
    // длинная пауза внутри одной фразы маловероятна: конец предложения обычно и даёт паузу
    let inner = 0;
    for (let m = k + 1; m < j; m++) inner += Math.max(0, segs[m][0] - segs[m - 1][1] - 0.3);
    const c = dp[i - 1][k] + ((dur - exp) ** 2) / Math.max(0.6, exp) + PEN * inner;
    if (c < dp[i][j]) { dp[i][j] = c; bk[i][j] = k; }
  }
}
let j = S; const starts = new Array(U);
for (let i = U; i >= 1; i--) { const k = bk[i][j]; starts[i - 1] = segs[k][0]; units[i - 1].end = segs[j - 1][1]; j = k; }
units.forEach((u, i) => (u.start = starts[i]));

const at = (needle) => {
  const u = units.find((x) => x.text.includes(needle));
  if (!u) throw new Error('нет фразы: ' + needle);
  return u.start + LEAD;
};
const SCENES = [
  ['storm', null], ['sad', 'Представьте'], ['memes', 'Окей'], ['numbers', 'И это уже не смешно'], ['turn', 'А что если'],
  ['demo', 'Смотрите.'], ['error', 'Это наш режим'], ['doctor', 'Теперь врач'], ['home', 'А для пациента'],
  ['proud', 'После первого этапа'], ['plan', 'Дальше — пилот'], ['finale', 'Помните маму'], ['post', 'И да.'],
];
const CUES = {
  storm: { n40: 'Сорок тысяч', mom: 'Чья-то мама', minutes: 'за минуты' },
  sad: { reach: 'Утром она', fail: 'а рука не слушается', doctor: 'Врач сказал' },
  memes: { reality: 'Реальность', remote: 'Через неделю', cheat: 'А ещё дома', got: 'Смотрите, я дотянулась', brain: 'Мама довольна' },
  numbers: { fifth: 'Реабилитацию получает', reps: 'На занятии', quit: 'До семидесяти', doctor: 'А у врача', blind: 'Он не видит' },
  turn: { drop: 'Мы — команда', link: 'Реабилитолог у вас дома' },
  demo: { cam: 'Камера видит', palm: 'Показываем ладонь', hand: 'Поднимаем руку', star: 'Упражнение «Звезда»', cheat: 'А теперь хитрим', warn: '«Плечо поднято', ok: 'Опускаем', kk: 'на казахском' },
  error: { calib: 'Сначала калибровка', list: 'Восемь компенсаций', scale: 'И подсказки словами', nocount: 'Пока ошибка есть' },
  doctor: { flags: 'За тридцать секунд', copy: 'Одна кнопка', fingers: 'Больше не надо', back: 'И обратно', noserver: 'Сервера нет' },
  home: { yurt: 'Каждый день занятий', garden: 'Чистые повторы', kids: 'А внуки', notclinic: 'Это не больница', lang: 'И приложение' },
  proud: { list: 'Кабинет врача.', tech: 'Внутри всё в браузере' },
  plan: { qr: 'прямо в выписке', free: 'Пациенту бесплатно' },
  finale: { morning: 'Утро.', grab: 'и берёт её', snova: 'значит «снова»', end: 'возвращает руку' },
};
const startT = SCENES.map(([, nd]) => (nd ? at(nd) : 0));
const END = total + LEAD + 2.5;
const scenes = startT.map((t, i) => +((i + 1 < startT.length ? startT[i + 1] : END) - t).toFixed(3));
const cues = {};
SCENES.forEach(([id], i) => {
  if (!CUES[id]) return;
  cues[id] = Object.fromEntries(Object.entries(CUES[id]).map(([k, nd]) => [k, +(at(nd) - startT[i]).toFixed(3)]));
});
writeFileSync('src/pitch/pitch-timing.json', JSON.stringify({ lead: LEAD, voice: total, scenes, cues, units: units.map((u) => [+(u.start + LEAD).toFixed(2), +(u.end + LEAD).toFixed(2), u.text]) }, null, 1));
console.log(`кусков речи ${S}, фраз ${U}, звук ${total.toFixed(1)} c, видео ${(END).toFixed(1)} c`);
SCENES.forEach(([id], i) => console.log(id.padEnd(8), startT[i].toFixed(1), '+', scenes[i]));
