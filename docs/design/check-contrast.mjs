// Проверка контраста палитры по WCAG 2.1 (relative luminance). Запуск: node docs/design/check-contrast.mjs
// AA: обычный текст ≥ 4.5, крупный (≥ 24px или ≥ 18.66px жирный) ≥ 3.
const THEMES = {
  light: { bg: '#FBF6EF', surface: '#FFFFFF', text: '#2B2622', muted: '#5E554D', ok: '#1F7A4D', err: '#B3412E', accent: '#9A5B13', 'on-ok': '#FFFFFF', 'on-err': '#FFFFFF', 'ok-soft': '#DDF1E4', 'err-soft': '#FBE3DC' },
  dark: { bg: '#1C1916', surface: '#2A2521', text: '#F5EEE6', muted: '#C9BDB0', ok: '#5CC98E', err: '#F08A78', accent: '#F0B45C', 'on-ok': '#10281B', 'on-err': '#2E0F09', 'ok-soft': '#1E3A2A', 'err-soft': '#43231C' },
};
const PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'],
  ['ok', 'bg'], ['ok', 'surface'], ['err', 'bg'], ['err', 'surface'], ['accent', 'bg'], ['accent', 'surface'],
  ['on-ok', 'ok'], ['on-err', 'err'], ['text', 'ok-soft'], ['text', 'err-soft'],
];

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let fail = 0;
for (const [name, t] of Object.entries(THEMES)) {
  console.log(`\n${name}`);
  for (const [fg, bg] of PAIRS) {
    const c = contrast(t[fg], t[bg]);
    const ok = c >= 4.5;
    if (!ok) fail += 1;
    console.log(`  ${fg.padEnd(8)} на ${bg.padEnd(9)} ${c.toFixed(2).padStart(5)}  ${c >= 7 ? 'AAA' : ok ? 'AA' : 'FAIL'}`);
  }
}
console.log(fail ? `\n${fail} пар не проходят AA` : '\nВсе пары проходят AA (≥ 4.5:1)');
process.exitCode = fail ? 1 : 0;
