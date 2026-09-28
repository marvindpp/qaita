// Жесты-команды (камера вместо мыши): ладонь = ОК, палец вверх = повтор подсказки,
// две ладони = пауза, поднять руку = выбрать её для тренировки.
const H = { WRIST: 0, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4, TIPS: [8, 12, 16, 20], PIPS: [6, 10, 14, 18] };
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const GESTURE_HOLD_MS = { PALM_HOLD: 1000, THUMBS_UP: 700, PAUSE: 800, RAISE_LEFT: 1000, RAISE_RIGHT: 1000 };

// Палец выпрямлен: кончик заметно дальше от запястья, чем средний сустав.
const fingerExtended = (hand, i) => d(hand[H.TIPS[i]], hand[H.WRIST]) > d(hand[H.PIPS[i]], hand[H.WRIST]) * 1.15;
const fingerFolded = (hand, i) => d(hand[H.TIPS[i]], hand[H.WRIST]) < d(hand[H.PIPS[i]], hand[H.WRIST]) * 1.05;

export function isOpenPalm(hand) {
  return Boolean(hand) && [0, 1, 2, 3].every((i) => fingerExtended(hand, i));
}

export function isThumbsUp(hand) {
  if (!hand) return false;
  const up = hand[H.THUMB_TIP].y < hand[H.THUMB_IP].y && hand[H.THUMB_IP].y < hand[H.THUMB_MCP].y;
  const clearlyUp = hand[H.THUMB_MCP].y - hand[H.THUMB_TIP].y > d(hand[H.WRIST], hand[5]) * 0.6;
  return up && clearlyUp && [0, 1, 2, 3].every((i) => fingerFolded(hand, i));
}

/** Какой жест виден в этом кадре (без учёта удержания). */
export function detectGesture({ hands = [], m, allow }) {
  const palms = hands.filter(isOpenPalm).length;
  if (allow.has('PAUSE') && palms >= 2) return 'PAUSE';
  if (allow.has('THUMBS_UP') && hands.some(isThumbsUp)) return 'THUMBS_UP';
  if (allow.has('PALM_HOLD') && palms === 1) return 'PALM_HOLD';
  if (m && (allow.has('RAISE_LEFT') || allow.has('RAISE_RIGHT'))) {
    const up = (w, sh) => w && sh.y - w.y > m.S * 0.3;
    // m.wrist — рабочая рука, m.otherWrist — другая; сравниваем обе стороны по индексам плеч.
    const right = m.side === 'right' ? up(m.wrist, m.rsh) : up(m.otherWrist, m.rsh);
    const left = m.side === 'left' ? up(m.wrist, m.lsh) : up(m.otherWrist, m.lsh);
    if (right && !left && allow.has('RAISE_RIGHT')) return 'RAISE_RIGHT';
    if (left && !right && allow.has('RAISE_LEFT')) return 'RAISE_LEFT';
  }
  return null;
}

/** Удержание: progress 0..1, fired — один раз за удержание; повтор только после отпускания. */
export function createGestureHold() {
  let type = null, since = 0, fired = false, lastSent = -1;
  return {
    update(seen, t) {
      const events = [];
      if (seen !== type) {
        if (type && lastSent > 0 && !fired) events.push({ type, progress: 0, fired: false });
        type = seen; since = t; fired = false; lastSent = -1;
      }
      if (!type || fired) return events;
      const progress = Math.min(1, (t - since) / GESTURE_HOLD_MS[type]);
      if (progress >= 1) {
        fired = true;
        events.push({ type, progress: 1, fired: true });
        return events;
      }
      const q = Math.floor(progress * 10) / 10; // не шлём каждый кадр — шаг 10%, 1.0 только при срабатывании
      if (q !== lastSent) {
        lastSent = q;
        events.push({ type, progress: q, fired: false });
      }
      return events;
    },
  };
}
