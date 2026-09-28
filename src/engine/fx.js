// Эффекты поверх видео — готовые кирпичи и для debug.html, и для экрана «Игра» (Ерсу: импортировать и вызвать).
// Только canvas 2D, без DOM. Координаты — пиксели canvas.
//
//   const fx = createSparkles();
//   каждый кадр:  fx.trail(palm.x, palm.y, now) — пока рука идёт к звезде;  fx.draw(ctx, now)
//   на 'rep':     fx.burst(star.x, star.y, now, quality >= 0.9)
//   тень:         drawYesterday(ctx, bestRep, now, { shoulder, S, outSign })

const GOLD = [242, 180, 42], WHITE = [255, 255, 255], GREEN = [70, 195, 139], BLUE = [120, 190, 255];

export function createSparkles() {
  const parts = [];
  let lastTrail = 0;
  const add = (p) => { parts.push(p); if (parts.length > 400) parts.shift(); };

  return {
    /** Хвост искр за ладонью. */
    trail(x, y, now) {
      if (now - lastTrail < 16) return;
      lastTrail = now;
      for (let i = 0; i < 2; i += 1) {
        add({ x, y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 + 20, born: now, life: 500 + Math.random() * 300, r: 3 + Math.random() * 4, c: Math.random() < 0.7 ? GOLD : WHITE });
      }
    },
    /** Взрыв звезды: чистый повтор — золото с зеленью и кольцо, иначе скромнее. */
    /** Брызги воды из чашки: рывок или наклон с «чашкой» в руке — вода расплёскивается (понятно без слов). */
    splash(x, y, now) {
      for (let i = 0; i < 26; i += 1) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = 140 + Math.random() * 200;
        add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now, life: 700 + Math.random() * 300, r: 3 + Math.random() * 4, c: Math.random() < 0.7 ? [110, 180, 255] : WHITE });
      }
    },
    burst(x, y, now, clean = true) {
      const n = clean ? 46 : 20;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const v = (clean ? 260 : 160) * (0.5 + Math.random() * 0.7);
        add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now, life: 700 + Math.random() * 400, r: 4 + Math.random() * 5, c: clean && i % 3 === 0 ? GREEN : GOLD, star: i % 4 === 0 });
      }
      add({ ring: true, x, y, born: now, life: 600, c: clean ? GOLD : WHITE });
    },
    draw(g, now) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        const k = (now - p.born) / p.life;
        if (k >= 1) { parts.splice(i, 1); continue; }
        const [r, gg, b] = p.c;
        if (p.ring) {
          g.strokeStyle = `rgba(${r},${gg},${b},${(1 - k) * 0.9})`;
          g.lineWidth = 8 * (1 - k) + 1;
          g.beginPath(); g.arc(p.x, p.y, 20 + k * 120, 0, Math.PI * 2); g.stroke();
          continue;
        }
        const t = (now - p.born) / 1000;
        const x = p.x + p.vx * t, y = p.y + p.vy * t + 180 * t * t; // лёгкая «гравитация»
        g.fillStyle = `rgba(${r},${gg},${b},${1 - k})`;
        const rad = p.r * (1 - k * 0.6);
        if (p.star) starPath(g, x, y, rad * 1.8); else { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); }
        g.fill();
      }
      g.restore();
    },
  };
}

/**
 * «Ты вчерашний»: светящийся шар проходит путь ЛУЧШЕГО повтора (реальный, со скоростью и высотой),
 * от плеча человека сейчас. Цикл: путь → 0,8 с пауза наверху не нужна (она уже в пути) → 1 с отдых.
 * @param {{ms:number, pts:Array<[number,number,number]>}} bestRep — из getSummary().exercises[i].bestRep
 * @param {{shoulder:{x:number,y:number}, S:number, outSign:1|-1}} at — плечо и ширина плеч в пикселях canvas
 */
export function drawYesterday(g, bestRep, now, { shoulder, S, outSign }, label = 'Вы вчера') {
  const pts = bestRep?.pts;
  if (!pts?.length || !S) return;
  const REST_MS = 1000;
  const t = now % (bestRep.ms + REST_MS);
  if (t > bestRep.ms) return;
  const toPx = ([, out, up]) => ({ x: shoulder.x + out * S * outSign, y: shoulder.y - up * S });
  let i = pts.findIndex((p) => p[0] > t);
  if (i < 0) i = pts.length - 1;
  const cur = toPx(pts[i]);
  const fade = Math.min(1, t / 250, (bestRep.ms - t) / 250); // появляется и исчезает плавно

  g.save();
  g.globalAlpha = Math.max(0, fade);
  // Хвост: последние ~400 мс пути, сужается и тает.
  const from = Math.max(0, pts.findIndex((p) => p[0] > t - 400));
  for (let j = from + 1; j <= i; j += 1) {
    const a = toPx(pts[j - 1]), b = toPx(pts[j]);
    const k = (j - from) / Math.max(1, i - from);
    g.strokeStyle = `rgba(${BLUE.join(',')},${0.55 * k})`;
    g.lineWidth = S * 0.18 * k + 2;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
  const rad = S * 0.16;
  const glow = g.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, rad * 2.2);
  glow.addColorStop(0, 'rgba(255,255,255,.95)');
  glow.addColorStop(0.35, `rgba(${BLUE.join(',')},.75)`);
  glow.addColorStop(1, `rgba(${BLUE.join(',')},0)`);
  g.fillStyle = glow;
  g.beginPath(); g.arc(cur.x, cur.y, rad * 2.2, 0, Math.PI * 2); g.fill();
  const size = Math.max(16, S * 0.14);
  g.font = `800 ${size}px Manrope, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'bottom';
  g.lineWidth = size * 0.25; g.strokeStyle = 'rgba(20,28,40,.7)'; g.strokeText(label, cur.x, cur.y - rad * 1.4);
  g.fillStyle = '#fff'; g.fillText(label, cur.x, cur.y - rad * 1.4);
  g.restore();
}

function starPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}
