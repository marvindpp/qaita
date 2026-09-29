// Семья рядом (PLAN §9г): «Отправить детям» (WhatsApp / Telegram / картинкой) и «Голос близких» —
// внук или дочь записывает несколько слов поддержки, они звучат в конце каждого занятия.
// Всё хранится только в этом браузере (IndexedDB), никуда не отправляется, пока человек сам не нажмёт «Отправить».
import { html, esc, plural } from './dom.js';
import { recordVoice } from './life.js';

const SITE = 'https://marvindpp.github.io/qaita/';
const WHO = [
  { id: 'grandson', label: 'Внук', from: 'от внука' },
  { id: 'granddaughter', label: 'Внучка', from: 'от внучки' },
  { id: 'daughter', label: 'Дочь', from: 'от дочери' },
  { id: 'son', label: 'Сын', from: 'от сына' },
  { id: 'other', label: 'Другой близкий', from: 'от близких' },
];
const IDEAS = ['«Бабуля, я тобой горжусь!»', '«Папа, ты справишься, мы рядом»', '«Мама, ещё немного — и снова испечём пирог вместе»'];
const MAX_MS = 20000;

// ——— хранилище посланий ———
function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('qaita', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('voice');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function get(key) {
  try {
    const d = await db();
    return await new Promise((res) => { const q = d.transaction('voice').objectStore('voice').get(key); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); });
  } catch { return null; }
}
async function put(key, val) {
  try {
    const d = await db();
    await new Promise((res, rej) => { const tx = d.transaction('voice', 'readwrite'); tx.objectStore('voice').put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  } catch { return false; }
}
/** Все послания: [{ who, at, blob }]. Старая одиночная запись («family») тоже подхватывается. */
export async function listMessages() {
  const list = (await get('messages')) ?? [];
  const old = await get('family');
  if (old && !list.length) list.push({ who: 'other', at: 0, blob: old });
  return list;
}
async function addMessage(msg) {
  const list = (await get('messages')) ?? [];
  list.push(msg);
  return put('messages', list.slice(-6));
}
/** Какое послание сыграть сегодня: по кругу, чтобы звучали разные. */
/** Удалить послание по индексу (в профиле). */
export async function removeMessage(i) {
  const list = await listMessages();
  list.splice(i, 1);
  await put('messages', list);
  if (!list.length) await put('family', null);
}
export const whoLabel = (who) => WHO.find((w) => w.id === who)?.label ?? 'Близкий';

export async function nextMessage() {
  const list = await listMessages();
  if (!list.length) return null;
  let i = 0;
  try { i = (Number(localStorage.getItem('qaita.msgIdx')) || 0) % list.length; localStorage.setItem('qaita.msgIdx', String(i + 1)); } catch { /* приватный режим */ }
  return list[i];
}
const fromText = (who) => WHO.find((w) => w.id === who)?.from ?? 'от близких';

function overlay(root, inner) {
  const el = html(`<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-card">${inner}<button type="button" class="sheet-close" aria-label="Закрыть">✕</button></div></div>`);
  root.append(el);
  const close = () => el.remove();
  el.querySelector('.sheet-close').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  el.querySelector('.sheet-card').animate([{ transform: 'translateY(24px) scale(0.98)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  return { el, close };
}

// ——— «Отправить детям» ———
/**
 * @param {HTMLElement} root
 * @param {{ text: string, makeBlob: () => Promise<Blob>, onSent?: (where:string) => void }} o
 */
export function openShareSheet(root, { text, makeBlob, onSent }) {
  const { el, close } = overlay(root, `
    <h2>Отправить детям</h2>
    <p class="sheet-sub">Можно дописать своё — и выбрать, кому отправить</p>
    <textarea class="share-text" rows="5">${esc(text)}</textarea>
    <div class="share-grid">
      <button type="button" class="share-btn" data-to="wa"><span class="share-ico" style="background:#25d366">✆</span>WhatsApp</button>
      <button type="button" class="share-btn" data-to="tg"><span class="share-ico" style="background:#229ed9">✈</span>Telegram</button>
      <button type="button" class="share-btn" data-to="img"><span class="share-ico" style="background:#f2b42a">🖼</span>Открытка</button>
      <button type="button" class="share-btn" data-to="copy"><span class="share-ico" style="background:#6b7a72">📋</span>Скопировать</button>
    </div>
    <p class="sheet-note">WhatsApp и Telegram откроют список чатов — выберите, кому отправить.</p>`);
  const ta = el.querySelector('.share-text');
  el.querySelectorAll('.share-btn').forEach((b) => b.addEventListener('click', async () => {
    const msg = ta.value.trim();
    const to = b.dataset.to;
    if (to === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    if (to === 'tg') window.open(`https://t.me/share/url?url=${encodeURIComponent(SITE)}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    if (to === 'copy') { try { await navigator.clipboard.writeText(msg); b.lastChild.textContent = 'Скопировано ✓'; } catch { ta.select(); } return; }
    if (to === 'img') {
      b.disabled = true;
      const blob = await makeBlob();
      const file = new File([blob], 'qaita.png', { type: 'image/png' });
      b.disabled = false;
      try {
        // Телефон: системное «Поделиться» — там WhatsApp, Telegram, Instagram с картинкой и текстом.
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: msg }); onSent?.(to); close(); return; }
      } catch (e) { if (e?.name === 'AbortError') return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'qaita.png'; a.click();
      b.lastChild.textContent = 'Сохранено ✓';
      return;
    }
    onSent?.(to);
    close();
  }));
  return close;
}

/** Текст сообщения детям — от первого лица, тёплый, без цифр-терминов. */
export function shareText({ reps, flowers, words, goal, streak }) {
  const garden = [
    flowers ? `${flowers} ${plural(flowers, 'цветок', 'цветка', 'цветков')} в саду` : null,
    reps ? `${reps} ${plural(reps, 'повтор', 'повтора', 'повторов')}` : null,
  ].filter(Boolean).join(' · ');
  return [
    'Привет! Сегодня была тренировка для руки 💪',
    garden ? `🌸 ${garden}` : null,
    words ? `✨ ${words}` : null,
    goal ? `${goal.emoji} Моя цель — ${goal.short}` : null,
    streak > 1 ? `🔥 ${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд!` : null,
    'Qaita — упражнения для руки дома',
  ].filter(Boolean).join('\n');
}

// ——— «Голос близких»: студия записи ———
export function openVoiceStudio(root, { onSaved } = {}) {
  const { el, close } = overlay(root, `
    <h2>💌 Голос близких</h2>
    <p class="sheet-sub">Попросите внука, дочь или сына сказать несколько тёплых слов. Их голос прозвучит в конце каждого занятия — это даёт силы продолжать.</p>
    <div class="studio-step" data-step="who">
      <p class="studio-q">Кто записывает?</p>
      <div class="who-grid">${WHO.map((w) => `<button type="button" class="who-btn" data-who="${w.id}">${w.label}</button>`).join('')}</div>
    </div>
    <div class="studio-step" data-step="rec" hidden>
      <p class="studio-q">Нажмите круг и говорите. Например:</p>
      <ul class="ideas">${IDEAS.map((i) => `<li>${i}</li>`).join('')}</ul>
      <button type="button" class="rec-btn" aria-label="Записать"><span class="rec-dot"></span></button>
      <p class="rec-time">до 20 секунд</p>
    </div>
    <div class="studio-step" data-step="done" hidden>
      <p class="studio-q">Послушайте, как получилось</p>
      <audio controls class="rec-audio"></audio>
      <div class="studio-actions">
        <button type="button" class="btn-family" data-act="save">💾 Сохранить</button>
        <button type="button" class="btn-ghost" data-act="again">↺ Перезаписать</button>
      </div>
    </div>`);
  const step = (name) => el.querySelectorAll('.studio-step').forEach((s) => { s.hidden = s.dataset.step !== name; });
  let who = 'other', blob = null, rec = null, timer = null;
  el.querySelectorAll('.who-btn').forEach((b) => b.addEventListener('click', () => { who = b.dataset.who; step('rec'); }));
  const recBtn = el.querySelector('.rec-btn');
  const time = el.querySelector('.rec-time');
  async function stop() {
    clearInterval(timer);
    recBtn.dataset.on = 'false';
    blob = await rec.stop();
    rec = null;
    if (!blob) { time.textContent = 'Не получилось записать — попробуйте ещё раз'; return; }
    el.querySelector('.rec-audio').src = URL.createObjectURL(blob);
    step('done');
  }
  recBtn.addEventListener('click', async () => {
    if (rec) return stop();
    try {
      rec = await recordVoice(MAX_MS);
    } catch { time.textContent = 'Нет доступа к микрофону — разрешите его в адресной строке'; return; }
    recBtn.dataset.on = 'true';
    const t0 = performance.now();
    timer = setInterval(() => {
      const s = Math.floor((performance.now() - t0) / 1000);
      time.textContent = `● Запись ${s} с — нажмите ещё раз, чтобы закончить`;
      if (s * 1000 >= MAX_MS) stop();
    }, 250);
  });
  el.querySelector('[data-act="again"]').addEventListener('click', () => { blob = null; time.textContent = 'до 20 секунд'; step('rec'); });
  el.querySelector('[data-act="save"]').addEventListener('click', async () => {
    if (blob && await addMessage({ who, at: Date.now(), blob })) { onSaved?.(who); close(); }
  });
  return () => { clearInterval(timer); rec?.stop(); close(); };
}

// ——— Послание в конце занятия ———
/** Большая карточка «💌 Послание от внука» с голосом. Возвращает false, если посланий нет. */
export async function playMessageCard(root, ctx) {
  const msg = await nextMessage();
  if (!msg || !root.isConnected) return false;
  const { el, close } = overlay(root, `
    <div class="msg-heart" aria-hidden="true">💌</div>
    <h2>Послание ${fromText(msg.who)}</h2>
    <div class="msg-wave" aria-hidden="true">${'<span></span>'.repeat(9)}</div>
    <button type="button" class="btn-family" data-act="replay">▶ Послушать ещё раз</button>`);
  el.classList.add('sheet-msg');
  const audio = new Audio(URL.createObjectURL(msg.blob));
  const play = () => { ctx.voice.stop?.(); el.dataset.playing = 'true'; audio.currentTime = 0; audio.play().catch(() => {}); };
  audio.onended = () => { el.dataset.playing = 'false'; };
  el.querySelector('[data-act="replay"]').addEventListener('click', play);
  const obs = new MutationObserver(() => { if (!el.isConnected) { audio.pause(); obs.disconnect(); } });
  obs.observe(root, { childList: true });
  // Сначала тихая «шкатулка» (узнаваемый сигнал «пришло послание»), потом голос близкого.
  ctx.sound?.family?.();
  setTimeout(() => { if (el.isConnected) play(); }, ctx.sound?.family ? 900 : 0);
  return close;
}
