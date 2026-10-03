// Общие детали ролика: палитра, шрифт, анимационные помощники, зерно-«войлок», стёжка, орнамент.
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';

export const C = {
  night: '#0f1f19', night2: '#13352a', cream: '#f6ecd6', paper: '#fbf5e9', green: '#1d7552', bright: '#2ea36e',
  red: '#b8412f', ochre: '#e0a33a', gold: '#ffd66b', ink: '#1c2a25', ink2: '#4b5a54', mint: '#dcf0e4',
};
export const FONT = "'Manrope', 'DejaVu Sans', sans-serif";
// Безопасная зона Reels: сверху ~270 px (ник, «подписаться»), снизу ~420 px (подпись, кнопки). Текст — только между.
export const SAFE = { top: 300, bottom: 1480 };

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
export const ease = Easing.bezier(0.23, 1, 0.32, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

/** 0→1 за `dur` кадров начиная с `at` (с плавным выходом). */
export function useT(at, dur = 12, e = ease) {
  const f = useCurrentFrame();
  return interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: e });
}
/** Пружина с началом в кадре `at`. */
export function useSpring(at, cfg = { damping: 12, stiffness: 170, mass: 0.8 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: cfg });
}
/** Слово «впечатывается»: большое и размытое → на место, с лёгким перелётом. */
export function Slam({ at, children, style, from = 1.7 }) {
  const f = useCurrentFrame();
  const s = useSpring(at, { damping: 13, stiffness: 260, mass: 0.7 });
  if (f < at) return null;
  const scale = interpolate(s, [0, 1], [from, 1]);
  const blur = interpolate(f, [at, at + 5], [14, 0], clamp);
  const op = interpolate(f, [at, at + 3], [0, 1], clamp);
  return <div style={{ ...style, transform: `${style?.transform ?? ''} scale(${scale})`, filter: `blur(${blur}px)`, opacity: op }}>{children}</div>;
}
/** Тряска камеры после удара (затухает за ~10 кадров). */
export function shake(f, at, power = 18) {
  const k = f - at;
  if (k < 0 || k > 12) return 'translate(0,0)';
  const a = power * Math.exp(-k / 3.2);
  return `translate(${Math.sin(k * 7.1) * a}px, ${Math.cos(k * 5.3) * a}px)`;
}

/** Зерно-«войлок» поверх всего кадра. */
export function Grain({ opacity = 0.07 }) {
  return (
    <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

/** Стёжка: пунктирная линия, которая «прошивается» слева направо. */
export function Stitch({ at, dur = 14, y = 960, x1 = 120, x2 = 960, color = C.cream, width = 6 }) {
  const t = useT(at, dur);
  const len = x2 - x1;
  return (
    <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
      <line x1={x1} y1={y} x2={x1 + len * t} y2={y} stroke={color} strokeWidth={width} strokeDasharray="22 16" strokeLinecap="round" />
    </svg>
  );
}

/** Полоса орнамента «қошқар мүйіз» (войлок, красное с охрой). */
export function Ornament({ y = 1840, h = 80, offset = 0 }) {
  const pat = `<svg xmlns='http://www.w3.org/2000/svg' width='112' height='80'><path d='M16 56 q0 -30 28 -18 q28 -12 28 18 M16 56 q-12 0 -12 -12 M72 56 q12 0 12 -12' stroke='%23e0a33a' stroke-width='7' fill='none' stroke-linecap='round'/></svg>`;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, height: h, background: `${C.red} url("data:image/svg+xml,${pat.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}") repeat-x`, backgroundSize: `${h * 1.4}px ${h}px`, backgroundPositionX: offset }}>
      <div style={{ position: 'absolute', inset: '8px 0', borderTop: '3px dashed rgba(255,246,228,.55)', borderBottom: '3px dashed rgba(255,246,228,.55)' }} />
    </div>
  );
}

/** Простой «войлочный» человечек для инфографики. */
export function Person({ color = C.cream, size = 120, glow = 0 }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 80 120" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${glow}px ${C.bright})` : 'none' }}>
      <circle cx="40" cy="26" r="20" fill={color} />
      <path d="M8 118 C8 70 20 54 40 54 C60 54 72 70 72 118 Z" fill={color} />
      <circle cx="40" cy="26" r="15" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="2.5" strokeDasharray="5 4" />
    </svg>
  );
}
