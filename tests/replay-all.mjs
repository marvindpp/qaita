// Прогон ВСЕХ записей плейтеста одной командой → сводная таблица (Markdown, можно вставить в PR).
//   node tests/replay-all.mjs                    — все tests/fixtures/rec-*.json (и непереименованные qaita-rec-*.json)
//   node tests/replay-all.mjs a.json b.json      — только эти файлы
//   node tests/replay-all.mjs --timeline         — плюс таймлайн событий каждой записи (как replay.mjs)
// Это тестовый инструмент, не часть продукта.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replay } from './replay.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

// «rec-mama-54.json» → «mama-54»
export const personOf = (file) => basename(file).replace(/^(qaita-)?rec-/, '').replace(/\.json$/, '');

/**
 * Одна запись → строки таблицы (по упражнению).
 * hints — подсказки, которые человек реально УВИДЕЛ (события mistake), по кодам.
 */
export function rowsOf(rec, person) {
  const { summary, events, lines } = replay(rec);
  const exMarks = rec.marks.filter((mk) => mk.type === 'exercise');
  const rows = summary.map((r, k) => {
    const evs = events.filter((e) => e.k === k);
    const hints = {};
    for (const e of evs) if (e.type === 'mistake') hints[e.payload.code] = (hints[e.payload.code] ?? 0) + 1;
    return {
      person, ex: r.id, reps: r.reps, target: exMarks[k]?.targetReps ?? 5, clean: r.cleanReps,
      quality: r.quality, hints, rest: evs.filter((e) => e.type === 'rest').map((e) => e.payload.reason),
      done: evs.some((e) => e.type === 'exercise-done'),
    };
  });
  const calibrated = lines.some((l) => l.includes('✔ calibrated'));
  return { rows, lines, calibrated };
}

const fmtHints = (h) => Object.entries(h).map(([c, n]) => `${c}×${n}`).join(', ') || '—';

export function table(allRows) {
  const out = ['| Человек | Упражнение | Повторов | Чистых | Качество | Подсказки (что увидел человек) | «Отдохните» |', '|---|---|---|---|---|---|---|'];
  for (const r of allRows) {
    const reps = `${r.reps}/${r.target}${r.done ? '' : ' ⚠ не закончил'}`;
    out.push(`| ${r.person} | ${r.ex} | ${reps} | ${r.clean} | ${r.quality.toFixed(2)} | ${fmtHints(r.hints)} | ${r.rest.join(', ') || '—'} |`);
  }
  return out.join('\n');
}

// Какая подсказка у скольких РАЗНЫХ людей: пороги THRESHOLDS трогаем, только если одна и та же
// ложная подсказка у 2+ людей (правило ночной смены).
export function byCode(allRows) {
  const m = new Map();
  for (const r of allRows) for (const [code, n] of Object.entries(r.hints)) {
    const s = m.get(code) ?? { people: new Set(), n: 0, where: new Set() };
    s.people.add(r.person); s.n += n; s.where.add(r.ex);
    m.set(code, s);
  }
  const out = ['| Подсказка | У скольких людей | Всего раз | В упражнениях |', '|---|---|---|---|'];
  for (const [code, s] of [...m].sort((a, b) => b[1].people.size - a[1].people.size || b[1].n - a[1].n)) {
    out.push(`| ${code} | ${s.people.size} (${[...s.people].join(', ')}) | ${s.n} | ${[...s.where].join(', ')} |`);
  }
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const timeline = args.includes('--timeline');
  let files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) files = readdirSync(FIXTURES).filter((f) => /^(qaita-)?rec-.*\.json$/.test(f)).sort().map((f) => join(FIXTURES, f));
  if (!files.length) { console.error('Нет записей: положите rec-*.json в tests/fixtures/'); process.exit(2); }

  const all = [];
  for (const f of files) {
    const person = personOf(f);
    try {
      const { rows, lines, calibrated } = rowsOf(JSON.parse(readFileSync(f, 'utf8')), person);
      if (!calibrated) console.log(`⚠ ${person}: калибровка в записи не завершилась — упражнений нет`);
      if (timeline) console.log(`\n### ${person}\n\`\`\`\n${lines.join('\n')}\n\`\`\``);
      all.push(...rows);
    } catch (err) {
      console.log(`⚠ ${person}: не удалось прогнать (${err.message})`);
    }
  }
  console.log(`\n## Записи: ${files.length}\n\n${table(all)}\n\n## Подсказки по людям\n\n${byCode(all)}`);
  console.log('\nREPLAY_ALL_OK');
}
