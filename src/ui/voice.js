// Голос [E]: живые записи тренера + speechSynthesis ru-RU. Правила: одну и ту же фразу не чаще раза в 4 с (движок шлёт
// подсказку каждый раз, когда она снова появилась); новая срочная фраза (ошибка) перебивает старую; «палец вверх» — повтор.
// Если браузер не дал говорить без нажатия — молчим, UI работает, после первого нажатия голос включится.
// Живой голос: фразу режем на предложения; для предложения есть запись (voice-clips.js) — играем её, нет — говорит
// голос браузера. Нет ни одной записи — всё как раньше, только speechSynthesis.
import { lineKey, splitSentences } from './voice-lines.js';
import { localClips, sharedClips, wavBlob } from './voice-clips.js';

const SAME_PHRASE_COOLDOWN_MS = 4000;
const RATE = 0.95; // чуть медленнее обычного — для людей 50–75

export function createVoice() {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  let voice = null;
  let muted = false;
  let blocked = false;
  let last = { text: '', at: -Infinity };
  let lastHint = '';
  const listeners = new Set();

  // Записи: ключ предложения → url. Свои записи этого устройства главнее общих из проекта.
  let clips = new Map();
  let ownUrls = [];
  async function loadClips() {
    const [shared, own] = await Promise.all([sharedClips(import.meta.env?.BASE_URL ?? './'), localClips()]);
    ownUrls.forEach((u) => URL.revokeObjectURL(u));
    ownUrls = [];
    const next = new Map(shared);
    for (const [k, v] of own) { const u = URL.createObjectURL(v.blob); ownUrls.push(u); next.set(k, u); }
    clips = next;
  }
  const clipsReady = typeof indexedDB !== 'undefined' ? loadClips().catch(() => {}) : Promise.resolve();

  // Один плеер на все записи: iOS разрешает играть звук элементу, которому хоть раз дали играть по нажатию.
  const player = typeof Audio !== 'undefined' ? new Audio() : null;
  let primed = false;

  function pickVoice() {
    const all = synth?.getVoices() ?? [];
    const ru = all.filter((v) => /^ru(-|_|$)/i.test(v.lang));
    // Предпочитаем «живые» голоса: Google / Milena / Yandex / Microsoft, потом любой русский.
    voice = ru.find((v) => /google|milena|yandex|microsoft|алёна|irina|svetlana/i.test(v.name)) ?? ru[0] ?? null;
  }
  pickVoice();
  synth?.addEventListener?.('voiceschanged', pickVoice);

  const setBlocked = (v) => {
    if (blocked === v) return;
    blocked = v;
    for (const cb of listeners) cb({ blocked, muted });
  };

  function utter(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = RATE;
    return u;
  }

  // Очередь кусков фразы: { url } — запись, { text } — голос браузера. gen растёт при каждом «перебить».
  let queue = [];
  let current = null;
  let gen = 0;

  function stopAll() {
    gen += 1;
    queue = [];
    current = null;
    if (player && !player.paused) player.pause();
    synth?.cancel();
  }

  function next(g) {
    if (g !== gen) return;
    const item = queue.shift();
    current = item ?? null;
    if (!item) return;
    if (item.url) {
      const done = () => { if (g === gen && current === item) next(g); };
      player.onended = done;
      player.onerror = done;
      player.src = item.url;
      player.play().then(() => setBlocked(false), (e) => {
        if (g !== gen) return;
        if (e?.name === 'NotAllowedError') { setBlocked(true); stopAll(); } else done();
      });
      return;
    }
    if (!synth) { next(g); return; }
    const u = utter(item.text);
    let over = false, timer = 0;
    const done = () => { if (over) return; over = true; clearTimeout(timer); if (g === gen && current === item) next(g); };
    // Chrome иногда не присылает onend — страховка, чтобы очередь не встала навсегда.
    const watch = () => { timer = setTimeout(() => (synth.speaking ? watch() : done()), 2500 + item.text.length * 90); };
    watch();
    u.onstart = () => setBlocked(false);
    u.onend = done;
    u.onerror = (e) => {
      if (e.error === 'not-allowed') { if (g === gen) { setBlocked(true); stopAll(); } return; }
      done();
    };
    synth.speak(u);
  }

  function speak(text, { interrupt = false } = {}) {
    if (!text) return;
    const parts = splitSentences(text);
    const live = player && parts.some((s) => clips.has(lineKey(s)));
    if (!live && !queue.length && !current) {
      // Записей для этой фразы нет — как раньше: целиком голосом браузера (очередь у speechSynthesis своя).
      if (!synth) return;
      if (interrupt) stopAll();
      const u = utter(text);
      u.onstart = () => setBlocked(false);
      u.onerror = (e) => { if (e.error === 'not-allowed') setBlocked(true); };
      synth.speak(u);
      return;
    }
    if (interrupt) stopAll();
    else if (!current && synth?.speaking) synth.cancel(); // хвост старой фразы без очереди не наложится на запись
    // Записанные предложения — записью; подряд идущие без записи — одним куском голоса браузера (звучит слитно).
    const items = [];
    for (const s of parts) {
      const url = clips.get(lineKey(s));
      const prev = items[items.length - 1];
      if (url) items.push({ url });
      else if (prev?.text) prev.text += ` ${s}`;
      else items.push({ text: s });
    }
    queue.push(...items);
    if (!current) next(gen);
  }

  const api = {
    /**
     * Сказать фразу.
     * @param {string} text
     * @param {{ interrupt?: boolean, hint?: boolean, force?: boolean }} [opts]
     *   interrupt — оборвать текущую фразу (ошибки); hint — запомнить для «палец вверх»; force — без кулдауна.
     */
    say(text, { interrupt = false, hint = false, force = false } = {}) {
      if (!text) return;
      if (hint) lastHint = text;
      const now = performance.now();
      if (!force && text === last.text && now - last.at < SAME_PHRASE_COOLDOWN_MS) return;
      last = { text, at: now };
      if (muted || blocked) return;
      speak(text, { interrupt });
    },
    /** «Палец вверх»: повторить последнюю подсказку (или последнюю фразу). */
    repeat() {
      const text = lastHint || last.text;
      if (!text || muted) return;
      last = { text, at: performance.now() };
      speak(text, { interrupt: true });
    },
    /** Что повторит «палец вверх» — чтобы показать это и на экране (звук может быть заблокирован). */
    get lastHint() { return lastHint || last.text; },
    stop() { stopAll(); },
    /** Первое нажатие/касание — браузер разрешает звук; договариваем последнюю фразу. */
    unlock() {
      if (!primed && player) {
        // Разрешить плееру звук, пока идёт нажатие (нужно iOS): короткая тишина.
        primed = true;
        if (!current) {
          player.src = URL.createObjectURL(wavBlob(new Float32Array(441), 22050));
          player.play().then(() => player.pause(), () => { primed = false; });
        }
      }
      if (!blocked) return;
      setBlocked(false);
      if (last.text && performance.now() - last.at < 8000) speak(last.text, { interrupt: true });
    },
    setMuted(v) { muted = Boolean(v); if (muted) stopAll(); for (const cb of listeners) cb({ blocked, muted }); },
    get muted() { return muted; },
    get blocked() { return blocked; },
    /** Говорит сейчас или есть очередь фраз. */
    get speaking() {
      if (muted || blocked) return false;
      return Boolean(current || queue.length || (synth && (synth.speaking || synth.pending)));
    },
    get available() { return Boolean(synth || clips.size); },
    /** Сколько предложений звучит живым голосом (для «Студии голоса тренера»). */
    get liveCount() { return clips.size; },
    /** Перечитать записи (после записи в студии — сразу слышно в приложении). */
    reloadClips() { return loadClips().catch(() => {}); },
    ready: clipsReady,
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
  return api;
}
