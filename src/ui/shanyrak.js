// Мир «Шаңырақ» [E]: вместо абстрактного сада — свой дом и сад апорта, как казахский войлок (сырмақ, текемет).
// Каждый день занятий добавляет часть юрты: место → кереге (стены) → есік (дверь) → уық (купол) → туырлық (войлок)
// → үзік (крыша) → шаңырақ (венец — символ семьи и дома). Чистые повторы — яблоки апорта на деревьях.
// Всё — свой SVG (без картинок и библиотек): крупные простые формы, тёплые контрастные цвета, «стёжка» по краям.

export const YURT_STAGES = [
  'Место для дома',
  'Кереге — стены',
  'Есік — дверь',
  'Уық — купол',
  'Туырлық — войлок',
  'Үзік — крыша',
  'Шаңырақ — венец дома',
  'Дом готов — семья в сборе',
];
export const YURT_FULL = YURT_STAGES.length - 1;

const C = { red: '#b8412f', ochre: '#e0a33a', teal: '#2f7d74', cream: '#f6ecd6', felt: '#efe2c4', brown: '#7a4b2a', dark: '#4a2e1c', green: '#6f9a5b', green2: '#557f47', sky: '#f8eedb' };
const STITCH = 'stroke="#fff8e8" stroke-width="2" stroke-dasharray="5 4" fill="none" stroke-linecap="round"';

/** Узор «қошқар мүйіз» (бараний рог) — повторяем полосой. */
function hornBand(x, y, w, color, size = 14) {
  const n = Math.floor(w / (size * 2));
  let d = '';
  for (let i = 0; i < n; i++) {
    const cx = x + size + i * size * 2;
    d += `M${cx - size * 0.8},${y + size * 0.5} q0,-${size * 0.9} ${size * 0.8},-${size * 0.5} q${size * 0.8},-${size * 0.4} ${size * 0.8},${size * 0.5} M${cx - size * 0.8},${y + size * 0.5} q-${size * 0.35},0 -${size * 0.35},-${size * 0.35} M${cx + size * 0.8},${y + size * 0.5} q${size * 0.35},0 ${size * 0.35},-${size * 0.35} `;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
}

function yurt(stage, newStage) {
  const cls = (s) => (s === newStage ? ' class="sh-new"' : '');
  const X = 330, L = 228, R = 432, TOP = 176, BASE = 244, CROWN = 116;
  const parts = [];
  // 0 — место: круг на земле
  parts.push(`<ellipse cx="${X}" cy="${BASE + 4}" rx="118" ry="14" fill="#c9b48a" opacity=".55"${cls(0)}/>`);
  if (stage >= 1) { // кереге — решётка стен
    let lat = '';
    for (let x = L; x <= R; x += 17) lat += `M${x},${TOP} L${x + 34},${BASE} M${x + 34},${TOP} L${x},${BASE} `;
    parts.push(`<g${cls(1)}><clipPath id="sh-wall"><rect x="${L}" y="${TOP}" width="${R - L}" height="${BASE - TOP}"/></clipPath><path d="${lat}" stroke="${C.brown}" stroke-width="3.4" clip-path="url(#sh-wall)"/><rect x="${L}" y="${TOP}" width="${R - L}" height="${BASE - TOP}" fill="none" stroke="${C.dark}" stroke-width="3"/></g>`);
  }
  if (stage >= 4) { // туырлық — войлок на стенах (поверх решётки) + полоса орнамента
    parts.push(`<g${cls(4)}><rect x="${L - 2}" y="${TOP}" width="${R - L + 4}" height="${BASE - TOP}" rx="6" fill="${C.felt}"/><rect x="${L - 2}" y="${TOP + 6}" width="${R - L + 4}" height="22" fill="${C.red}"/>${hornBand(L + 4, TOP + 9, R - L - 8, C.ochre, 10)}<rect x="${L + 4}" y="${TOP + 4}" width="${R - L - 8}" height="${BASE - TOP - 8}" rx="4" ${STITCH}/></g>`);
  }
  if (stage >= 2) { // есік — дверь с орнаментом
    parts.push(`<g${cls(2)}><rect x="${X - 22}" y="${BASE - 58}" width="44" height="58" rx="5" fill="${C.ochre}" stroke="${C.dark}" stroke-width="3"/><path d="M${X - 12},${BASE - 40} q12,-12 24,0 M${X - 12},${BASE - 22} q12,-12 24,0" stroke="${C.red}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`);
  }
  if (stage >= 3 && stage < 5) { // уық — шесты купола (видны, пока нет крыши)
    let poles = '';
    for (let i = 0; i <= 12; i++) { const x = L + ((R - L) * i) / 12; poles += `M${x},${TOP} L${X + (x - X) * 0.12},${CROWN + 6} `; }
    parts.push(`<path d="${poles}" stroke="${C.red}" stroke-width="3.4" stroke-linecap="round"${cls(3)}/>`);
  }
  if (stage >= 5) { // үзік — войлок крыши
    parts.push(`<g${cls(5)}><path d="M${L - 8},${TOP + 2} Q${X},${CROWN - 26} ${R + 8},${TOP + 2} Z" fill="${C.cream}" stroke="${C.dark}" stroke-width="3"/><path d="M${L + 10},${TOP - 6} Q${X},${CROWN - 8} ${R - 10},${TOP - 6}" ${STITCH} stroke="#c9a978"/></g>`);
  }
  if (stage >= 6) { // шаңырақ — венец
    parts.push(`<g${cls(6)}><circle cx="${X}" cy="${CROWN + 2}" r="19" fill="${C.ochre}" stroke="${C.dark}" stroke-width="3"/><path d="M${X - 13},${CROWN + 2} H${X + 13} M${X},${CROWN - 11} V${CROWN + 15} M${X - 9},${CROWN - 7} L${X + 9},${CROWN + 11} M${X + 9},${CROWN - 7} L${X - 9},${CROWN + 11}" stroke="${C.red}" stroke-width="3" stroke-linecap="round"/></g>`);
  }
  if (stage >= 7) { // дом готов: дымок из шаңырақа и коврик у двери
    parts.push(`<g${cls(7)}><path class="sh-smoke" d="M${X},${CROWN - 20} c-14,-14 14,-22 0,-38 c-12,-14 12,-22 4,-34" stroke="#d8cdb8" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="${X - 40}" y="${BASE + 2}" width="80" height="12" rx="4" fill="${C.red}"/>${hornBand(X - 36, BASE + 1, 72, C.ochre, 6)}</g>`);
  }
  return parts.join('');
}

/** Дерево апорта: крона-войлок, яблоки (красные — чистые повторы, зелёные — с подсказкой). */
function tree(x, apples, newFrom) {
  const spots = [[-26, -8], [18, -20], [-6, -34], [28, 4], [-30, 16], [4, 0], [-14, 22], [22, 26], [6, -50], [-34, -26]];
  const crown = `<ellipse cx="${x}" cy="186" rx="50" ry="46" fill="${C.green}"/><ellipse cx="${x}" cy="186" rx="42" ry="38" ${STITCH} stroke="#cfe0b9"/><ellipse cx="${x + 14}" cy="170" rx="22" ry="16" fill="${C.green2}" opacity=".5"/>`;
  const fruit = apples.slice(0, spots.length).map((a, i) => {
    const [dx, dy] = spots[i];
    const fill = a === 'flower' ? C.red : '#a8c55a';
    return `<g class="sh-apple${i >= newFrom ? ' sh-new' : ''}" style="--i:${Math.max(0, i - newFrom)}"><circle cx="${x + dx}" cy="${186 + dy}" r="8" fill="${fill}" stroke="${C.dark}" stroke-width="1.6"/><path d="M${x + dx},${178 + dy} q3,-5 7,-5" stroke="${C.dark}" stroke-width="1.8" fill="none"/></g>`;
  }).join('');
  return `<g class="sh-tree"><rect x="${x - 7}" y="214" width="14" height="36" rx="4" fill="${C.brown}"/>${crown}${fruit}</g>`;
}

/**
 * Сцена «Шаңырақ».
 * @param {{ days: number, newToday: boolean, todayPlants: string[], oldPlants: string[], streak: number }} o
 *   days — дней занятий всего (с сегодняшним); newToday — сегодня первый раз (значит, появилась новая часть юрты).
 */
export function shanyrakScene({ days, newToday, todayPlants, oldPlants, streak }) {
  const stage = Math.min(YURT_FULL, days);
  const newStage = newToday ? stage : -1;
  const sunY = 92 - Math.min(streak, 7) * 7; // чем больше дней подряд, тем выше солнце
  // Деревья: одно на каждый день занятий (до 4). Старые яблоки — на первых деревьях, сегодняшние — на последнем.
  const nTrees = Math.max(1, Math.min(4, days));
  const old = nTrees > 1 ? oldPlants.slice(-(nTrees - 1) * 10) : [];
  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    const x = 560 + t * 66 - (nTrees - 1) * 12;
    const last = t === nTrees - 1;
    trees.push(last ? tree(x, todayPlants, 0) : tree(x, old.slice(t * 10, t * 10 + 10), Infinity));
  }
  return `
  <svg class="sh-scene" viewBox="-200 0 1200 300" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Ваш дом: ${YURT_STAGES[stage]}. Яблок сегодня: ${todayPlants.filter((p) => p === 'flower').length}">
    <defs>
      <filter id="sh-felt" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
      <linearGradient id="sh-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e4c4"/><stop offset="1" stop-color="${C.sky}"/></linearGradient>
    </defs>
    <rect x="-200" width="1200" height="300" fill="url(#sh-sky)"/>
    <g filter="url(#sh-felt)">
      <g class="sh-sun"><circle cx="80" cy="${sunY}" r="34" fill="${C.ochre}"/><circle cx="80" cy="${sunY}" r="26" ${STITCH}/></g>
      <path d="M-200,206 C-60,180 40,214 120,204 C230,190 250,196 330,186 C470,172 560,150 800,190 C880,200 940,180 1000,196 V300 H-200 Z" fill="#a9c48c"/>
      <path d="M-200,228 C-80,216 60,236 160,226 C300,214 300,236 420,226 C560,214 680,206 800,222 C880,230 940,214 1000,222 V300 H-200 Z" fill="${C.green}"/>
      <path d="M-200,228 C-80,216 60,236 160,226 C300,214 300,236 420,226 C560,214 680,206 800,222 C880,230 940,214 1000,222" ${STITCH} stroke="#e4efd3"/>
      <g class="sh-yurt">${yurt(stage, newStage)}</g>
      ${trees.join('')}
      <rect x="-200" y="268" width="1200" height="32" fill="${C.red}"/>
      ${hornBand(-194, 272, 1190, C.ochre, 12)}
    </g>
  </svg>`;
}

/** Подпись под сценой: что построено и что появится в следующий день. */
export function yurtCaption(days) {
  const stage = Math.min(YURT_FULL, days);
  if (stage >= YURT_FULL) return 'Дом готов — семья в сборе. Каждое занятие — новые яблоки в саду';
  return `Ваш дом: ${stage} из ${YURT_FULL} · в следующий день — ${YURT_STAGES[stage + 1].split(' — ')[0]}`;
}
