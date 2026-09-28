// «Отправить детям» (PLAN §9г): человек не обуза — он ДАЁТ семье хорошую новость. Открытка рисуется
// в браузере (canvas → PNG), отправка через системное «Поделиться» (WhatsApp, Telegram). Сервера нет.

const W = 1080, H = 1350;

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = t;
  }
  if (line) g.fillText(line, x, y);
  return y + lh;
}

/** @returns {Promise<Blob>} PNG-открытка с итогами дня. */
export async function makeCard({ flowers, sprouts, reps, words, goal, streak, lifeDone }) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#dfeee6'); sky.addColorStop(0.55, '#f6efe0'); sky.addColorStop(0.55, '#cfdcb8'); sky.addColorStop(1, '#bccf9f');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // Солнце
  const sun = g.createRadialGradient(860, 230, 10, 860, 230, 150);
  sun.addColorStop(0, '#fff4c9'); sun.addColorStop(0.5, '#ffd66b'); sun.addColorStop(1, 'rgba(242,180,42,0)');
  g.fillStyle = sun; g.beginPath(); g.arc(860, 230, 150, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#1d3a2c';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '800 44px Manrope, system-ui, sans-serif';
  g.fillText(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), 80, 120);
  g.font = '800 96px Manrope, system-ui, sans-serif';
  let y = wrap(g, 'Я сегодня занимался(ась)!', 80, 250, W - 160, 110);

  g.font = '700 54px Manrope, system-ui, sans-serif';
  g.fillStyle = '#1d7552';
  if (words) y = wrap(g, words, 80, y + 20, W - 160, 66);
  g.fillStyle = '#3b4a42';
  if (goal) y = wrap(g, `${goal.emoji} Цель: ${goal.short}`, 80, y + 10, W - 160, 66);

  // Грядка: цветы и ростки этого дня
  const plants = [...Array(flowers).fill('🌸'), ...Array(sprouts).fill('🌱')].slice(0, 15);
  g.font = '88px system-ui, sans-serif';
  g.textAlign = 'center';
  const perRow = 5, step = (W - 160) / perRow;
  plants.forEach((p, i) => g.fillText(p, 80 + step * (i % perRow) + step / 2, 840 + Math.floor(i / perRow) * 105));

  g.textAlign = 'left';
  g.fillStyle = '#1d3a2c';
  g.font = '800 50px Manrope, system-ui, sans-serif';
  const facts = [`${reps} повторов`, streak > 1 ? `${streak} дня подряд` : null, lifeDone ? `${lifeDone} раз рука помогла в жизни` : null].filter(Boolean);
  wrap(g, facts.join(' · '), 80, H - 190, W - 160, 60);
  g.font = '600 34px Manrope, system-ui, sans-serif';
  g.fillStyle = '#4b5a52';
  g.fillText('Qaita — упражнения для руки дома', 80, H - 70);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

/** Системное «Поделиться» с картинкой; если нельзя — скачиваем PNG и открываем WhatsApp с текстом. */
export async function shareCard(blob, text) {
  const file = new File([blob], 'qaita.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'qaita.png'; a.click();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'downloaded';
}
