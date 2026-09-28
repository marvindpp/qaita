// Голос [E]: speechSynthesis ru-RU. Правила: одну и ту же фразу не чаще раза в 4 с (движок шлёт подсказку
// каждый раз, когда она снова появилась); новая срочная фраза (ошибка) перебивает старую; «палец вверх» — повтор.
// Если браузер не дал говорить без нажатия — молчим, UI работает, после первого нажатия голос включится.

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

  function speak(text, { interrupt = false } = {}) {
    if (!synth || !text) return;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = RATE;
    u.onstart = () => setBlocked(false);
    u.onerror = (e) => { if (e.error === 'not-allowed') setBlocked(true); };
    synth.speak(u);
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
    stop() { synth?.cancel(); },
    /** Первое нажатие/касание — браузер разрешает звук; договариваем последнюю фразу. */
    unlock() {
      if (!blocked) return;
      setBlocked(false);
      if (last.text && performance.now() - last.at < 8000) speak(last.text, { interrupt: true });
    },
    setMuted(v) { muted = Boolean(v); if (muted) synth?.cancel(); for (const cb of listeners) cb({ blocked, muted }); },
    get muted() { return muted; },
    get blocked() { return blocked; },
    get available() { return Boolean(synth); },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
  return api;
}
