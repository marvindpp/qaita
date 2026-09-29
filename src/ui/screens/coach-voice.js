// «Голос тренера» [E]: студия, где живой человек (с его согласия) записывает фразы тренера. Записи сразу звучат
// в приложении на этом устройстве (voice.js), а «Скачать всё» отдаёт один файл — его кладём в проект
// (public/voice/), и живой голос слышат все. Фразы без записи говорит голос браузера, как раньше.
// Управление мышью/клавиатурой: здесь записывает помощник, а не пациент перед камерой.
import { html, esc } from '../dom.js';
import { LINES, lineKey } from '../voice-lines.js';
import { localClips, saveClip, deleteClip, cleanRecording } from '../voice-clips.js';
import '../../../styles/landing.css';
import '../../../styles/coach-voice.css';

const MAX_MS = 12000;

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export default function coachVoice(ctx) {
  const el = html(`
    <section class="coach-voice" aria-labelledby="cv-title">
      <header class="page-head"><h1 id="cv-title">🎙 Голос тренера</h1>
        <p class="lead">Запишите фразы живым голосом — Qaita будет говорить им вместо голоса робота.</p></header>
      <div class="page-scroll">
        <section class="card cv-card" aria-live="polite">
          <p class="cv-count">Фраза <b data-f="n">1</b> из ${LINES.length} · записано <b data-f="done">0</b></p>
          <div class="cv-bar" aria-hidden="true"><span></span></div>
          <p class="cv-line" data-f="line"></p>
          <div class="cv-controls">
            <button type="button" class="cv-nav" data-act="prev" aria-label="Предыдущая фраза">←</button>
            <button type="button" class="rec-btn" data-act="rec" aria-label="Записать"><span class="rec-dot"></span></button>
            <button type="button" class="cv-nav" data-act="next" aria-label="Следующая фраза">→</button>
          </div>
          <p class="cv-status" data-f="status"></p>
          <div class="cv-row">
            <button type="button" class="btn-ghost" data-act="play">▶ Послушать</button>
            <button type="button" class="btn-ghost" data-act="del" hidden>🗑 Удалить запись</button>
          </div>
          <p class="cv-keys">Пробел — запись/стоп · → дальше · ← назад · P — послушать</p>
        </section>
        <details class="card cv-tips">
          <summary>Как записать хорошо</summary>
          <ul>
            <li>Тихая комната, телефон или ноутбук в 20–30 см ото рта.</li>
            <li>Говорите спокойно и тепло, чуть медленнее обычного — как добрый врач пожилому человеку.</li>
            <li>Нажмите запись, подождите полсекунды, прочитайте фразу, нажмите стоп. Тишину по краям уберём сами.</li>
            <li>Не понравилось — просто запишите ещё раз, новая запись заменит старую.</li>
            <li>Записывайте только свой голос или голос человека, который согласен, чтобы его слышали в Qaita.</li>
          </ul>
        </details>
        <section class="card cv-all" aria-labelledby="cv-all-title">
          <h2 id="cv-all-title">Все фразы</h2>
          <ol class="cv-list">${LINES.map((t, i) => `<li><button type="button" data-i="${i}">${esc(t)}</button></li>`).join('')}</ol>
        </section>
      </div>
      <div class="page-actions">
        <button type="button" class="btn-start" data-act="download">⬇ Скачать всё</button>
        <button type="button" class="btn-ghost" data-act="home">Готово</button>
      </div>
    </section>`);

  const $ = (s) => el.querySelector(s);
  const recBtn = $('[data-act="rec"]');
  const status = (t) => { $('[data-f="status"]').textContent = t; };
  const listBtns = [...el.querySelectorAll('.cv-list button')];
  let done = new Set();
  let i = 0;
  let stream = null, rec = null, chunks = [], timer = 0, busy = false, alive = true;
  let preview = null;

  function render() {
    $('[data-f="n"]').textContent = String(i + 1);
    $('[data-f="done"]').textContent = String(done.size);
    $('.cv-bar span').style.width = `${(done.size / LINES.length) * 100}%`;
    $('[data-f="line"]').textContent = LINES[i];
    const has = done.has(lineKey(LINES[i]));
    el.querySelector('.cv-card').dataset.has = String(has);
    $('[data-act="del"]').hidden = !has;
    $('[data-act="download"]').disabled = !done.size;
    $('[data-act="download"]').textContent = done.size ? `⬇ Скачать всё (${done.size})` : '⬇ Скачать всё';
    listBtns.forEach((b, k) => { b.dataset.has = String(done.has(lineKey(LINES[k]))); b.setAttribute('aria-current', String(k === i)); });
    if (!rec && !busy) status(has ? '✓ Записано. Можно послушать или записать заново.' : 'Нажмите красный круг и прочитайте фразу.');
  }
  const go = (k) => { if (rec || busy) return; i = (k + LINES.length) % LINES.length; render(); };

  async function refresh() {
    const own = await localClips();
    done = new Set(own.keys());
    return own;
  }

  async function start() {
    if (rec || busy) return;
    ctx.voice.stop();
    preview?.pause();
    try {
      stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      status('Нет доступа к микрофону — разрешите его в адресной строке браузера.');
      return;
    }
    if (!alive) return;
    chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = finish;
    rec.start();
    recBtn.dataset.on = 'true';
    recBtn.setAttribute('aria-label', 'Остановить запись');
    const t0 = performance.now();
    const tick = () => {
      const s = (performance.now() - t0) / 1000;
      status(`● Запись ${Math.floor(s)} с — читайте фразу, потом нажмите ещё раз`);
      if (s * 1000 >= MAX_MS) stop();
    };
    tick();
    timer = setInterval(tick, 250);
  }
  function stop() {
    clearInterval(timer);
    if (rec?.state === 'recording') rec.stop();
  }
  async function finish() {
    const type = rec.mimeType;
    rec = null;
    recBtn.dataset.on = 'false';
    recBtn.setAttribute('aria-label', 'Записать');
    if (!alive) return;
    busy = true;
    status('Обрабатываю…');
    const text = LINES[i];
    try {
      const wav = await cleanRecording(new Blob(chunks, { type }));
      await saveClip(text, wav);
      await refresh();
      await ctx.voice.reloadClips?.();
      busy = false;
      render();
      status('✓ Записано — слушайте. Хорошо? Жмите → дальше. Нет — запишите ещё раз.');
      playBlob(wav);
    } catch (e) {
      busy = false;
      render();
      status(/Тишина/.test(e?.message) ? 'Не слышно голоса — проверьте микрофон и говорите ближе.' : 'Не получилось сохранить — попробуйте ещё раз.');
    }
  }
  function playBlob(blob) {
    preview?.pause();
    preview = new Audio(URL.createObjectURL(blob));
    preview.play().catch(() => {});
  }
  async function play() {
    if (rec || busy) return;
    const own = await localClips();
    const clip = own.get(lineKey(LINES[i]));
    // Есть запись — её; нет — как сейчас говорит приложение (голос браузера или общая запись).
    if (clip) { ctx.voice.stop(); playBlob(clip.blob); } else ctx.voice.say(LINES[i], { interrupt: true, force: true });
  }
  async function download() {
    const own = await localClips();
    if (!own.size) return;
    status('Готовлю файл…');
    const clips = [];
    for (const [key, v] of own) clips.push({ key, text: v.text, wav: await blobToBase64(v.blob) });
    const file = new Blob([JSON.stringify({ app: 'qaita', kind: 'coach-voice', v: 1, at: new Date().toISOString(), clips })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `qaita-golos-trenera-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    status(`Файл скачан: ${own.size} ${own.size === 1 ? 'фраза' : 'фраз'}. Пришлите его Claude — и живой голос услышат все.`);
  }

  recBtn.addEventListener('click', () => (rec ? stop() : start()));
  $('[data-act="prev"]').addEventListener('click', () => go(i - 1));
  $('[data-act="next"]').addEventListener('click', () => go(i + 1));
  $('[data-act="play"]').addEventListener('click', play);
  $('[data-act="del"]').addEventListener('click', async () => { await deleteClip(LINES[i]); await refresh(); await ctx.voice.reloadClips?.(); render(); });
  $('[data-act="download"]').addEventListener('click', download);
  $('[data-act="home"]').addEventListener('click', () => ctx.go('welcome'));
  listBtns.forEach((b) => b.addEventListener('click', () => { go(Number(b.dataset.i)); $('.cv-card').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) (rec ? stop() : start()); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); go(i - 1); }
    else if (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'з') { e.stopImmediatePropagation(); play(); }
  };
  // Раньше обработчиков мок-панели (пробел там — жест), чтобы клавиши студии не уходили в игру.
  window.addEventListener('keydown', onKey, { capture: true });

  render();

  // Музыка записалась бы вместе с голосом — выключаем на время студии.
  const musicWasOn = ctx.music?.on;
  if (musicWasOn) ctx.music.set(false);

  return {
    el,
    noFit: true,
    async enter() {
      ctx.voice.stop();
      await refresh();
      if (!alive) return;
      // Начинаем с первой незаписанной фразы.
      const first = LINES.findIndex((t) => !done.has(lineKey(t)));
      i = first < 0 ? 0 : first;
      render();
    },
    destroy() {
      alive = false;
      clearInterval(timer);
      if (rec?.state === 'recording') rec.stop();
      stream?.getTracks().forEach((t) => t.stop());
      preview?.pause();
      window.removeEventListener('keydown', onKey, { capture: true });
      if (musicWasOn) ctx.music.set(true);
    },
  };
}
