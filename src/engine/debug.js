// Debug-оверлей движка (?debug=1): скелет, руки, FPS, сырые метрики. Для настройки порогов, не для пользователя.
const POSE_EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [0, 7], [0, 8], [7, 11], [8, 12]];
const HAND_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export function createDebugOverlay(video) {
  const canvas = document.createElement('canvas');
  const panel = document.createElement('pre');
  Object.assign(canvas.style, { position: 'fixed', pointerEvents: 'none', zIndex: 9998 });
  Object.assign(panel.style, {
    position: 'fixed', left: '8px', bottom: '8px', margin: 0, padding: '8px 10px', zIndex: 9999,
    font: '13px/1.35 ui-monospace, monospace', background: 'rgba(0,0,0,.75)', color: '#9ff5c9',
    borderRadius: '8px', maxWidth: '46vw', whiteSpace: 'pre-wrap', pointerEvents: 'none',
  });
  document.body.append(canvas, panel);
  const ctx = canvas.getContext('2d');

  const line = (a, b, w, h) => { ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); };

  return {
    draw({ pose, hands, fps, delegate, info = {}, target }) {
      const r = video.getBoundingClientRect();
      Object.assign(canvas.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      canvas.width = r.width * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 3 * devicePixelRatio;
      if (pose) {
        ctx.strokeStyle = '#46c38b';
        for (const [a, b] of POSE_EDGES) if (pose[a].visibility > 0.5 && pose[b].visibility > 0.5) line(pose[a], pose[b], w, h);
        ctx.fillStyle = '#ffffff';
        pose.forEach((p, i) => {
          if (p.visibility < 0.5) return;
          ctx.fillRect(p.x * w - 3, p.y * h - 3, 6, 6);
          if ([0, 7, 8, 11, 12, 13, 14, 15, 16].includes(i)) ctx.fillText(String(i), p.x * w + 6, p.y * h - 6);
        });
      }
      if (target) {
        ctx.strokeStyle = '#ffd400';
        ctx.lineWidth = 4 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(target.x * w, target.y * h, target.radius * w, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd400';
        ctx.font = `${28 * devicePixelRatio}px system-ui`;
        ctx.fillText('★', target.x * w - 12 * devicePixelRatio, target.y * h + 10 * devicePixelRatio);
      }
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.strokeStyle = '#ffb347';
      for (const hand of hands ?? []) for (const [a, b] of HAND_EDGES) line(hand[a], hand[b], w, h);
      const rows = [`FPS ${fps}  ${delegate}`, `pose ${pose ? 'yes' : 'no'}  hands ${hands?.length ?? 0}`];
      for (const [k, v] of Object.entries(info)) rows.push(`${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`);
      panel.textContent = rows.join('\n');
    },
  };
}

// Сценарий для проверки движка без UI: ?debug=1&auto=1&side=right&reps=5
export function runDebugScenario(engine, bus, overlay, params) {
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
    padding: '14px 22px', borderRadius: '14px', background: 'rgba(0,0,0,.82)', color: '#fff',
    font: '600 26px/1.3 system-ui', maxWidth: '92vw', textAlign: 'center',
  });
  document.body.append(banner);
  const say = (text, color = '#fff') => { banner.textContent = text; banner.style.color = color; };

  bus.on('status', ({ code, message }) => { if (code !== 'OK') say(message, '#ffb3b3'); });
  bus.on('calibration', ({ message, progress }) => say(`${message}  ${Math.round(progress * 100)}%`));
  bus.on('mistake', ({ message }) => say(message, '#ff8a80'));
  bus.on('mistake-cleared', () => say('Отлично, так правильно!', '#9ff5c9'));
  bus.on('rep', ({ count, targetReps, quality }) => say(`Повтор ${count}/${targetReps} ✓  качество ${Math.round(quality * 100)}%`, '#9ff5c9'));

  const side = params.get('side') === 'left' ? 'left' : 'right';
  const reps = Number(params.get('reps')) || 5;
  (async () => {
    engine.setSide(side);
    const base = await engine.calibrate();
    console.log('[qaita] baseline', base);
    const run = () => {
      engine.setExercise('reach_up', { targetReps: reps });
      say('Дотянитесь до звезды ★ и задержитесь на полсекунды');
    };
    bus.on('exercise-done', () => {
      console.log('[qaita] summary', engine.getSummary());
      say('Упражнение выполнено! Следующий подход через 3 секунды', '#9ff5c9');
      setTimeout(run, 3000);
    });
    run();
  })();
}
