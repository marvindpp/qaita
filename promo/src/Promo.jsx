// Промо Qaita, 1080×1920, 30 с. Каждая склейка — на долю (15 кадров), сетка — timing.js.
// Боль (тёмно, глухо) → поворот (вспышка, логотип) → решение (свет, войлок, грув) → чистый финальный кадр.
import { AbsoluteFill, Sequence, Img, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { S, BEAT } from './timing.js';
import { C, FONT, SAFE, clamp, ease, easeIn, useT, useSpring, Slam, shake, Grain, Stitch, Ornament, Person } from './kit.jsx';
import { LOGO_SVG } from './logo.js';

const img = (n) => staticFile(`img/${n}`);
const center = { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: FONT };
const seq = ([a, b]) => ({ from: a, durationInFrames: b - a });

// ——— 1. ХУК: удар на каждую долю ———
function Hook() {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [30, 47], [0, 40000], { ...clamp, easing: ease }) / 100) * 100;
  const zoom = interpolate(f, [76, 90], [1, 9], { ...clamp, easing: easeIn });
  const outUp = useT(28, 8);
  const redW = useT(45, 9);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ transform: `${shake(f, 30, 26)} scale(${zoom})`, transformOrigin: '540px 900px' }}>
        <Stitch at={0} dur={10} y={560} color={C.ochre} />
        <div style={{ opacity: 1 - outUp, transform: `translateY(${-outUp * 160}px)` }}>
          <Slam at={0} style={{ ...center, top: 600, fontSize: 150, fontWeight: 800, color: C.cream, letterSpacing: -4 }}>КАЖДЫЙ</Slam>
          <Slam at={BEAT} style={{ ...center, top: 760, fontSize: 150, fontWeight: 800, color: C.cream, letterSpacing: -4 }}>ГОД</Slam>
        </div>
        <Slam at={30} from={2.4} style={{ ...center, top: 700, fontSize: 290, fontWeight: 800, color: C.ochre, letterSpacing: -14, fontVariantNumeric: 'tabular-nums' }}>
          {n.toLocaleString('ru-RU').replace(/ /g, ' ')}
        </Slam>
        {f >= 45 && (
          <div style={{ position: 'absolute', top: 1040, left: 90, right: 90, height: 170, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: C.red, transform: `scaleX(${redW})`, transformOrigin: 'left', borderRadius: 18 }} />
            <div style={{ ...center, top: 18, fontSize: 112, fontWeight: 800, color: C.cream, letterSpacing: -3, opacity: redW }}>ИНСУЛЬТОВ</div>
          </div>
        )}
        <Slam at={60} style={{ ...center, top: 1250, fontSize: 58, fontWeight: 700, color: C.cream, letterSpacing: 10, opacity: 0.85 }}>В КАЗАХСТАНЕ</Slam>
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
}

// ——— 2. «каждый пятый» ———
function Fifth() {
  const f = useCurrentFrame();
  const lit = useT(45, 10);
  const swap = useT(68, 10);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <div style={{ ...center, top: SAFE.top + 70, fontSize: 72, fontWeight: 700, color: C.cream, opacity: useT(0, 8) * (1 - swap) }}>Реабилитацию получает</div>
      <div style={{ ...center, top: SAFE.top + 70, fontSize: 72, fontWeight: 700, color: C.cream, opacity: swap }}>Остальные — дома.</div>
      <div style={{ position: 'absolute', top: 640, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const s = useSpring(15 + i * 7.5, { damping: 11, stiffness: 220 });
          const fifth = i === 4;
          const dim = fifth ? 0 : lit;
          return (
            <div key={i} style={{ transform: `translateY(${(1 - s) * 140}px) scale(${fifth ? 1 + lit * 0.32 : 1 - swap * 0.12})`, opacity: Math.min(1, s * 1.4) * (fifth ? 1 : 1 - swap * 0.55), transformOrigin: '50% 100%' }}>
              <Person size={150} color={fifth ? (lit > 0.01 ? C.bright : C.cream) : `rgba(246,236,214,${1 - dim * 0.72})`} glow={fifth ? lit * 40 : 0} />
            </div>
          );
        })}
      </div>
      <div style={{ opacity: 1 - swap }}><Slam at={52} style={{ ...center, top: 1060, fontSize: 132, fontWeight: 800, color: C.bright, letterSpacing: -4 }}>каждый пятый</Slam></div>
      <Slam at={70} style={{ ...center, top: 1060, fontSize: 150, fontWeight: 800, color: C.cream, letterSpacing: -5 }}>Одни.</Slam>
      <Grain />
    </AbsoluteFill>
  );
}

// ——— 3. «у врача 15 минут» — сердцебиение ———
function Doctor() {
  const f = useCurrentFrame();
  const beat = [0, 30, 60].reduce((s, b) => s + Math.max(0, 1 - Math.abs(f - b) / 5) * 0.06 + Math.max(0, 1 - Math.abs(f - b - 7) / 5) * 0.035, 0);
  const ring = useT(0, 80, (x) => x);
  const push = interpolate(f, [0, 90], [1, 1.1], clamp);
  const r = 300, L = 2 * Math.PI * r;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, #183f33 0%, ${C.night} 70%)` }}>
      <AbsoluteFill style={{ transform: `scale(${push + beat})` }}>
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="540" cy="820" r={r} fill="none" stroke="rgba(246,236,214,.12)" strokeWidth="26" />
          <circle cx="540" cy="820" r={r} fill="none" stroke={C.red} strokeWidth="26" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * ring} transform="rotate(-90 540 820)" />
        </svg>
        <div style={{ ...center, top: 640, fontSize: 300, fontWeight: 800, color: C.cream, letterSpacing: -12, lineHeight: 1 }}>15</div>
        <div style={{ ...center, top: 950, fontSize: 64, fontWeight: 700, color: C.cream, opacity: 0.85 }}>минут у врача</div>
      </AbsoluteFill>
      <Slam at={38} style={{ ...center, top: 1250, fontSize: 70, fontWeight: 800, color: C.ochre }}>Он не видит,</Slam>
      <Slam at={52} style={{ ...center, top: 1340, fontSize: 70, fontWeight: 800, color: C.ochre }}>что дома.</Slam>
      <Grain />
    </AbsoluteFill>
  );
}

// ——— 4. ПОВОРОТ: райзер → вспышка → логотип ———
function Turn() {
  const f = useCurrentFrame(); // 0 = 9 с, 30 = дроп
  const build = interpolate(f, [0, 30], [0, 1], { ...clamp, easing: easeIn });
  const flash = interpolate(f, [27, 30, 36], [0, 1, 0], clamp);
  const iris = interpolate(f, [30, 40], [0, 1500], { ...clamp, easing: ease });
  const logo = useSpring(30, { damping: 9, stiffness: 140, mass: 0.9 });
  const spin = interpolate(f, [30, 60], [-40, 0], { ...clamp, easing: ease });
  const word = useT(36, 10);
  const sub = useT(45, 10);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {/* до дропа: кольцо шаңырақа собирается из линий, всё дрожит */}
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, transform: `translate(${Math.sin(f * 3) * build * 6}px, ${Math.cos(f * 4) * build * 6}px)` }}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2 + build * 1.5;
          const r1 = 900 - build * 640, r2 = r1 + 120;
          return <line key={i} x1={540 + Math.cos(a) * r1} y1={860 + Math.sin(a) * r1} x2={540 + Math.cos(a) * r2} y2={860 + Math.sin(a) * r2} stroke={C.ochre} strokeWidth={12} strokeLinecap="round" opacity={0.25 + build * 0.75} />;
        })}
        <circle cx="540" cy="860" r={260 - build * 120} fill="none" stroke={C.gold} strokeWidth={14} opacity={0.3 + build * 0.7} strokeDasharray="30 18" />
      </svg>
      {/* вопрос-поворот перед дропом */}
      <div style={{ opacity: interpolate(f, [24, 29], [1, 0], clamp) }}>
        <Slam at={1} style={{ ...center, top: 330, fontSize: 104, fontWeight: 800, color: C.cream, letterSpacing: -3 }}>А если</Slam>
        <Slam at={8} style={{ ...center, top: 460, fontSize: 104, fontWeight: 800, color: C.cream, letterSpacing: -3 }}>реабилитолог</Slam>
        <Slam at={15} style={{ ...center, top: 1230, fontSize: 132, fontWeight: 800, color: C.ochre, letterSpacing: -4 }}>— дома?</Slam>
      </div>
      {/* после дропа: кремовый свет раскрывается кругом из центра */}
      <div style={{ position: 'absolute', left: 540 - iris, top: 860 - iris, width: iris * 2, height: iris * 2, borderRadius: '50%', background: C.cream }} />
      {f >= 30 && (
        <>
          <div style={{ position: 'absolute', left: 540 - 230, top: 640, width: 460, height: 460, transform: `scale(${logo}) rotate(${spin}deg)` }} dangerouslySetInnerHTML={{ __html: LOGO_SVG.replace('<svg ', '<svg width="460" height="460" ') }} />
          <div style={{ ...center, top: 1150, fontSize: 170, fontWeight: 800, color: C.green, letterSpacing: -6, opacity: word, transform: `translateY(${(1 - word) * 60}px)` }}>Qaita</div>
          <div style={{ ...center, top: 1350, fontSize: 52, fontWeight: 700, color: C.ink2, opacity: sub }}>қайта — «снова»</div>
        </>
      )}
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— Ноутбук-мокап ———
function Laptop({ src, children, style }) {
  return (
    <div style={{ position: 'absolute', width: 920, left: 80, ...style }}>
      <div style={{ background: '#22302b', borderRadius: 34, padding: 20, boxShadow: '0 40px 80px rgba(40,30,10,.35)' }}>
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
          <Img src={src} style={{ width: '100%', display: 'block' }} />
          {children}
        </div>
      </div>
      <div style={{ height: 30, margin: '0 -50px', background: 'linear-gradient(#c9bfae,#a89e8c)', borderRadius: '0 0 30px 30px' }} />
    </div>
  );
}

// ——— 5. «Ссылка. Вебкамера. Всё.» ———
function Link() {
  const f = useCurrentFrame();
  const lap = useSpring(45, { damping: 14, stiffness: 120 });
  const ring = useT(75, 30, (x) => x);
  const whip = interpolate(f, [108, 120], [0, -1300], { ...clamp, easing: easeIn });
  const blur = interpolate(f, [108, 120], [0, 30], clamp);
  const words = [['Ссылка.', 0], ['Вебкамера.', BEAT], ['Всё.', BEAT * 2]];
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <AbsoluteFill style={{ transform: `translateX(${whip}px)`, filter: `blur(${blur}px)` }}>
        {words.map(([w, at], i) => {
          const up = useT(45, 10);
          return (
            <Slam key={w} at={at} style={{ ...center, top: 400 + i * 150 - up * 0, fontSize: i === 2 ? 150 : 128, fontWeight: 800, color: i === 2 ? C.green : C.ink, letterSpacing: -5, opacity: 1 - up * 0.0 }}>
              {w}
            </Slam>
          );
        })}
        <div style={{ ...center, top: 310, fontSize: 50, fontWeight: 700, color: C.ink2, opacity: useT(45, 10) * (1 - useT(72, 6)) }}>Без установки. Без мыши.</div>
        <div style={{ ...center, top: 300, fontSize: 56, fontWeight: 800, color: C.green, opacity: useT(74, 8) }}>✋ Покажи ладонь — и начали</div>
        <Laptop src={img('welcome.png')} style={{ top: 920, width: 840, left: 120, transform: `perspective(1600px) rotateX(${(1 - lap) * 50}deg) translateY(${(1 - lap) * 700}px)`, transformOrigin: '50% 100%' }}>
          {/* «покажи ладонь» — кольцо заполняется поверх экрана */}
          {f > 70 && (
            <svg viewBox="0 0 100 100" style={{ position: 'absolute', right: '17%', top: '14%', width: '20%' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(29,117,82,.2)" strokeWidth="8" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={C.bright} strokeWidth="8" strokeLinecap="round" strokeDasharray={276} strokeDashoffset={276 * (1 - ring)} transform="rotate(-90 50 50)" />
            </svg>
          )}
        </Laptop>
      </AbsoluteFill>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 6. Режим «ошибка» ———
function ErrorMode() {
  const f = useCurrentFrame(); // 0 = 15 с; «Так правильно» на 16,5 с = 45
  const inT = useSpring(0, { damping: 15, stiffness: 140 });
  const zoom = interpolate(f, [8, 40], [1, 1.32], { ...clamp, easing: ease });
  const ok = useSpring(45, { damping: 8, stiffness: 200 });
  const pulse = f < 45 ? 0.5 + 0.5 * Math.sin(f / 2.4) : 0;
  return (
    <AbsoluteFill style={{ background: C.night2 }}>
      <div style={{ ...center, top: SAFE.top + 10, fontSize: 40, fontWeight: 800, color: C.ochre, letterSpacing: 8 }}>РЕЖИМ «ОШИБКА»</div>
      <Slam at={4} style={{ ...center, top: SAFE.top + 70, fontSize: 104, fontWeight: 800, color: C.cream, letterSpacing: -3 }}>Видит, как врач</Slam>
      <div style={{ position: 'absolute', top: 560, left: 50, width: 980, height: 700, borderRadius: 34, overflow: 'hidden', transform: `translateY(${(1 - inT) * 900}px) rotate(${(1 - inT) * -8}deg)`, boxShadow: `0 0 0 6px ${f < 45 ? `rgba(224,85,63,${0.4 + pulse * 0.6})` : C.bright}, 0 40px 80px rgba(0,0,0,.45)` }}>
        <Img src={img('play-mistake.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, transformOrigin: '50% 92%' }} />
      </div>
      {f >= 45 && (
        <div style={{ position: 'absolute', top: 1150, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ transform: `scale(${ok}) rotate(${(1 - ok) * 20 - 4}deg)`, background: C.bright, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 72, padding: '26px 48px', borderRadius: 999, boxShadow: '0 20px 50px rgba(46,163,110,.5)', outline: '4px dashed rgba(255,255,255,.6)', outlineOffset: -14 }}>
            Так правильно! +50
          </div>
        </div>
      )}
      <div style={{ ...center, top: 1350, fontSize: 54, fontWeight: 700, color: C.cream, opacity: useT(60, 10) }}>Исправил — повтор засчитан</div>
      <Grain />
    </AbsoluteFill>
  );
}

// ——— 7. Мир «Шаңырақ»: юрта строится по долям ———
function Home() {
  const f = useCurrentFrame(); // 0 = 19 с; этапы на 19,5 с + k·доля
  const stage = Math.max(0, Math.min(7, Math.floor((f - 15) / BEAT) + 1));
  const since = f - (15 + (stage - 1) * BEAT);
  const pop = stage ? interpolate(since, [0, 4, 9], [0.86, 1.06, 1], clamp) : 0;
  const cam = interpolate(f, [0, 120], [1.06, 1.16], clamp);
  const trees = Math.min(4, Math.max(0, Math.floor((f - 30) / (BEAT * 1.5)) + 1));
  return (
    <AbsoluteFill style={{ background: '#f3e3c3' }}>
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: '50% 70%' }}>
        <Img src={img('steppe.webp')} style={{ position: 'absolute', left: -700, top: 820, width: 2480, height: 1100, objectFit: 'cover', objectPosition: '50% 90%' }} />
        {stage > 0 && <Img src={img(`yurt-${stage}.webp`)} style={{ position: 'absolute', left: 90, top: 760, width: 640, transform: `scale(${pop})`, transformOrigin: '50% 90%' }} />}
        {[0, 1, 2, 3].slice(0, trees).map((i) => {
          const s = interpolate(f - (30 + i * BEAT * 1.5), [0, 10], [0, 1], { ...clamp, easing: ease });
          return <Img key={i} src={img(`tree-${Math.min(4, 4 - i)}.webp`)} style={{ position: 'absolute', left: 560 + (i % 2) * 170 - (i > 1 ? 60 : 0), top: 780 + (i > 1 ? 130 : 0) - (i % 2) * 40, width: 300, transform: `scale(${s})`, transformOrigin: '50% 95%' }} />;
        })}
        {Array.from({ length: Math.max(0, stage) }, (_, i) => {
          const s = interpolate(f - (15 + i * BEAT), [0, 6], [0, 1], { ...clamp, easing: ease });
          return <Img key={`a${i}`} src={img(i % 3 === 2 ? 'apple-green.webp' : 'apple-red.webp')} style={{ position: 'absolute', left: 150 + i * 112, top: 1300, width: 100, transform: `translateY(${(1 - s) * -200}px) scale(${s})` }} />;
        })}
      </AbsoluteFill>
      <div style={{ ...center, top: SAFE.top + 20, fontSize: 92, fontWeight: 800, color: C.ink, letterSpacing: -3, lineHeight: 1.05 }}>
        Каждый день —<br /><span style={{ color: C.red }}>часть дома</span>
      </div>
      {stage >= 6 && <Slam at={15 + 5 * BEAT} style={{ ...center, top: 600, fontSize: 50, fontWeight: 800, color: C.green }}>шаңырақ — символ семьи</Slam>}
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
}

// ——— 8. Врач по QR + қазақша ———
function Doc() {
  const f = useCurrentFrame();
  const card = useSpring(0, { damping: 15, stiffness: 120 });
  const chips = [['🔴 Не занимается 5 дней', C.red, 20], ['🟢 Рука выше на 39°', C.green, 32], ['📋 В медкарту — одним нажатием', C.ink, 44]];
  const kk = useSpring(62, { damping: 9, stiffness: 200 });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Slam at={0} style={{ ...center, top: SAFE.top + 10, fontSize: 96, fontWeight: 800, color: C.ink, letterSpacing: -3, lineHeight: 1.05 }}>
        Врач видит<br /><span style={{ color: C.green }}>прогресс по QR</span>
      </Slam>
      <div style={{ position: 'absolute', top: 640, left: 110, width: 860, height: 520, borderRadius: 30, overflow: 'hidden', boxShadow: '0 40px 80px rgba(60,45,20,.25)', transform: `perspective(1800px) rotateY(${(1 - card) * -40}deg) rotateX(8deg) translateX(${(1 - card) * 500}px)` }}>
        <Img src={img('cabinet.png')} style={{ width: '100%', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', top: 1190, left: 90, right: 90, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        {chips.map(([t, col, at]) => {
          const s = useSpring(at, { damping: 12, stiffness: 220 });
          return <div key={t} style={{ transform: `scale(${s})`, background: '#fff', color: col, fontFamily: FONT, fontWeight: 800, fontSize: 42, padding: '12px 28px', borderRadius: 999, boxShadow: '0 10px 30px rgba(60,45,20,.15)' }}>{t}</div>;
        })}
      </div>
      {f >= 62 && <div style={{ position: 'absolute', top: 600, right: 46, transform: `scale(${kk}) rotate(8deg)`, background: C.ochre, color: C.ink, fontFamily: FONT, fontWeight: 800, fontSize: 46, padding: '16px 28px', borderRadius: 22, boxShadow: '0 14px 30px rgba(120,80,0,.3)' }}>Қазақша · Русский</div>}
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 9. Финал: чистый кадр ———
function Cta() {
  const f = useCurrentFrame();
  const logo = useSpring(0, { damping: 10, stiffness: 150 });
  const t1 = useT(8, 12), t2 = useT(16, 12), t3 = useSpring(26, { damping: 12, stiffness: 180 });
  const rays = interpolate(f, [0, 120], [0, 30], clamp);
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <div style={{ position: 'absolute', left: 540 - 520, top: 790 - 520, width: 1040, height: 1040, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,163,58,.28) 0%, rgba(224,163,58,0) 65%)', transform: `scale(${logo}) rotate(${rays}deg)` }} />
      <div style={{ position: 'absolute', left: 540 - 190, top: 420, width: 380, height: 380, transform: `scale(${logo})` }} dangerouslySetInnerHTML={{ __html: LOGO_SVG.replace('<svg ', '<svg width="380" height="380" ') }} />
      <div style={{ ...center, top: 850, fontSize: 190, fontWeight: 800, color: C.green, letterSpacing: -8, opacity: t1, transform: `translateY(${(1 - t1) * 50}px)` }}>Qaita</div>
      <div style={{ ...center, top: 1080, fontSize: 64, fontWeight: 800, color: C.ink, opacity: t2, lineHeight: 1.15 }}>возвращает руку<br />в жизнь</div>
      <div style={{ position: 'absolute', top: 1300, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${t3})`, background: C.green, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 50, padding: '22px 44px', borderRadius: 999, boxShadow: '0 18px 40px rgba(29,117,82,.35)' }}>marvindpp.github.io/qaita</div>
      </div>
      <div style={{ ...center, top: 1420, fontSize: 36, fontWeight: 700, color: C.ink2, opacity: useT(40, 12) }}>Откройте ссылку — нужна только камера</div>
      <Ornament y={1800} h={120} offset={interpolate(f, [0, 120], [0, -80])} />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

export function Promo() {
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Audio src={staticFile('music.wav')} />
      <Sequence {...seq(S.hook)}><Hook /></Sequence>
      <Sequence {...seq(S.fifth)}><Fifth /></Sequence>
      <Sequence {...seq(S.doctor)}><Doctor /></Sequence>
      <Sequence {...seq(S.turn)}><Turn /></Sequence>
      <Sequence {...seq(S.link)}><Link /></Sequence>
      <Sequence {...seq(S.error)}><ErrorMode /></Sequence>
      <Sequence {...seq(S.home)}><Home /></Sequence>
      <Sequence {...seq(S.doc)}><Doc /></Sequence>
      <Sequence {...seq(S.cta)}><Cta /></Sequence>
    </AbsoluteFill>
  );
}
