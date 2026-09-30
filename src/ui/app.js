// Приложение [E]: роутер экранов + раздача событий движка текущему экрану. UI ничего не считает сам —
// только показывает и озвучивает то, что пришло по контракту (docs/CONTRACT.md).
import { createCamera } from './components/camera.js';
import { setRingFireHook, setRingBusyHook } from './components/ring.js';
import { createVoice } from './voice.js';
import { createSound } from './sound.js';
import { prefersReducedMotion, esc } from './dom.js';
import { icons } from './icons.js';
import { setPlanForGoal } from './exercises.js';
import { loadGoal } from './life.js';
import welcome from './screens/welcome.js';
import prep from './screens/prep.js';
import hand from './screens/hand.js';
import calibration from './screens/calibration.js';
import demo from './screens/demo.js';
import play from './screens/play.js';
import exerciseDone from './screens/exercise-done.js';
import garden from './screens/garden.js';
import doctor from './screens/doctor.js';
import soon from './screens/soon.js';
import goal from './screens/goal.js';
import checkin from './screens/checkin.js';
import progress from './screens/progress.js';
import profileScreen from './screens/profile.js';
import about from './screens/about.js';
import coachVoice from './screens/coach-voice.js';
import { createMenu } from './menu.js';
import { createMusic } from './music.js';
import { screenIn, screenOut } from './motion.js';
import '../../styles/phone.css'; // телефон: раскладки без ужимания (подключается последним — главнее остальных стилей)

const SCREENS = { welcome, prep, checkin, hand, goal, progress, profile: profileScreen, about, calibration, demo, play, 'exercise-done': exerciseDone, garden, doctor, soon, 'coach-voice': coachVoice };

// Какие события движка экран может получать (метод on<Event> у экрана).
const ROUTED = ['frame', 'status', 'calibration', 'target', 'rep', 'mistake', 'mistake-cleared', 'gesture', 'exercise-done', 'rest'];
const handlerName = (ev) => `on${ev.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`;

export function createApp({ engine, video, mock = false }) {
  const stage = document.getElementById('stage');
  const toast = document.getElementById('status-toast');
  const camera = createCamera(video, document.getElementById('cam-park'));
  camera.park();

  const state = { status: null, live: false, side: null, mock };
  setPlanForGoal(loadGoal()?.id); // прошлая цель — её упражнения (цель можно сменить на экране «Ради чего?»)
  let current = null;       // { name, el, ...handlers, destroy }

  const voice = createVoice();
  const sound = createSound();
  sound.unlock();
  setRingFireHook(() => sound.confirm());
  setRingBusyHook(() => voice.speaking);
  const ctx = { engine, camera, state, go, voice, sound, say: (text, opts) => voice.say(text, opts) };

  // Звук: если браузер не дал говорить без нажатия — маленькая подсказка в углу. Нажатие необязательное:
  // всё приложение работает жестами, голос просто включится после первого касания.
  const audioChip = document.getElementById('audio-chip');
  const syncAudioChip = () => { audioChip.dataset.show = String(voice.blocked || sound.blocked); };
  voice.onChange(syncAudioChip);
  const music = createMusic();
  ctx.music = music;
  const unlock = () => { voice.unlock(); sound.unlock(); music.unlock(); setTimeout(syncAudioChip, 50); };
  // Пока говорит тренер — музыка тише.
  setInterval(() => music.duck(voice.speaking), 400);
  const menu = createMenu({ go: (n) => go(n), music, voice });
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
  setTimeout(syncAudioChip, 1500);

  // Каждый экран должен целиком помещаться на любом устройстве без прокрутки (живой тест 29.09: низкое окно
  // браузера на ноутбуке). Если не влез — уменьшаем весь экран целиком (CSS zoom), но не меньше 55%.
  // Длинный экран-документ (отчёт врача, data-fit="scroll") мельче 80% не ужимаем — пусть прокручивается:
  // на телефоне 55% давали таблицу ~8px. Кольцо у него наверху, жест доступен без прокрутки.
  function fit(el) {
    if (!el?.isConnected || current?.noFit) return;
    el.style.zoom = '';
    const floor = el.dataset.fit === 'scroll' ? 0.8 : 0.55;
    const ratio = el.clientHeight / el.scrollHeight;
    if (ratio < 0.995) {
      let z = Math.max(floor, ratio);
      el.style.zoom = String(z);
      // Ещё проходы: при уменьшении стало шире — текст мог перенестись иначе.
      for (let i = 0; i < 3 && z > floor; i += 1) {
        const again = el.clientHeight / el.scrollHeight;
        if (again >= 0.995) break;
        z = Math.max(floor, z * again * 0.99);
        el.style.zoom = String(z);
      }
    }
  }
  let fitTimer = null, fitWatch = null;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => fit(current?.el), 120); });
  // Картинки/шрифты догружаются позже — перепроверяем через полсекунды.
  const refit = () => setTimeout(() => fit(current?.el), 500);
  // Шрифт Manrope приходит позже системного (он не блокирует запуск) — строки становятся другой ширины.
  // Подгоняем экран ещё раз, когда шрифт загрузился, чтобы масштаб был одинаковым при каждом открытии.
  document.fonts?.ready.then(() => fit(current?.el));
  document.fonts?.addEventListener?.('loadingdone', () => fit(current?.el));

  function go(name, params = {}) {
    const make = SCREENS[name] ?? SCREENS.soon;
    const prev = current;
    prev?.destroy?.();
    camera.park();

    const next = make(ctx, params);
    next.name = name;
    next.el.classList.add('screen');
    stage.append(next.el);
    current = next;
    next.enter?.();
    updateToast();
    menu.sync(name);
    document.body.dataset.screen = name;
    if (!next.noFit) fit(next.el); // страницы-«лендинги» (прогресс, профиль) прокручиваются сами
    refit();
    // Экран сам показывает/прячет части (кнопка «Начать со звуком», подсказки) уже после подгонки — подгоняем заново,
    // иначе масштаб зависел от того, успело ли это случиться до fit() (прыгал при повторном открытии).
    fitWatch?.disconnect();
    fitWatch = new MutationObserver((list) => {
      if (!list.some((m) => m.oldValue !== m.target.getAttribute('hidden'))) return; // то же значение — ничего не поменялось
      clearTimeout(fitTimer); fitTimer = setTimeout(() => fit(current?.el), 120);
    });
    fitWatch.observe(next.el, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['hidden'] });
    const rotateHint = document.querySelector('.rotate-hint'); // спряталась подсказка «Поверните телефон» — места стало больше
    if (rotateHint) fitWatch.observe(rotateHint, { attributes: true, attributeOldValue: true, attributeFilter: ['hidden'] });

    // Переход: лёгкий подъём + размытие, ≤300 мс (motion.js; при reduced-motion — просто проявление).
    screenIn(next.el);
    if (prev) {
      prev.el.style.pointerEvents = 'none';
      const out = screenOut(prev.el);
      out.finished.then(() => prev.el.remove(), () => prev.el.remove());
    }
  }

  // Плашка статуса: только на экранах, где важно, как человек сидит (экран сам решает через wantsStatus).
  function updateToast() {
    const s = state.status;
    const show = Boolean(s && s.code !== 'OK' && (s.code === 'NO_CAMERA' || current?.wantsStatus));
    if (show) toast.innerHTML = `${icons.alert}<span>${esc(s.message)}</span>`;
    toast.dataset.show = String(show);
  }

  // Плашка «👍 Повторяю: …» — видимый ответ на «палец вверх».
  const repeatToast = document.getElementById('repeat-toast');
  let repeatTimer = null;
  function showRepeat(text) {
    repeatToast.innerHTML = `<span class="repeat-ico" aria-hidden="true">👍</span><span>${text ? esc(text) : 'Вижу! Палец вверх — повтор подсказки'}</span>`;
    repeatToast.dataset.show = 'true';
    repeatToast.animate([{ transform: 'translate(-50%, 0) scale(0.92)' }, { transform: 'translate(-50%, 0) scale(1)' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    sound.confirm();
    clearTimeout(repeatTimer);
    repeatTimer = setTimeout(() => { repeatToast.dataset.show = 'false'; }, 4500);
  }

  for (const ev of ROUTED) {
    const name = handlerName(ev);
    engine.on(ev, (payload) => {
      if (ev === 'frame') {
        if (!state.live) { state.live = true; state.failed = null; current?.onLive?.(); }
        camera.onFrame(payload);
      }
      if (ev === 'status') {
        state.status = payload;
        camera.setSeen(payload.code === 'OK');
        if (payload.code === 'NO_CAMERA') camera.setWaitText(payload.message);
        updateToast();
      }
      const used = current?.[name]?.(payload);
      // «Палец вверх» везде = повторить подсказку голосом (если экран не занял этот жест сам).
      // И обязательно на экране: без звука (браузер его блокирует до касания) лайк раньше «ничего не делал» (плейтест 29.09).
      if (ev === 'gesture' && payload.type === 'THUMBS_UP' && payload.fired && !used) {
        // Экран может сам сказать, что повторить (в игре — текущая ошибка или инструкция, а не мимолётное «Раз!»).
        const own = current?.repeatText?.();
        const text = own || voice.lastHint;
        if (own) voice.say(own, { interrupt: true, force: true }); else voice.repeat();
        showRepeat(text);
      }
    });
  }

  return {
    ctx,
    start(name = 'welcome', params) { go(name, params); },
    // Распознавание не загрузилось (нет интернета / CDN недоступен): понятная фраза вместо вечной загрузки.
    fail(text) {
      if (state.live) return;
      state.failed = text;
      camera.setWaitText(text.label); // в маленьком круге камеры — коротко; подробности под кольцом
      current?.onFailed?.();
    },
  };
}
