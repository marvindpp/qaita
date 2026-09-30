// Проверка телефона (ночь 5): скриншоты экранов × размеров + детектор переносов, перекрытий, обрезки, мелкого шрифта.
// Запуск: npm run dev -- --port 4511, затем node docs/screens/night5-phone/phone-check.cjs <папка> <размер|all> <экран|all> [g59]
// g59 — поля 59px (вырез iPhone). Сводка: node docs/screens/night5-phone/phone-summary.cjs <папка> [v] [g59]
// Прогон всех экранов × размеров: скриншоты + проверки (переносы, перекрытия, обрезка, шрифт, прокрутка вбок).
// node cap.cjs <outDir> [sizesFilter] [statesFilter] [gutter59]
const { execSync } = require('child_process');
const pw = require(execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'out';
const SIZE_F = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null;
const STATE_F = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null;
const G59 = process.argv[5] === 'g59';
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  ['852x283', 852, 283, true], ['852x393', 852, 393, true], ['915x412', 915, 412, true], ['740x360', 740, 360, true],
  ['393x852', 393, 852, true], ['1024x768', 1024, 768, true], ['1366x768', 1366, 768, false], ['1440x900', 1440, 900, false],
].filter((s) => !SIZE_F || SIZE_F.includes(s[0]));

const BASE = (process.env.BASE || 'http://localhost:4511') + '/?mock=1&nopanel&calibrated';
const PROFILE = { name: 'Айгуль', avatar: '👵', asked: true };
const day = (d) => { const t = new Date(Date.now() - d * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const HISTORY = [3, 2, 1].map((d) => ({
  date: new Date(Date.now() - d * 864e5).toISOString(), day: day(d), side: 'right', durationSec: 180, totalReps: 9, accuracy: 0.8,
  mistakesCorrected: 2, exercises: [], score: 600, stars: 6, maxStars: 9,
  beds: [{ id: 'open_hand', plants: ['flower', 'sprout', 'flower'] }, { id: 'hand_to_mouth', plants: ['flower', 'flower', 'sprout'] }, { id: 'reach_up', plants: ['flower', 'flower', 'flower'] }],
}));
const RESULTS = [
  { exercise: 'open_hand', score: 300, stars: 3, plants: ['flower', 'flower', 'flower'] },
  { exercise: 'hand_to_mouth', score: 250, stars: 2, plants: ['flower', 'sprout', 'flower'] },
  { exercise: 'reach_up', score: 200, stars: 2, plants: ['sprout', 'flower', 'flower'] },
];

const go = (name, params) => async (p) => { await p.evaluate(([n, pr]) => window.qaita.ctx.go(n, pr), [name, params ?? {}]); await p.waitForTimeout(1600); };
const seedGarden = async (p) => { await p.evaluate((r) => { window.qaita.ctx.state.session = { results: r }; }, RESULTS); };

const STATES = [
  ['welcome-name', { fresh: true }, async (p) => { await p.waitForTimeout(1500); }],
  ['welcome', {}, async (p) => { await p.waitForTimeout(1500); }],
  ['welcome-loading', {}, async (p) => { await p.waitForTimeout(800); await p.evaluate(() => { const s = document.querySelector('.welcome'); s.querySelector('.welcome-go').dataset.loading = 'true'; s.querySelector('.ring-label').textContent = 'Готовлю распознавание…'; s.querySelector('.ring-sub').textContent = 'Совет: Камера — на уровне груди, примерно в метре'; }); await p.waitForTimeout(300); }],
  ['menu', {}, async (p) => { await p.waitForTimeout(800); await p.click('.burger'); await p.waitForTimeout(500); }],
  ['prep', {}, async (p) => { await go('prep')(p); await p.waitForTimeout(2600); }],
  ['hand', {}, go('hand')],
  ['goal', {}, go('goal')],
  ['calibration', {}, async (p) => { await go('calibration')(p); await p.waitForTimeout(1500); }],
  ['demo', {}, go('demo', { index: 0 })],
  ['play', { auto: true }, async (p) => { await go('play', { index: 0 })(p); await p.waitForTimeout(2500); }],
  ['play-mistake', { auto: true }, async (p) => {
    await go('play', { index: 0 })(p); await p.keyboard.press('m');
    await p.waitForSelector('.play[data-hint="mistake"]', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(400);
  }],
  ['rest', { auto: true }, async (p) => { await go('play', { index: 0 })(p); await p.waitForTimeout(1000); await p.keyboard.press('r'); await p.waitForTimeout(900); }],
  ['pause', { auto: true }, async (p) => { await go('play', { index: 0 })(p); await p.evaluate(() => { const e = document.querySelector('.pause'); e.dataset.show = 'true'; e.querySelector('h2').textContent = 'Отдохните'; e.querySelector('.pause-card > p').innerHTML = 'Рука устала — это нормально.<br>Опустите её и подышите.'; }); await p.waitForTimeout(500); }],
  ['xdone', {}, go('exercise-done', { index: 0, result: { stars: 2, plants: ['flower', 'sprout', 'flower'], corrected: 1, bonus: 50, score: 250 } })],
  ['xdone-moments', {}, async (p) => {
    const img = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#556'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#dcb'; g.beginPath(); g.arc(160, 90, 40, 0, 7); g.fill(); return c.toDataURL('image/jpeg'); });
    await go('exercise-done', { index: 0, result: { stars: 2, plants: ['flower', 'sprout', 'flower'], corrected: 1, bonus: 50, score: 250 }, moments: { mistake: { image: img, message: 'Плечо поднято к уху. Опустите!' }, good: { image: img } } })(p);
  }],
  ['checkin', {}, go('checkin')],
  ['garden', {}, async (p) => { await seedGarden(p); await go('garden')(p); await p.waitForTimeout(1200); }],
  ['garden-share', {}, async (p) => { await seedGarden(p); await go('garden')(p); await p.click('[data-act="share"]'); await p.waitForTimeout(700); }],
  ['garden-voice', {}, async (p) => { await seedGarden(p); await go('garden')(p); await p.click('[data-act="voice"]'); await p.waitForTimeout(700); }],
  ['doctor', {}, go('doctor')],
  ['progress', {}, go('progress')],
  ['profile', {}, go('profile')],
  ['about', {}, go('about')],
].filter((s) => !STATE_F || STATE_F.includes(s[0]));

const FONT_CACHE = new Map();
const PATIENT_EXEMPT = new Set(['doctor', 'progress']);

// Проверки внутри страницы
function audit(stateName) {
  const vw = innerWidth, vh = innerHeight;
  const vis = (e) => { if (!e || !e.isConnected) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const visDeep = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const zoomOf = (e) => { let z = 1; for (let x = e; x; x = x.parentElement) { const v = parseFloat(getComputedStyle(x).zoom); if (v && v !== 1) z *= v; } return z; };
  const scr = [...document.querySelectorAll('#stage > .screen')].at(-1);
  const sheet = document.querySelector('.sheet');
  const drawerOpen = document.querySelector('.drawer[data-open="true"]');
  const pauseOn = scr?.querySelector('.pause[data-show="true"]');
  const root = sheet || (drawerOpen ? drawerOpen.querySelector('.drawer-panel') : (pauseOn || scr));
  const res = { zoom: +(scr?.style.zoom || 1), issues: [] };
  const label = (e) => { const t = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40); return `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}「${t}」`; };
  // 1. переносы
  const SEL = 'button, .chip, .ring-label, .ring-sub, h1, h2, .stat span, .award b, .drawer li button, .pill, .goal-btn, .btn-family, .life-task b, .hud-ex, .demo-step, .steps li, .rule, .combo, .share-btn, .who-btn, .switch, .moods button, .name-ask-q';
  const wraps = [];
  for (const e of root?.querySelectorAll(SEL) ?? []) {
    if (!visDeep(e)) continue;
    if (e.closest('.mock-panel')) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize) * zoomOf(e);
    // группируем строки по «блоку» (ближайший предок с блочной раскладкой): b и small в кнопке — это две строки по задумке, не перенос
    const byBlock = new Map();
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      if (n.parentElement.closest('[aria-hidden="true"], .share-ico, .mirror-ico')) continue;
      let blk = n.parentElement;
      while (blk !== e && /^(inline|contents)$/.test(getComputedStyle(blk).display)) blk = blk.parentElement;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const arr = byBlock.get(blk) ?? []; byBlock.set(blk, arr);
      for (const r of rg.getClientRects()) if (r.width > 0.5) arr.push(r.bottom);
    }
    let groups = 1;
    for (const [, bottoms] of byBlock) {
      bottoms.sort((a, b) => a - b);
      let g = 0, last = -1e9;
      for (const b of bottoms) { if (b - last > 0.8 * fs) { g += 1; last = b; } }
      groups = Math.max(groups, g);
    }
    if (groups > 1) {
      const big = /^H[12]$/.test(e.tagName) && (vw < 600 || fs >= 40);
      wraps.push({ el: label(e), lines: groups, allowed: big });
    }
  }
  res.wraps = wraps;
  // 2. прокрутка вбок
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) res.issues.push(`page scrollWidth ${sw} > ${vw}`);
  if (scr && scr.scrollWidth > scr.clientWidth + 2 && getComputedStyle(scr).overflowX !== 'hidden') res.issues.push(`screen scrollX ${scr.scrollWidth}>${scr.clientWidth}`);
  // 3. обрезано (для экранов без прокрутки — всё в пределах экрана)
  const scrollable = scr && (scr.scrollHeight > scr.clientHeight + 2);
  res.scrollV = scrollable ? `${scr.scrollHeight}/${scr.clientHeight}` : '';
  const cut = [];
  for (const e of root?.querySelectorAll('h1, h2, p, button, .ring, .cam, .chip, .pill, .badge, .hud-count, .score, .hint, .garden-scene, .moment, .rule, .xdone-bed, .steps li, .demo-card, .share-btn, .tile, .life-task, .life-dose') ?? []) {
    if (!visDeep(e) || e.closest('.mock-panel')) continue;
    // внутри прокручиваемого контейнера — не считаем
    let inScroll = false;
    const scrollOk = scr && (scr.matches('.progress, .profile, .about, .doctor'));
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { if (x === scr && !scrollOk) continue; const cs = getComputedStyle(x); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && x.scrollHeight > x.clientHeight + 2) { inScroll = true; break; } }
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) cut.push(`${label(e)} x:${Math.round(r.left)}..${Math.round(r.right)}`);
    else if (!inScroll && (r.bottom > vh + 1 || r.top < -1)) cut.push(`${label(e)} y:${Math.round(r.top)}..${Math.round(r.bottom)}`);
  }
  res.cut = cut;
  // 4. перекрытия: бургер, плашка звука, «Вижу вас», статус-тост, повтор
  const overlays = [
    ['burger', document.querySelector('.burger:not([hidden])')],
    ['audio', document.querySelector('.audio-chip[data-show="true"]')],
    ['toast', document.querySelector('#status-toast[data-show="true"]')],
    ['badge', scr?.querySelector('.cam[data-seen="true"] .cam-badge')],
  ].filter(([, e]) => e && vis(e));
  const over = [];
  if (!sheet && !drawerOpen && !pauseOn) {
    const targets = [...(scr?.querySelectorAll('h1, h2, p, button, .ring, .chip, .pill, .badge, .hud-count, .score, .combo, .bed, .hint, .ring-label, .steps li, .rule, .demo-step, .count, .hud-ex, .goal-btn, .life-task, .life-dose, .moment, .xdone-stars') ?? [])].filter((e) => visDeep(e) && !e.closest('.cam'));
    for (const [nm, o] of overlays) {
      const a = o.getBoundingClientRect();
      for (const t of targets) {
        if (t.contains(o) || o.contains(t)) continue;
        let b = t.getBoundingClientRect();
        if (/^(H1|H2|P|SPAN)$/.test(t.tagName) && !t.querySelector('.float-pts')) { const rg = document.createRange(); rg.selectNodeContents(t); const rr = rg.getBoundingClientRect(); if (rr.width > 0) b = rr; }
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) over.push(`${nm}×${label(t)}`);
      }
    }
    // «Вижу вас» закрывает лицо: верхняя центральная часть кадра (30–70% ширины, 5–55% высоты)
    const badge = overlays.find(([n]) => n === 'badge');
    if (badge) {
      const cam = badge[1].closest('.cam').getBoundingClientRect(), a = badge[1].getBoundingClientRect();
      const face = { left: cam.left + cam.width * 0.3, right: cam.left + cam.width * 0.7, top: cam.top + cam.height * 0.05, bottom: cam.top + cam.height * 0.55 };
      const w = Math.min(a.right, face.right) - Math.max(a.left, face.left), h = Math.min(a.bottom, face.bottom) - Math.max(a.top, face.top);
      if (w > 2 && h > 2) over.push('badge×ЛИЦО');
      res.badge = `${Math.round(a.width)}×${Math.round(a.height)} в кадре ${Math.round(cam.width)}×${Math.round(cam.height)}`;
    }
    // overlays между собой
    for (let i = 0; i < overlays.length; i++) for (let j = i + 1; j < overlays.length; j++) {
      const a = overlays[i][1].getBoundingClientRect(), b = overlays[j][1].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 2) over.push(`${overlays[i][0]}×${overlays[j][0]}`);
    }
  }
  if (sheet) {
    for (const [nm, o] of overlays) {
      if (getComputedStyle(o).display === 'none') continue;
      const a = o.getBoundingClientRect();
      for (const t of sheet.querySelectorAll('button, h2, p, textarea')) {
        if (!visDeep(t)) continue;
        const b = t.getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) over.push(`${nm}×sheet ${label(t)}`);
      }
    }
  }
  res.over = over;
  // 5. минимальный шрифт (с учётом zoom)
  let minFs = 99, minEl = '';
  for (const e of root?.querySelectorAll('*') ?? []) {
    if (!visDeep(e) || e.closest('.mock-panel, svg, .cam-wait')) continue;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const f = parseFloat(getComputedStyle(e).fontSize) * zoomOf(e);
    if (f < minFs) { minFs = f; minEl = label(e); }
  }
  res.minFs = Math.round(minFs * 10) / 10; res.minEl = minEl;
  // размеры ключевого
  const cam = scr?.querySelector('.cam'); if (cam && visDeep(cam)) { const r = cam.getBoundingClientRect(); res.cam = `${Math.round(r.width)}×${Math.round(r.height)}`; }
  const ring = scr?.querySelector('.welcome-go .ring, .garden-go .ring'); if (ring) { const r = ring.getBoundingClientRect(); res.ring = Math.round(r.width); }
  return res;
}

(async () => {
  const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const report = {};
  const errors = [];
  for (const [sname, w, h, mobile] of SIZES) {
    for (const [st, opt, fn] of STATES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ru-RU', ignoreHTTPSErrors: true });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
        const u = route.request().url();
        if (!FONT_CACHE.has(u)) { const r = await route.fetch(); FONT_CACHE.set(u, { status: r.status(), headers: r.headers(), body: await r.body() }); }
        const c = FONT_CACHE.get(u); await route.fulfill({ status: c.status, headers: c.headers, body: c.body });
      });
      await ctx.addInitScript(([fresh, prof, hist]) => {
        if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
        localStorage.clear();
        if (!fresh) {
          localStorage.setItem('qaita.profile.v1', JSON.stringify(prof));
          localStorage.setItem('qaita.sessions.v1', JSON.stringify(hist));
          localStorage.setItem('qaita.goal.v1', JSON.stringify('cup'));
        }
      }, [Boolean(opt.fresh), PROFILE, HISTORY]);
      if (G59) await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--gutter:59px !important}'; document.head.append(s); }); });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${sname} ${st}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(`${sname} ${st}: console ${m.text()}`); });
      const url = BASE + (opt.auto ? '&speed=2' : '&manual');
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.qaita, null, { timeout: 15000 });
      await page.waitForFunction(() => [...document.fonts].some((f) => f.family.includes('Manrope') && f.status === 'loaded'), null, { timeout: 20000 }).catch(() => errors.push(`${sname} ${st}: no Manrope`));
      await page.waitForTimeout(opt.fresh ? 600 : 2200);
      try { await fn(page); } catch (e) { errors.push(`${sname} ${st}: step ${e.message.split('\n')[0]}`); }
      await page.waitForTimeout(300);
      const r = await page.evaluate(audit, st);
      await page.screenshot({ path: path.join(OUT, `${st}__${sname}${G59 ? "-g59" : ""}.png`), scale: 'css' });
      // повторное открытие: масштаб тот же?
      if (['welcome', 'hand', 'garden', 'prep'].includes(st)) {
        const cur = await page.evaluate(() => document.body.dataset.screen);
        await page.evaluate((n) => window.qaita.ctx.go(n), cur === 'welcome' ? 'about' : 'welcome'); await page.waitForTimeout(900);
        if (st === 'garden') await page.evaluate(() => { window.qaita.ctx.state.session.record = window.qaita.ctx.state.session.record; });
        await page.evaluate((n) => window.qaita.ctx.go(n), cur); await page.waitForTimeout(1600);
        r.zoom2 = await page.evaluate(() => +([...document.querySelectorAll('#stage > .screen')].at(-1).style.zoom || 1));
        await page.evaluate((n) => window.qaita.ctx.go(n), cur === 'welcome' ? 'about' : 'welcome'); await page.waitForTimeout(900);
        await page.evaluate((n) => window.qaita.ctx.go(n), cur); await page.waitForTimeout(1600);
        r.zoom3 = await page.evaluate(() => +([...document.querySelectorAll('#stage > .screen')].at(-1).style.zoom || 1));
        // вернуть исходный вид для скриншота не нужно — скриншот делаем до
      }
      report[`${sname}|${st}`] = r;
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `report-${process.argv[3] || 'all'}-${process.argv[4] || 'all'}${G59 ? '-g59' : ''}.json`), JSON.stringify({ report, errors }, null, 1));
  console.log('errors:', errors.length); errors.slice(0, 30).forEach((e) => console.log('  ', e));
})();
