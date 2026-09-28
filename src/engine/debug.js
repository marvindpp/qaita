// Debug-оверлей движка (?debug=1): скелет, руки, FPS, сырые метрики. Для настройки порогов, не для пользователя.
const POSE_EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [0, 7], [0, 8], [7, 11], [8, 12]];
const HAND_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export function createDebugOverlay(video, { showNumbers = false } = {}) {
  const canvas = document.createElement('canvas');
  const panel = document.createElement('pre');
  Object.assign(canvas.style, { position: 'fixed', pointerEvents: 'none', zIndex: 9998 });
  Object.assign(panel.style, {
    position: 'fixed', left: '8px', bottom: '8px', margin: 0, padding: '8px 10px', zIndex: 9999,
    font: '13px/1.35 ui-monospace, monospace', background: 'rgba(0,0,0,.75)', color: '#9ff5c9',
    borderRadius: '8px', maxWidth: '46vw', whiteSpace: 'pre-wrap', pointerEvents: 'none',
  });
  document.body.append(canvas);
  if (showNumbers) document.body.append(panel);
  const ctx = canvas.getContext('2d');

  const line = (a, b, w, h) => { ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); };

  return {
    draw({ pose, hands, fps, delegate, info = {}, target, framing, side = 'right', showGuide = false }) {
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
      // Силуэт-трафарет «куда сесть»: голова по центру сверху, плечи ниже, место над головой для руки.
      if (showGuide) {
        const ok = framing?.ok;
        ctx.save();
        ctx.setLineDash([14 * devicePixelRatio, 10 * devicePixelRatio]);
        ctx.lineWidth = 5 * devicePixelRatio;
        ctx.strokeStyle = ok ? '#46c38b' : 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.ellipse(0.5 * w, 0.42 * h, 0.075 * w, 0.13 * h, 0, 0, Math.PI * 2); // голова
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.3 * w, 0.98 * h);
        ctx.quadraticCurveTo(0.3 * w, 0.64 * h, 0.44 * w, 0.6 * h); // левое плечо
        ctx.moveTo(0.7 * w, 0.98 * h);
        ctx.quadraticCurveTo(0.7 * w, 0.64 * h, 0.56 * w, 0.6 * h); // правое плечо
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = ok ? '#46c38b' : '#fff';
        ctx.font = `700 ${Math.round(w / 16)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(ok ? 'На месте ✓' : 'Сядьте в пунктир', 0.5 * w, 0.1 * h);
        ctx.textAlign = 'start';
      }
      if (target) {
        // Пунктир от кисти рабочей руки к звезде — «тянись сюда».
        const wr = pose?.[side === 'left' ? 15 : 16];
        if (wr && wr.visibility > 0.5) {
          ctx.save();
          ctx.setLineDash([10 * devicePixelRatio, 10 * devicePixelRatio]);
          ctx.strokeStyle = 'rgba(255,212,0,.9)';
          ctx.lineWidth = 4 * devicePixelRatio;
          ctx.beginPath(); ctx.moveTo(wr.x * w, wr.y * h); ctx.lineTo(target.x * w, target.y * h); ctx.stroke();
          ctx.restore();
          ctx.fillStyle = '#ffd400';
          ctx.beginPath(); ctx.arc(wr.x * w, wr.y * h, 12 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
        }
        const pulse = 1 + 0.12 * Math.sin(performance.now() / 180);
        ctx.font = `${56 * pulse * devicePixelRatio}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd400';
        ctx.fillText('★', target.x * w, target.y * h);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = '#ffd400';
        ctx.lineWidth = 4 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(target.x * w, target.y * h, target.radius * w, 0, Math.PI * 2);
        ctx.stroke();
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

// Сценарий для проверки движка без UI: ?debug=1&auto=1 (это НЕ интерфейс продукта — его делает Ерсултан).
export function runDebugScenario(engine, bus, overlay, params) {
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
    padding: '16px 26px', borderRadius: '16px', background: 'rgba(0,0,0,.85)', color: '#fff',
    font: '700 clamp(28px, 5vw, 56px)/1.2 system-ui', maxWidth: '92vw', textAlign: 'center',
  });
  const ring = document.createElement('div');
  Object.assign(ring.style, { font: '600 clamp(22px, 3.5vw, 40px)/1.2 system-ui', color: '#ffd400', marginTop: '8px' });
  banner.append(document.createElement('span'), ring);
  document.body.append(banner);
  const say = (text, color = '#fff') => { banner.firstChild.textContent = text; banner.style.color = color; };

  let lastStatus = 'OK';
  let waiting = null; // { types:Set, resolve }
  const waitGesture = (types, hint) => new Promise((resolve) => { waiting = { types: new Set(types), resolve }; ring.textContent = hint; });

  bus.on('status', ({ code, message }) => { lastStatus = code; if (code !== 'OK') say(message, '#ffb3b3'); });
  bus.on('gesture', ({ type, progress, fired }) => {
    if (!waiting || !waiting.types.has(type)) return;
    ring.textContent = fired ? '✓' : `${'●'.repeat(Math.round(progress * 10))}${'○'.repeat(10 - Math.round(progress * 10))}`;
    if (fired) { const w = waiting; waiting = null; setTimeout(() => w.resolve(type), 300); }
  });
  bus.on('calibration', ({ message }) => say(message));
  bus.on('mistake', ({ message }) => say(message, '#ff8a80'));
  bus.on('mistake-cleared', () => say('Отлично! ✓', '#9ff5c9'));
  bus.on('rep', ({ count, targetReps, quality }) => say(`${quality >= 0.9 ? '🌸' : '🌱'} ${count} из ${targetReps}`, '#9ff5c9'));

  const NAMES = { reach_up: 'Рукой вверх до ★', reach_side: 'Рукой в сторону до ★', hand_to_mouth: 'Кисть ко рту, как чашку', reach_across: 'Рукой к другому плечу', open_hand: 'Кулак → раскрыть ладонь' };
  (async () => {
    say('✋ Покажите ладонь');
    await waitGesture(['PALM_HOLD'], '○○○○○○○○○○');
    say('Поднимите руку для тренировки');
    const raised = await waitGesture(['RAISE_LEFT', 'RAISE_RIGHT'], '○○○○○○○○○○');
    engine.setSide(raised === 'RAISE_LEFT' ? 'left' : 'right');
    ring.textContent = '';
    say('Опустите руку');
    await new Promise((r) => setTimeout(r, 1500));
    const base = await engine.calibrate();
    console.log('[qaita] baseline', base);
    const list = (params.get('ex') ?? 'reach_up,reach_side,hand_to_mouth,reach_across,open_hand').split(',');
    for (const id of list) {
      say(`${NAMES[id]} · ✋ готов?`);
      await waitGesture(['PALM_HOLD'], '○○○○○○○○○○');
      ring.textContent = '✋✋ = пауза';
      engine.setExercise(id, { targetReps: Number(params.get('reps')) || 3 });
      say(NAMES[id]);
      await new Promise((r) => { const off = bus.on('exercise-done', () => { off(); r(); }); });
      say('★★★ Готово!', '#9ff5c9');
      await new Promise((r) => setTimeout(r, 1500));
    }
    const s = engine.getSummary();
    console.log('[qaita] summary', s);
    say(`🌸 Повторов: ${s.totalReps} · исправлено: ${s.mistakesCorrected}`, '#9ff5c9');
    ring.textContent = '';
  })();
}
