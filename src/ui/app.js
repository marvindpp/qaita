// Приложение [E]: роутер экранов + раздача событий движка текущему экрану. UI ничего не считает сам —
// только показывает и озвучивает то, что пришло по контракту (docs/CONTRACT.md).
import { createCamera } from './components/camera.js';
import { setRingFireHook } from './components/ring.js';
import { createVoice } from './voice.js';
import { createSound } from './sound.js';
import { prefersReducedMotion, esc } from './dom.js';
import { icons } from './icons.js';
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

const SCREENS = { welcome, prep, checkin, hand, goal, calibration, demo, play, 'exercise-done': exerciseDone, garden, doctor, soon };

// Какие события движка экран может получать (метод on<Event> у экрана).
const ROUTED = ['frame', 'status', 'calibration', 'target', 'rep', 'mistake', 'mistake-cleared', 'gesture', 'exercise-done', 'rest'];
const handlerName = (ev) => `on${ev.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`;

export function createApp({ engine, video, mock = false }) {
  const stage = document.getElementById('stage');
  const toast = document.getElementById('status-toast');
  const camera = createCamera(video, document.getElementById('cam-park'));
  camera.park();

  const state = { status: null, live: false, side: null, mock };
  let current = null;       // { name, el, ...handlers, destroy }

  const voice = createVoice();
  const sound = createSound();
  sound.unlock();
  setRingFireHook(() => sound.confirm());
  const ctx = { engine, camera, state, go, voice, sound, say: (text, opts) => voice.say(text, opts) };

  // Звук: если браузер не дал говорить без нажатия — маленькая подсказка в углу. Нажатие необязательное:
  // всё приложение работает жестами, голос просто включится после первого касания.
  const audioChip = document.getElementById('audio-chip');
  const syncAudioChip = () => { audioChip.dataset.show = String(voice.blocked || sound.blocked); };
  voice.onChange(syncAudioChip);
  const unlock = () => { voice.unlock(); sound.unlock(); setTimeout(syncAudioChip, 50); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
  setTimeout(syncAudioChip, 1500);

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

    const reduce = prefersReducedMotion();
    next.el.animate(
      reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    if (prev) {
      prev.el.style.pointerEvents = 'none';
      const out = prev.el.animate(
        reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }],
        { duration: 160, easing: 'ease-out', fill: 'forwards' },
      );
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

  for (const ev of ROUTED) {
    const name = handlerName(ev);
    engine.on(ev, (payload) => {
      if (ev === 'frame') {
        if (!state.live) { state.live = true; current?.onLive?.(); }
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
      if (ev === 'gesture' && payload.type === 'THUMBS_UP' && payload.fired && !used) voice.repeat();
    });
  }

  return {
    ctx,
    start(name = 'welcome', params) { go(name, params); },
  };
}
