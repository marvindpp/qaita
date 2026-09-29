// Анимированный человечек для экрана «Демо» [E]: сидит на стуле, двигается только рабочая рука.
// Рука — две кости (плечо → локоть → кисть), вращаются SMIL-анимацией вокруг суставов: надёжно в любом браузере.
// Вид как в зеркале: правая рука человека — справа. Для левой руки фигура отражается целиком.

const CYCLE = '3.4s';
const SPL = '0.45 0 0.55 1'; // плавно разгоняемся и тормозим — «медленно, без рывка»

// Углы (градусы, по часовой): 0 — рука висит вниз, отрицательные — наружу/вверх, положительные — к телу.
// Звезда стоит ровно там, куда в конце движения приходит кисть (плечо 40 + от локтя до кисти 42).
const MOVES = {
  reach_up: { upper: [-6, -160, -160, -6, -6], fore: [-3, 0, 0, -3, -3], star: [173, 9] },
  reach_side: { upper: [-6, -88, -88, -6, -6], fore: [-3, 0, 0, -3, -3], star: [227, 89] },
  hand_to_mouth: { upper: [-6, 34, 34, -6, -6], fore: [-3, 150, 150, -3, -3], star: [121, 64] },
  reach_across: { upper: [-6, 68, 68, -6, -6], fore: [-3, 2, 2, -3, -3], star: [68, 115] },
  open_hand: { upper: [-30, -30, -30, -30, -30], fore: [210, 210, 210, 210, 210], star: [192, 62] },
};
const KEYS = '0;0.38;0.62;0.94;1';
const SPLINES = [SPL, '0 0 1 1', SPL, '0 0 1 1'].join(';');

const rot = (values) => `<animateTransform attributeName="transform" type="rotate" values="${values.join(';')}" keyTimes="${KEYS}"
  calcMode="spline" keySplines="${SPLINES}" dur="${CYCLE}" repeatCount="indefinite"/>`;

// Длина руки фигурки от плеча до кисти (плечо 40 + предплечье с кистью 42) и точка плеча в координатах SVG.
const ARM = 82, SHOULDER = [145, 86];

/**
 * @param {string} exercise
 * @param {'left'|'right'} side
 * @param {{ liftDeg?: number }} [opts] — liftDeg: куда на самом деле стоит звезда этого человека
 *   (угол от «рука вниз» 0° до «вверх» 180°). Для «вверх» и «в сторону» фигурка тянется туда же,
 *   а не в типовую точку — иначе звезда на камере и у человечка в разных местах (живой тест 29.09).
 */
export function demoFigure(exercise, side = 'right', { liftDeg } = {}) {
  let m = MOVES[exercise] ?? MOVES.reach_up;
  if (liftDeg != null && (exercise === 'reach_up' || exercise === 'reach_side')) {
    const lift = Math.min(175, Math.max(30, liftDeg));
    const rad = (lift * Math.PI) / 180;
    m = { ...m, upper: [-6, -lift, -lift, -6, -6], star: [Math.round(SHOULDER[0] + ARM * Math.sin(rad)), Math.round(SHOULDER[1] + ARM * Math.cos(rad))] };
  }
  const flip = side === 'left' ? 'transform="translate(240 0) scale(-1 1)"' : '';
  const { star } = m;
  // Кисть: для «раскрыть ладонь» — пальцы вытягиваются (кулак ↔ ладонь), иначе — круглая ладонь.
  const hand = exercise === 'open_hand'
    ? `<g transform="translate(0 42)">
        <circle r="9" fill="#e2b79a"/>
        ${[-7.5, -2.5, 2.5, 7.5].map((x) => `<rect x="${x - 2}" y="-24" width="4" height="16" rx="2" fill="#e2b79a">
          <animate attributeName="height" values="5;16;16;5;5" keyTimes="${KEYS}" calcMode="spline" keySplines="${SPLINES}" dur="${CYCLE}" repeatCount="indefinite"/>
          <animate attributeName="y" values="-13;-24;-24;-13;-13" keyTimes="${KEYS}" calcMode="spline" keySplines="${SPLINES}" dur="${CYCLE}" repeatCount="indefinite"/>
        </rect>`).join('')}
      </g>`
    : '<circle cy="42" r="8.5" fill="#e2b79a"/>';

  return `
  <svg class="demo-figure" viewBox="0 -16 240 256" role="img" aria-label="Человечек показывает движение">
    <g ${flip}>
      <!-- звезда-цель -->
      <g class="demo-star" transform="translate(${star[0]} ${star[1]})">
        <path d="M0-14l4.1 8.4 9.3 1.3-6.7 6.6 1.6 9.2L0 7.1l-8.3 4.4 1.6-9.2-6.7-6.6 9.3-1.3z" fill="#f2b42a" stroke="#fff" stroke-width="2.5" stroke-linejoin="round">
          <animateTransform attributeName="transform" type="scale" values="1;1.12;1" dur="1.2s" repeatCount="indefinite"/>
        </path>
      </g>
      <!-- стул -->
      <rect x="82" y="70" width="76" height="120" rx="14" fill="#c9ad92"/>
      <rect x="74" y="160" width="92" height="16" rx="8" fill="#b89a7e"/>
      <path d="M84 176v48M156 176v48" stroke="#b89a7e" stroke-width="8" stroke-linecap="round"/>
      <!-- ноги -->
      <path d="M104 166v52M136 166v52" stroke="#5b6f68" stroke-width="16" stroke-linecap="round"/>
      <!-- тело -->
      <path d="M92 84q28-10 56 0l-2 84h-52z" fill="#6f8f86"/>
      <!-- неработающая рука -->
      <path d="M96 86l-10 44 8 24" stroke="#5d7b73" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="94" cy="156" r="7.5" fill="#e2b79a"/>
      <!-- голова -->
      <rect x="113" y="64" width="14" height="14" rx="5" fill="#e2b79a"/>
      <ellipse cx="120" cy="50" rx="17" ry="19" fill="#e2b79a"/>
      <path d="M103 47q2-18 17-18t17 18q-6-8-17-8t-17 8z" fill="#4a3a33"/>
      <circle cx="114" cy="51" r="2" fill="#3b2f2a"/><circle cx="126" cy="51" r="2" fill="#3b2f2a"/>
      <path d="M114 59q6 5 12 0" stroke="#a0685a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- рабочая рука: плечо → локоть → кисть -->
      <g transform="translate(${SHOULDER[0]} ${SHOULDER[1]})">
        <g>${rot(m.upper)}
          <path d="M0 0v40" stroke="#1d7552" stroke-width="14" stroke-linecap="round"/>
          <g transform="translate(0 40)">
            <g>${rot(m.fore)}
              <path d="M0 0v34" stroke="#1d7552" stroke-width="12" stroke-linecap="round"/>
              ${hand}
            </g>
          </g>
        </g>
      </g>
    </g>
  </svg>`;
}
