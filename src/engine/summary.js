// Итоги сессии (Summary из контракта) из результатов упражнений. Чистая функция — её гоняют тесты.

/**
 * @param {Array<{id:string, reps:number, quality:number, cleanReps:number, bestRomDeg:number, mistakes:object, corrected:number}>} results
 * @param {{side:'left'|'right', durationSec:number}} meta
 */
export function buildSummary(results, { side, durationSec }) {
  // Одно упражнение могли пройти несколько раз — сливаем по id.
  const byId = new Map();
  for (const r of results) {
    const acc = byId.get(r.id) ?? { id: r.id, reps: 0, cleanReps: 0, qualitySum: 0, bestRomDeg: 0, mistakes: {}, bestRep: null, moments: {} };
    acc.reps += r.reps;
    acc.cleanReps += r.cleanReps ?? 0;
    acc.qualitySum += r.quality * r.reps;
    acc.bestRomDeg = Math.max(acc.bestRomDeg, r.bestRomDeg);
    // Необязательные поля (29.09, «вау»): путь лучшего повтора и стоп-кадры «до/после».
    if (r.bestRep && (!acc.bestRep || r.bestRep.quality > acc.bestRep.quality || (r.bestRep.quality === acc.bestRep.quality && r.bestRep.romDeg > acc.bestRep.romDeg))) acc.bestRep = r.bestRep;
    if (r.moments) acc.moments = { ...r.moments, ...acc.moments };
    for (const [code, n] of Object.entries(r.mistakes)) acc.mistakes[code] = (acc.mistakes[code] ?? 0) + n;
    byId.set(r.id, acc);
  }
  const merged = [...byId.values()];
  const exercises = merged.map(({ qualitySum, cleanReps, ...e }) => ({ ...e, quality: e.reps ? qualitySum / e.reps : 0 }));
  const totalReps = exercises.reduce((s, e) => s + e.reps, 0);
  const cleanReps = merged.reduce((s, e) => s + e.cleanReps, 0);
  return {
    side,
    durationSec,
    exercises,
    totalReps,
    // Контракт: «доля повторов без ошибок». Чистый повтор — quality ≥ 0.9 (session.js, CLEAN_QUALITY).
    accuracy: totalReps ? cleanReps / totalReps : 0,
    mistakesCorrected: results.reduce((s, r) => s + r.corrected, 0),
  };
}
