// Сцены видео-питча (16:9). Длительности в секундах — черновые; когда придёт озвучка,
// scripts/align.mjs запишет точные границы в pitch-timing.json и они заменят эти.
import real from './pitch-timing.json';

export const FPS = 30;
export const W = 1920, H = 1080;

const DRAFT = [
  ['storm', 21], ['sad', 16], ['memes', 25], ['numbers', 25], ['turn', 17], ['demo', 35],
  ['error', 25], ['doctor', 32], ['home', 27], ['proud', 25], ['plan', 12], ['finale', 22], ['post', 5],
];

const durs = real?.scenes?.length === DRAFT.length ? real.scenes.map((s, i) => [DRAFT[i][0], s]) : DRAFT;
let at = 0;
export const SCENES = durs.map(([id, sec]) => {
  const from = Math.round(at * FPS);
  at += sec;
  return { id, from, dur: Math.round(at * FPS) - from };
});
export const TOTAL = Math.round(at * FPS);
// Ключевые моменты внутри сцен (сек от начала сцены), если align нашёл их по словам.
export const CUES = real?.cues ?? {};
