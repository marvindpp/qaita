// Эффекты видео-питча 16:9: дождь, молния, тучи, ЭКГ, конфетти, штамп, мем-карточка, уведомление, кольцо.
import { useCurrentFrame, interpolate, random, Img, staticFile } from 'remotion';
import { C, FONT, clamp, ease, useSpring } from '../kit.jsx';
import { W, H, CUES, FPS } from './timing.js';

export const img = (n) => staticFile(`img/${n}`);
export const full = { position: 'absolute', inset: 0 };
export const txt = (size, color = C.cream, weight = 800) => ({ fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.08, letterSpacing: size > 90 ? -size * 0.03 : 0 });

/** Кадр ключевого момента сцены: точное время из озвучки (CUES) или доля длины сцены. */
export function cue(scene, name, frac, d) {
  const sec = CUES?.[scene]?.[name];
  return sec != null ? Math.round(sec * FPS) : Math.round(frac * d);
}

/** Появление: прозрачность + сдвиг снизу. */
export function useIn(at, dur = 12, dist = 40) {
  const f = useCurrentFrame();
  const t = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: ease });
  return { opacity: t, transform: `translateY(${(1 - t) * dist}px)` };
}
/** Окно видимости [a, b) с плавными краями. */
export function useWin(a, b, fade = 8) {
  const f = useCurrentFrame();
  return interpolate(f, [a - 1, a + fade, b - fade, b], [0, 1, 1, 0], clamp);
}

export function Grain({ opacity = 0.07 }) {
  return (
    <svg width={W} height={H} style={{ ...full, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <filter id="g16"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter="url(#g16)" />
    </svg>
  );
}

export function Vignette({ strength = 0.6 }) {
  return <div style={{ ...full, background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: 'none' }} />;
}

/** Косой ливень. */
export function Rain({ n = 160, speed = 55, angle = 12, color = 'rgba(200,220,235,.55)', len = 70, opacity = 1 }) {
  const f = useCurrentFrame();
  const dx = Math.tan((angle * Math.PI) / 180);
  return (
    <svg width={W} height={H} style={{ ...full, opacity, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const x0 = random(`rx${i}`) * (W + 400) - 200;
        const v = speed * (0.7 + random(`rv${i}`) * 0.6);
        const y = ((random(`ry${i}`) * (H + 200) + f * v) % (H + 200)) - 100;
        const x = x0 - (y + 100) * dx;
        const l = len * (0.6 + random(`rl${i}`) * 0.7);
        return <line key={i} x1={x} y1={y} x2={x + l * dx} y2={y - l} stroke={color} strokeWidth={1.5 + random(`rw${i}`) * 1.5} strokeLinecap="round" />;
      })}
    </svg>
  );
}

/** Капли, стекающие по стеклу (грустная сцена). */
export function WindowDrops({ n = 40 }) {
  const f = useCurrentFrame();
  return (
    <svg width={W} height={H} style={{ ...full, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const x = random(`wx${i}`) * W;
        const v = 1.5 + random(`wv${i}`) * 4;
        const y = ((random(`wy${i}`) * H + f * v) % (H + 60)) - 30;
        const r = 4 + random(`wr${i}`) * 7;
        return (
          <g key={i} opacity={0.55}>
            <line x1={x} y1={y - r * 9} x2={x} y2={y} stroke="rgba(220,235,245,.25)" strokeWidth={r * 0.7} strokeLinecap="round" />
            <circle cx={x} cy={y} r={r} fill="rgba(230,240,250,.35)" stroke="rgba(255,255,255,.45)" strokeWidth="1.2" />
          </g>
        );
      })}
    </svg>
  );
}

/** Вспышка молнии с зигзагом. at — кадр удара. */
export function Lightning({ at, x = 0.7, seed = 1 }) {
  const f = useCurrentFrame();
  const k = f - at;
  if (k < -1 || k > 16) return null;
  const flash = k < 0 ? 0 : k < 2 ? 1 : k < 4 ? 0.35 : k < 6 ? 0.85 : Math.max(0, 0.6 - (k - 6) * 0.07);
  const pts = [];
  let px = x * W, py = -20;
  for (let i = 0; i < 9; i++) {
    pts.push(`${px},${py}`);
    px += (random(`lx${seed}${i}`) - 0.5) * 220;
    py += 60 + random(`ly${seed}${i}`) * 50;
  }
  const bolt = k >= 0 && k < 8;
  return (
    <>
      <div style={{ ...full, background: `rgba(225,235,255,${flash * 0.75})`, mixBlendMode: 'screen' }} />
      {bolt && (
        <svg width={W} height={H} style={full}>
          <polyline points={pts.join(' ')} fill="none" stroke="rgba(190,210,255,.6)" strokeWidth={22} strokeLinejoin="round" style={{ filter: 'blur(10px)' }} />
          <polyline points={pts.join(' ')} fill="none" stroke="#fff" strokeWidth={5} strokeLinejoin="round" />
        </svg>
      )}
    </>
  );
}

/** Тяжёлые тучи, медленно плывут. part — 0..1, на сколько разъехались (для рассвета). */
export function Clouds({ dark = '#141c22', part = 0, opacity = 1 }) {
  const f = useCurrentFrame();
  return (
    <svg width={W} height={H} style={{ ...full, opacity, pointerEvents: 'none' }}>
      <filter id="cblur"><feGaussianBlur stdDeviation="28" /></filter>
      <g filter="url(#cblur)">
        {Array.from({ length: 14 }, (_, i) => {
          const side = i % 2 ? 1 : -1;
          const cx = random(`cx${i}`) * W + Math.sin(f / 90 + i) * 40 + side * part * 1300;
          const cy = 40 + random(`cy${i}`) * 260 - part * 200;
          return <ellipse key={i} cx={cx} cy={cy} rx={260 + random(`cr${i}`) * 260} ry={90 + random(`cq${i}`) * 80} fill={i % 3 ? dark : '#1d2830'} opacity={0.9} />;
        })}
      </g>
    </svg>
  );
}

/** Линия ЭКГ с ударами сердца. bpm — частота, flat — 0..1 затухание в прямую. */
export function Ecg({ y = 900, color = C.red, bpm = 72, flat = 0, opacity = 1 }) {
  const f = useCurrentFrame();
  const per = (60 / bpm) * FPS;
  const pts = [];
  for (let x = 0; x <= W; x += 6) {
    const t = ((x / W) * 3 * per + f * 2) % per; // бегущая волна
    let v = 0;
    if (t > per * 0.4 && t < per * 0.44) v = -20;
    else if (t >= per * 0.44 && t < per * 0.47) v = 120;
    else if (t >= per * 0.47 && t < per * 0.5) v = -60;
    else if (t >= per * 0.6 && t < per * 0.7) v = -18 * Math.sin(((t - per * 0.6) / (per * 0.1)) * Math.PI);
    pts.push(`${x},${y - v * (1 - flat)}`);
  }
  return (
    <svg width={W} height={H} style={{ ...full, opacity }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={10} opacity={0.25} style={{ filter: 'blur(6px)' }} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
}

/** Кольцо, которое ЗАПОЛНЯЕТСЯ по часовой стрелке от 12 часов (t: 0 → пусто, 1 → полный круг). */
export function FillRing({ t, size = 300, stroke = 22, color = C.bright, track = 'rgba(255,255,255,.14)', children }) {
  const r = (size - stroke) / 2;
  const L = 2 * Math.PI * r;
  const tt = Math.max(0, Math.min(1, t));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {tt > 0.001 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap={tt < 0.999 ? 'round' : 'butt'}
            strokeDasharray={`${L * tt} ${L}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

/** Конфетти-хлопок из точки. */
export function Confetti({ at, x = W / 2, y = H / 2, n = 90, power = 1 }) {
  const f = useCurrentFrame();
  const k = f - at;
  if (k < 0 || k > 75) return null;
  const cols = [C.gold, C.red, C.bright, C.ochre, '#fff', '#5ab0e0'];
  return (
    <svg width={W} height={H} style={{ ...full, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`ca${i}`) * Math.PI * 2;
        const v = (14 + random(`cv${i}`) * 26) * power;
        const px = x + Math.cos(a) * v * k * 0.9;
        const py = y + Math.sin(a) * v * k * 0.9 - 4 * k + 0.55 * k * k;
        const rot = k * (random(`cr${i}`) * 30 - 15);
        const s = 10 + random(`cs${i}`) * 12;
        return <rect key={i} x={px} y={py} width={s} height={s * 0.55} fill={cols[i % cols.length]} transform={`rotate(${rot} ${px} ${py})`} opacity={Math.max(0, 1 - k / 75)} />;
      })}
    </svg>
  );
}

/** Штамп, который «шлёпается» с перелётом. */
export function Stamp({ at, children, color = C.red, rotate = -12, style }) {
  const f = useCurrentFrame();
  const s = useSpring(at, { damping: 9, stiffness: 320, mass: 0.6 });
  if (f < at) return null;
  const scale = interpolate(s, [0, 1], [2.6, 1]);
  return (
    <div style={{ position: 'absolute', ...style, transform: `rotate(${rotate}deg) scale(${scale})`, opacity: Math.min(1, s * 2) }}>
      <div style={{ ...txt(64, color), textTransform: 'uppercase', padding: '14px 34px', border: `8px solid ${color}`, borderRadius: 18, background: 'rgba(255,255,255,.88)', letterSpacing: 4, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>{children}</div>
    </div>
  );
}

/** Мем-подпись: белые прописные буквы с чёрной обводкой. */
export function MemeText({ children, size = 64, style }) {
  return (
    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, color: '#fff', textTransform: 'uppercase', textAlign: 'center', WebkitTextStroke: `${Math.max(3, size / 14)}px #111`, paintOrder: 'stroke fill', lineHeight: 1.05, ...style }}>{children}</div>
  );
}

/** Войлочная карточка со стёжкой. */
export function Felt({ children, bg = '#fff', style }) {
  return (
    <div style={{ position: 'relative', background: bg, borderRadius: 30, boxShadow: '0 2px 3px rgba(60,45,20,.08), 0 24px 60px rgba(60,45,20,.22)', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', inset: 12, border: '3px dashed rgba(120,90,50,.28)', borderRadius: 22, pointerEvents: 'none' }} />
      {children}
    </div>
  );
}

/** Уведомление как на телефоне. */
export function Toast({ at, icon, app, title, body, style }) {
  const s = useSpring(at, { damping: 14, stiffness: 200 });
  const f = useCurrentFrame();
  if (f < at) return null;
  return (
    <div style={{ position: 'absolute', width: 760, ...style, transform: `translateY(${(1 - s) * -220}px)`, opacity: Math.min(1, s * 1.5) }}>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', background: 'rgba(250,250,250,.96)', borderRadius: 34, padding: '24px 30px', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}>
        <div style={{ width: 84, height: 84, borderRadius: 22, background: C.night2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ ...txt(24, '#777', 700) }}>{app} · сейчас</div>
          <div style={{ ...txt(36, '#111') }}>{title}</div>
          {body && <div style={{ ...txt(30, '#333', 500), marginTop: 4 }}>{body}</div>}
        </div>
      </div>
    </div>
  );
}

/** Ачивка как в играх. */
export function Achievement({ at, title, style }) {
  const f = useCurrentFrame();
  const s = useSpring(at, { damping: 13, stiffness: 180 });
  if (f < at) return null;
  const w = interpolate(s, [0, 1], [130, 900]);
  return (
    <div style={{ position: 'absolute', ...style, display: 'flex', justifyContent: 'center', left: 0, right: 0 }}>
      <div style={{ width: w, height: 130, borderRadius: 999, background: '#1e1e1e', display: 'flex', alignItems: 'center', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,.4)', border: `4px solid ${C.gold}` }}>
        <div style={{ flex: '0 0 122px', height: 122, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 66 }}>🏆</div>
        <div style={{ paddingLeft: 26, whiteSpace: 'nowrap', opacity: interpolate(s, [0.6, 1], [0, 1], clamp) }}>
          <div style={{ ...txt(26, '#bbb', 700) }}>Достижение получено</div>
          <div style={{ ...txt(44, '#fff') }}>{title}</div>
        </div>
      </div>
    </div>
  );
}

/** Ноутбук 16:10 с содержимым. */
export function Laptop({ width = 1100, children, style }) {
  return (
    <div style={{ position: 'absolute', width, ...style }}>
      <div style={{ background: '#22302b', borderRadius: 30, padding: 18, boxShadow: '0 40px 90px rgba(20,15,5,.4)' }}>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 10', background: '#fbf5e9' }}>{children}</div>
      </div>
      <div style={{ height: 26, margin: '0 -46px', background: 'linear-gradient(#cfc6b5,#a89e8c)', borderRadius: '0 0 28px 28px' }} />
    </div>
  );
}

/** Войлочная чашка с паром (SVG). */
export function Cup({ size = 260, steam = true }) {
  const f = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
      {steam && [0, 1, 2].map((i) => (
        <path key={i} d={`M${70 + i * 25} 60 q-12 -18 0 -34 q12 -16 0 -32`} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="6" strokeLinecap="round"
          transform={`translate(${Math.sin(f / 12 + i) * 4} ${-((f / 2 + i * 10) % 14)})`} opacity={0.5 + 0.3 * Math.sin(f / 9 + i)} />
      ))}
      <path d="M150 95 q38 0 38 32 q0 32 -40 30" fill="none" stroke="#a83a2a" strokeWidth="14" />
      <path d="M40 70 h120 v80 q0 34 -34 34 h-52 q-34 0 -34 -34 z" fill={C.red} />
      <path d="M40 70 h120 v80 q0 34 -34 34 h-52 q-34 0 -34 -34 z" fill="none" stroke="rgba(255,240,220,.6)" strokeWidth="3" strokeDasharray="7 6" transform="translate(6 6) scale(.94)" />
      <path d="M58 105 q20 -14 42 0 q22 14 42 0" fill="none" stroke={C.ochre} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="100" cy="72" rx="60" ry="9" fill="#5a2a1c" />
    </svg>
  );
}

/** Рука, тянущаяся слева (войлок). reach 0..1 — насколько вытянута, droop — опускание, grip — пальцы обхватили. */
export function Arm({ reach = 0, droop = 0, grip = 0, lift = 0, shake = 0, x = 0, y = 0 }) {
  const f = useCurrentFrame();
  const tremble = Math.sin(f * 1.7) * 3 * shake;
  const len = 420 + reach * 520;
  const ang = droop * 14 - lift * 8;
  return (
    <div style={{ position: 'absolute', left: x - 120, top: y + tremble - lift * 120, transformOrigin: '0 50%', transform: `rotate(${ang}deg)` }}>
      <svg width={len + 200} height={220} style={{ overflow: 'visible' }}>
        <rect x="0" y="70" width={len} height="96" rx="48" fill="#d9a77e" />
        <rect x="0" y="70" width={len} height="96" rx="48" fill="none" stroke="rgba(110,60,30,.35)" strokeWidth="3" strokeDasharray="9 7" transform="translate(4 4)" />
        <rect x="0" y="62" width={Math.max(0, len - 260)} height="112" rx="40" fill="#3f6d8a" />
        <g transform={`translate(${len - 30} ${118})`}>
          <ellipse cx="40" cy="0" rx="62" ry="54" fill="#e2b48d" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={70 - grip * 40} y={-48 + i * 26} width={70 - grip * 30} height="24" rx="12" fill="#e2b48d" transform={grip ? `rotate(${grip * 40} ${70} ${-36 + i * 26})` : undefined} />
          ))}
          <rect x="10" y="30" width="56" height="26" rx="13" fill="#e2b48d" transform={`rotate(${-30 - grip * 20} 20 40)`} />
        </g>
      </svg>
    </div>
  );
}

export { C, FONT, clamp, ease };
