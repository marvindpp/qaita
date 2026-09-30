const fs = require('fs'), path = require('path');
const dir = process.argv[2]; const verbose = process.argv[3] === 'v'; const g59 = process.argv[4] === 'g59';
const all = {};
for (const f of fs.readdirSync(dir).filter((f) => /^report-.*\.json$/.test(f) && f.includes('g59') === g59)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, f))).report);
const sizes = ['852x283', '852x393', '915x412', '740x360', '393x852', '1024x768', '1366x768', '1440x900'];
const states = [...new Set(Object.keys(all).map((k) => k.split('|')[1]))];
const PAT_EX = new Set(['doctor', 'progress']);
let wrapsTotal = 0;
const cell = (r, st) => {
  if (!r) return '-';
  const bad = []; const w = r.wraps.filter((x) => !x.allowed); wrapsTotal += w.length;
  if (r.zoom < 0.695) bad.push('z' + r.zoom.toFixed(2));
  if (w.length) bad.push('W' + w.length);
  if (r.cut.length) bad.push('C' + r.cut.length);
  if (r.over.length) bad.push('O' + r.over.length);
  if (r.issues.length) bad.push('X');
  if (!PAT_EX.has(st) && r.minFs < 13.95) bad.push('f' + r.minFs);
  if (r.zoom2 && (r.zoom2 !== r.zoom || r.zoom3 !== r.zoom)) bad.push('J');
  return bad.length ? bad.join(' ') : 'ok' + (r.zoom < 1 ? ' ' + r.zoom.toFixed(2) : '');
};
console.log(['state', ...sizes].join(' | '));
for (const st of states) console.log([st, ...sizes.map((s) => cell(all[`${s}|${st}`], st))].join(' | '));
console.log('wraps total (not allowed):', wrapsTotal);
if (verbose) for (const [k, r] of Object.entries(all)) {
  const w = r.wraps.filter((x) => !x.allowed);
  if (w.length || r.cut.length || r.over.length || r.issues.length || r.minFs < 14 || r.zoom < 0.7) console.log(k, 'z', r.zoom, 'min', r.minFs, r.minEl, r.cam || '', r.ring || '', r.badge || '', '\n  W', w.map((x) => x.el).join(' ; '), '\n  C', r.cut.join(' ; '), '\n  O', r.over.join(' ; '), '\n  X', r.issues.join(';'), r.scrollV);
}
