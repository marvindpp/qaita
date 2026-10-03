// Кадры для проверки: по 3–4 на сцену (начало, ключевые моменты, конец).
import t from '../src/pitch/pitch-timing.json' with { type: 'json' };
const names = ['storm', 'sad', 'memes', 'numbers', 'turn', 'demo', 'error', 'doctor', 'home', 'proud', 'plan', 'finale', 'post'];
let at = 0; const out = [];
names.forEach((id, i) => {
  const d = t.scenes[i];
  const cs = Object.values(t.cues[id] ?? {});
  const pts = [0.6, ...cs.map((c) => c + 1.2), d - 0.4].filter((x) => x < d);
  for (const p of pts) out.push(Math.round((at + p) * 30));
  at += d;
});
console.log(out.join(','));
