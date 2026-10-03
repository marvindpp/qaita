// Сцены 6–13: демо (настоящая запись) → режим «ошибка» → врач → дом → после этапа → план → финал → шутка.
import { AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { C, FONT, clamp, ease, useT, useSpring, Slam, Person } from '../kit.jsx';
import { LOGO_SVG } from '../logo.js';
import { W, H, FPS } from './timing.js';
import { full, txt, img, cue, inn, win, tt, spr, Grain, Vignette, Confetti, Stamp, MemeText, Felt, Cup, Arm, FillRing } from './fx.jsx';

const center = { position: 'absolute', left: 0, right: 0, textAlign: 'center' };

/** Экран с кадром из записи: обрезаем верхнюю плашку-подпись записи. */
function Screen({ children, width = 1180, style }) {
  return (
    <div style={{ position: 'absolute', width, ...style }}>
      <div style={{ background: '#22302b', borderRadius: 30, padding: 18, boxShadow: '0 40px 90px rgba(20,15,5,.4)' }}>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 8.6', background: '#fbf5e9' }}>{children}</div>
      </div>
      <div style={{ height: 24, margin: '0 -44px', background: 'linear-gradient(#cfc6b5,#a89e8c)', borderRadius: '0 0 28px 28px' }} />
    </div>
  );
}
/** Видео без верхних 7% (там подпись из записи). */
const vidStyle = { position: 'absolute', left: 0, width: '100%', top: '-7.5%', height: 'auto' };

/** Отрезок записи [s0, s1] (сек) растягиваем на окно сцены [a, b) (кадры). */
function Clip({ a, b, s0, s1 }) {
  const len = Math.max(1, b - a);
  const rate = Math.min(1.6, Math.max(0.45, (s1 - s0) / (len / FPS)));
  return (
    <Sequence from={a} durationInFrames={len} layout="none">
      <OffthreadVideo src={staticFile('demo.webm')} startFrom={Math.round(s0 * FPS)} playbackRate={rate} muted style={vidStyle} />
    </Sequence>
  );
}

// ——— 6. ДРАЙВ: демо на настоящей записи ———
export function Demo({ d }) {
  const f = useCurrentFrame();
  const k = (n, fr) => cue('demo', n, fr, d);
  const cCam = k('cam', 0.03), cPalm = k('palm', 0.17), cHand = k('hand', 0.33), cStar = k('star', 0.45), cCheat = k('cheat', 0.55),
    cWarn = k('warn', 0.62), cOk = k('ok', 0.8), cKk = k('kk', 0.92);
  // Посекундная разметка записи demo.webm: 3–6 ладонь · 7–9 қазақша · 11–13 цель · 14–16 «Звезда» · 17–21 упражнение ·
  // 22–24 «Плечо поднято к уху. Опустите!» · 25 «Так правильно! +50» · 27–28 «Новый рекорд» · 31 «Два! +100».
  const cRep = Math.round(cStar + (cCheat - cStar) * 0.55);
  const clips = [
    [0, cPalm, 3, 4.6], [cPalm, cHand, 4.6, 6.6], [cHand, cStar, 11, 13.8], [cStar, cRep, 14, 16.8], [cRep, cCheat, 30.6, 31.8],
    [cCheat, cWarn, 18, 21.9], [cWarn, cOk, 22, 24.9], [cOk, cKk, 25, 28.8], [cKk, d, 7, 9.6],
  ];
  const steps = [
    ['✋', 'Показал ладонь — начали', cPalm], ['🙋', 'Поднял руку — выбрал её', cHand], ['☕', 'Цель: держать чашку', cHand + 40],
    ['⭐', '«Звезда»: раз — повтор!', cStar], ['😏', 'Хитрим: плечо к уху', cCheat], ['✅', 'Исправил — +50', cOk], ['🇰🇿', 'Всё на казахском', cKk],
  ];
  const cur = steps.reduce((s, st, i) => (f >= st[2] ? i : s), -1);
  const warnGlow = f >= cWarn && f < cOk ? 0.5 + 0.5 * Math.sin(f / 3) : 0;
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <div style={{ position: 'absolute', left: 70, top: 46, ...txt(36, C.green, 800), letterSpacing: 6 }}>ЖИВОЕ ДЕМО · НАСТОЯЩАЯ ЗАПИСЬ ЭКРАНА</div>
      <Screen width={1180} style={{ left: 60, top: 120, boxShadow: warnGlow ? `0 0 0 ${8 + warnGlow * 10}px rgba(224,70,50,${0.4 + warnGlow * 0.5})` : 'none', borderRadius: 34 }}>
        {clips.map(([a, b, s0, s1], i) => <Clip key={i} a={a} b={b} s0={s0} s1={s1} />)}
        {f < cPalm && (
          <svg viewBox="0 0 100 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: win(f, cCam, cPalm) }}>
            {Array.from({ length: 33 }, (_, i) => <circle key={i} cx={72 + Math.cos(i * 1.9) * (4 + (i % 5))} cy={18 + (i * 7) % 30} r="0.55" fill={C.bright} opacity={0.85} />)}
          </svg>
        )}
      </Screen>
      <div style={{ ...full, opacity: win(f, cWarn + 70, cOk + 4, 3) }}><Stamp at={cWarn + 74} style={{ left: 640, top: 190 }}>Не прокатило</Stamp></div>
      <Confetti at={cOk + 55} x={650} y={560} n={120} />
      {/* шаги справа */}
      <div style={{ position: 'absolute', left: 1310, top: 140, width: 560 }}>
        {steps.map(([ic, t, at], i) => (
          <div key={t} style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '16px 22px', marginBottom: 12, borderRadius: 22, background: i === cur ? C.green : '#fff', boxShadow: '0 8px 22px rgba(60,45,20,.12)', opacity: f >= at ? 1 : 0.35, transform: `scale(${i === cur ? 1.04 : 1})`, transition: 'none' }}>
            <span style={{ fontSize: 44 }}>{ic}</span>
            <span style={{ ...txt(34, i === cur ? '#fff' : C.ink, 800) }}>{t}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 60, top: 840, width: 1180, ...txt(40, C.ink2, 700), textAlign: 'center' }}>
        {f < cPalm ? '33 точки тела + 21 точка руки · 30 раз в секунду' : f < cWarn ? 'Мышь не нужна: всё управление жестами' : f < cOk ? '«Плечо поднято к уху. Опустите!» — повтор не засчитан' : 'Исправил → «Так правильно! +50»'}
      </div>
      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
}

// ——— 7. УМНО: режим «ошибка» ———
export function ErrorMode({ d }) {
  const f = useCurrentFrame();
  const cCal = cue('error', 'calib', 0.2, d), cList = cue('error', 'list', 0.4, d), cScale = cue('error', 'scale', 0.65, d), cNo = cue('error', 'nocount', 0.86, d);
  const list = ['Наклон вперёд', 'Наклон вбок', 'Плечо к уху', 'Согнутый локоть', 'Слишком быстро', 'Не до конца', 'Не та рука', 'Пальцы не раскрыты'];
  const span = Math.max(40, cScale - cList - 20);
  const needle = interpolate(f, [cScale + 20, cScale + 50, cScale + 80, cScale + 110], [-60, 0, 60, 0], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: C.night2 }}>
      <div style={{ position: 'absolute', left: 80, top: 60, ...txt(36, C.ochre), letterSpacing: 8 }}>РЕЖИМ «ОШИБКА»</div>
      <div style={{ position: 'absolute', left: 80, top: 110, ...txt(86, C.cream), ...inn(f, 4) }}>Не олимпийский чемпион — <span style={{ color: C.gold }}>ваша норма</span></div>
      <div style={{ position: 'absolute', left: 80, top: 260, width: 900, height: 560, borderRadius: 28, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,.45)', ...inn(f, 6, 16, 80) }}>
        <Img src={img('play-mistake.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
      </div>
      {/* калибровка: ширина плеч = 1 S */}
      <div style={{ position: 'absolute', left: 1040, top: 260, width: 800, opacity: win(f, cCal, cList + 6) }}>
        <svg width="800" height="520">
          <circle cx="400" cy="120" r="70" fill={C.cream} opacity=".9" />
          <path d="M220 230 Q400 190 580 230 L560 480 L240 480 Z" fill={C.cream} opacity=".9" />
          <line x1="220" y1="215" x2={220 + 360 * tt(f, cCal + 10, 20)} y2="215" stroke={C.gold} strokeWidth="8" />
          <text x="400" y="320" textAnchor="middle" fontFamily={FONT} fontWeight="800" fontSize="32" fill={C.night2} opacity={tt(f, cCal + 26, 10)}>1 S — ширина плеч</text>
        </svg>
        <div style={{ ...txt(40, C.cream, 700), textAlign: 'center' }}>Калибровка: личная норма за 9 секунд</div>
      </div>
      {/* 8 компенсаций */}
      <div style={{ position: 'absolute', left: 1040, top: 270, width: 800, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, opacity: win(f, cList, cNo + 4) }}>
        {list.map((t, i) => (
          <div key={t} style={{ ...txt(38, C.ink, 800), background: '#fff', borderRadius: 18, padding: '20px 24px', boxShadow: '0 10px 24px rgba(0,0,0,.25)', ...inn(f, cList + (i * span) / list.length, 8, 24) }}>
            <span style={{ color: C.red }}>{i + 1}</span> · {t}
          </div>
        ))}
      </div>
      {/* шкала силы */}
      {f >= cScale && (
        <div style={{ position: 'absolute', left: 1040, top: 770, width: 800, ...inn(f, cScale) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...txt(40, C.cream) }}><span style={{ color: '#9fd9b8' }}>чуть</span><span style={{ color: C.gold }}>заметно</span><span style={{ color: '#ff8a76' }}>сильно</span></div>
          <div style={{ position: 'relative', height: 26, borderRadius: 13, marginTop: 12, background: 'linear-gradient(90deg,#9fd9b8,#ffd66b,#ff8a76)' }}>
            <div style={{ position: 'absolute', top: -14, left: `${50 + needle * 0.75}%`, width: 10, height: 54, borderRadius: 5, background: '#fff', transform: 'translateX(-50%)' }} />
          </div>
        </div>
      )}
      {/* повтор не засчитан */}
      {f >= cNo && (
        <div style={{ position: 'absolute', left: 80, right: 80, top: 880, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, ...inn(f, cNo) }}>
          <span style={{ fontSize: 80, position: 'relative' }}>⭐<span style={{ position: 'absolute', left: -6, top: 36, width: 110, height: 10, background: C.red, transform: 'rotate(-30deg)', borderRadius: 5 }} /></span>
          <span style={{ ...txt(64, C.cream) }}>Пока ошибка есть — повтор <span style={{ color: '#ff8a76' }}>не засчитан</span></span>
        </div>
      )}
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
}

// ——— 8. ВАУ: врач по QR ———
export function Doctor({ d }) {
  const f = useCurrentFrame();
  const k = (n, fr) => cue('doctor', n, fr, d);
  const cFlags = k('flags', 0.17), cCopy = k('copy', 0.5), cFing = k('fingers', 0.6), cBack = k('back', 0.68), cNo = k('noserver', 0.88);
  const flip = spr(f, cFlags, { damping: 16, stiffness: 110 });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{ position: 'absolute', left: 80, top: 60, ...txt(36, C.green), letterSpacing: 8 }}>ДЛЯ ВРАЧА</div>
      {/* QR у пациента */}
      <div style={{ ...full, opacity: win(f, 0, cFlags + 10) }}>
        <div style={{ position: 'absolute', left: 80, top: 120, ...txt(90, C.ink), ...inn(f, 2) }}>Одна кнопка → <span style={{ color: C.green }}>QR</span></div>
        <Screen width={1150} style={{ left: 380, top: 300, ...inn(f, 8, 16, 60) }}><Img src={img('doctor-qr.png')} style={{ width: '100%' }} /></Screen>
      </div>
      {/* кабинет с флажками */}
      <div style={{ ...full, opacity: win(f, cFlags, cFing) }}>
        <div style={{ position: 'absolute', left: 80, top: 120, ...txt(90, C.ink) }}>30 секунд <span style={{ color: C.green }}>вместо расспросов</span></div>
        <div style={{ position: 'absolute', left: 80, top: 290, width: 1100, borderRadius: 26, overflow: 'hidden', boxShadow: '0 30px 70px rgba(60,45,20,.25)', transform: `perspective(1800px) rotateY(${(1 - flip) * -30}deg)` }}>
          <Img src={img('cabinet.png')} style={{ width: '100%', display: 'block' }} />
        </div>
        <div style={{ position: 'absolute', left: 1240, top: 320, width: 620, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {[['🔴 Не занимается 5 дней', C.red, cFlags + 50], ['🟢 Рука выше на 39°', C.green, cFlags + 110], ['📋 Скопировать в медкарту', C.ink, cCopy]].map(([t, col, at]) => (
            <div key={t} style={{ ...txt(42, col), background: '#fff', borderRadius: 999, padding: '20px 32px', boxShadow: '0 12px 30px rgba(60,45,20,.15)', transform: `scale(${spr(f, at, { damping: 11, stiffness: 220 })})` }}>{t}</div>
          ))}
        </div>
      </div>
      {/* мем: печатает двумя пальцами */}
      <div style={{ ...full, opacity: win(f, cFing, cBack), background: '#2b2f35' }}>
        <div style={{ ...center, top: 160, fontSize: 220, transform: `translateY(${Math.abs(Math.sin(f / 3)) * -30}px)` }}>👉⌨️👈</div>
        <div style={{ ...center, top: 470, ...txt(54, '#aaa', 700), fontFamily: 'monospace' }}>{'тык… тык… тык…'.slice(0, Math.max(0, Math.floor((f - cFing) / 3)))}</div>
        <MemeText size={84} style={{ position: 'absolute', left: 0, right: 0, top: 640 }}>Больше не надо</MemeText>
        <Stamp at={cFing + 30} color={C.green} rotate={8} style={{ left: 1380, top: 740 }}>1 кнопка</Stamp>
      </div>
      {/* назначение обратно */}
      <div style={{ ...full, opacity: win(f, cBack, cNo) }}>
        <div style={{ position: 'absolute', left: 80, top: 120, ...txt(86, C.ink) }}>И обратно: <span style={{ color: C.green }}>назначение по QR</span></div>
        <Screen width={1050} style={{ left: 80, top: 290 }}><Img src={img('prescribe.png')} style={{ width: '100%' }} /></Screen>
        <div style={{ position: 'absolute', left: 1240, top: 380, width: 600, ...txt(52, C.ink), ...inn(f, cBack + 30) }}>Пациент сканирует → Qaita ведёт его <span style={{ color: C.green }}>по плану врача</span></div>
        <svg width={W} height={H} style={full}><path d="M1130 640 C 1250 760, 1450 760, 1560 640" fill="none" stroke={C.green} strokeWidth="8" strokeDasharray="18 14" strokeDashoffset={-f * 2} opacity={tt(f, cBack + 40, 12)} /></svg>
      </div>
      {/* данные в ссылке */}
      <div style={{ ...full, opacity: win(f, cNo, d + 10), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 150 }}>🔒</div>
        <div style={{ ...txt(90, C.ink), marginTop: 20 }}>Сервера нет</div>
        <div style={{ ...txt(38, C.green, 700), fontFamily: 'monospace', marginTop: 30, background: '#fff', padding: '18px 30px', borderRadius: 16, maxWidth: 1500, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {'…/report.html#doctor=eJxlj0FrwzAMhf+K8LmBJE3bpLfBYDDYYbv1JluK0bAdYzkdpfS'.slice(0, Math.max(20, Math.floor((f - cNo) * 2.2)))}
        </div>
        <div style={{ ...txt(44, C.ink2, 700), marginTop: 22, ...inn(f, cNo + 30) }}>данные — в самой ссылке</div>
      </div>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 9. ТЕПЛО: юрта строится по дням на холме, сад апорта, голос внука ———
const STAGES = ['кереге', 'есік', 'уық', 'туырлық', 'үзік', 'шаңырақ', 'үй дайын!'];
export function Home({ d }) {
  const f = useCurrentFrame();
  const cYurt = cue('home', 'yurt', 0.1, d), cGarden = cue('home', 'garden', 0.38, d), cKids = cue('home', 'kids', 0.52, d),
    cNot = cue('home', 'notclinic', 0.7, d), cLang = cue('home', 'lang', 0.83, d);
  const per = Math.max(10, (cGarden - cYurt) / 7);
  const stage = Math.max(0, Math.min(7, Math.floor((f - cYurt) / per) + 1));
  const since = f - (cYurt + (stage - 1) * per);
  const pop = stage ? interpolate(since, [0, 4, 9], [0.88, 1.05, 1], clamp) : 0;
  const tree = Math.max(0, Math.min(4, Math.floor((f - cGarden) / 14) + 1));
  const cam = interpolate(f, [0, d], [1.0, 1.06], clamp);
  // юрта СТОИТ на переднем холме: низ юрты (92% картинки) на линии y = 905
  const YW = 560, BASE = 905, yurtTop = BASE - YW * 0.92;
  return (
    <AbsoluteFill style={{ background: '#fbefd9' }}>
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: '30% 85%' }}>
        <Img src={img('steppe.webp')} style={{ position: 'absolute', left: 0, top: H - 1072, width: 1920, height: 1072, transform: 'scaleX(-1)' }} />
        {/* тень под юртой — видно, что стоит на земле */}
        {stage > 0 && <div style={{ position: 'absolute', left: 230, top: BASE - 22, width: YW - 20, height: 44, borderRadius: '50%', background: 'rgba(40,60,20,.35)', filter: 'blur(6px)' }} />}
        {stage > 0 && <Img src={img(`yurt-${stage}.webp`)} style={{ position: 'absolute', left: 220, top: yurtTop, width: YW, transform: `scale(${pop})`, transformOrigin: '50% 92%' }} />}
        {/* деревья на заднем холме, растут по стадиям */}
        {[0, 1, 2].map((i) => {
          const at = cGarden + i * 10;
          const s = interpolate(f - at, [0, 12], [0, 1], { ...clamp, easing: ease });
          const t = Math.max(1, Math.min(4, tree - i * 0 + (i === 1 ? -1 : 0)));
          const TW = 300, tBase = 860 - i * 22;
          return f >= at && <Img key={i} src={img(`tree-${t}.webp`)} style={{ position: 'absolute', left: 1050 + i * 270, top: tBase - TW * 0.96, width: TW, transform: `scale(${s})`, transformOrigin: '50% 96%' }} />;
        })}
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 80, top: 60, ...txt(84, C.ink), ...inn(f, 2) }}>Каждый день — <span style={{ color: C.red }}>часть дома</span></div>
      {stage > 0 && f < cKids && (
        <div style={{ position: 'absolute', left: 80, top: 170, ...txt(46, C.green) }}>День {stage} · {STAGES[stage - 1]}</div>
      )}
      {stage >= 6 && f < cKids && <div style={{ position: 'absolute', left: 80, top: 236, ...txt(40, C.ink2, 700) }}>шаңырақ — символ семьи</div>}
      {f >= cGarden && f < cKids && <div style={{ position: 'absolute', left: 80, top: 300, ...txt(46, C.red), ...inn(f, cGarden) }}>🍎 чистые повторы → сад апорта</div>}
      {/* голос внука */}
      {f >= cKids && (
        <div style={{ position: 'absolute', right: 100, top: 150, ...inn(f, cKids, 14, 30) }}>
          <Felt style={{ padding: '30px 40px', width: 700 }}>
            <div style={{ ...txt(30, C.ink2, 700) }}>🎙 голос внучки · после занятия</div>
            <div style={{ ...txt(64, C.green), marginTop: 6 }}>«Әже, жарайсың! 💚»</div>
            <svg width="620" height="60" style={{ marginTop: 10 }}>
              {Array.from({ length: 40 }, (_, i) => { const h = 8 + Math.abs(Math.sin(i * 1.3 + f / 3)) * 46; return <rect key={i} x={i * 15.5} y={30 - h / 2} width="8" height={h} rx="4" fill={C.bright} />; })}
            </svg>
          </Felt>
        </div>
      )}
      {f >= cNot && <div style={{ position: 'absolute', left: 80, top: 170, ...txt(60, C.ink), ...inn(f, cNot) }}>Не больница. <span style={{ color: C.green }}>Дом.</span></div>}
      {f >= cLang && <div style={{ position: 'absolute', left: 80, top: 260, ...txt(44, C.ink), background: C.ochre, padding: '14px 28px', borderRadius: 20, transform: `rotate(-3deg) scale(${spr(f, cLang, { damping: 10, stiffness: 200 })})` }}>Қазақша · Русский</div>}
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 10. ГОРДО: после первого этапа + техника ———
export function Proud({ d }) {
  const f = useCurrentFrame();
  const cList = cue('proud', 'list', 0.3, d), cTech = cue('proud', 'tech', 0.7, d);
  const items = [['🩺', 'Кабинет врача'], ['📲', 'Назначение по QR'], ['🇰🇿', 'Қазақ тілі'], ['🏕', 'Юрта и сад'], ['📱', 'Телефон'], ['📴', 'Без интернета'], ['⏰', 'Напоминания'], ['✅', 'Согласие на данные'], ['🔒', '«Когда нельзя»']];
  const span = Math.max(60, cTech - cList - 30);
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <div style={{ ...full, opacity: win(f, 0, cTech) }}>
        <div style={{ position: 'absolute', left: 80, top: 70, display: 'flex', alignItems: 'baseline', gap: 30 }}>
          <Slam at={4} style={{ ...txt(200, C.green) }}>97</Slam><div style={{ ...txt(80, C.ink2), ...inn(f, 10) }}>/100 после первого этапа</div>
        </div>
        <Stamp at={Math.max(30, cList - 70)} color={C.red} rotate={-6} style={{ right: 140, top: 250 }}>Пошли к врачу</Stamp>
        <div style={{ position: 'absolute', left: 80, right: 80, top: 420, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {items.map(([ic, t], i) => (
            <div key={t} style={{ display: 'flex', gap: 20, alignItems: 'center', background: '#fff', borderRadius: 24, padding: '26px 30px', boxShadow: '0 12px 30px rgba(60,45,20,.12)', ...inn(f, cList + (i * span) / items.length, 10, 30) }}>
              <span style={{ fontSize: 56 }}>{ic}</span><span style={{ ...txt(42, C.ink) }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...full, opacity: win(f, cTech, d + 10), background: C.night2 }}>
        <div style={{ position: 'absolute', left: 80, top: 80, ...txt(80, C.cream) }}>Всё в браузере</div>
        <div style={{ position: 'absolute', left: 80, right: 80, top: 300, display: 'flex', alignItems: 'center', gap: 16 }}>
          {[['📷', 'Камера'], ['🤖', 'MediaPipe'], ['⚙️', 'Наш движок'], ['🗣', 'Голос и экран']].map(([ic, t], i) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, ...inn(f, cTech + i * 12, 10, 30) }}>
              <div style={{ flex: 1, textAlign: 'center', background: i === 2 ? C.bright : 'rgba(255,255,255,.1)', borderRadius: 24, padding: '28px 10px' }}>
                <div style={{ fontSize: 60 }}>{ic}</div><div style={{ ...txt(36, '#fff') }}>{t}</div>
              </div>
              {i < 3 && <span style={{ ...txt(60, C.gold) }}>→</span>}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 80, right: 80, top: 610, display: 'flex', justifyContent: 'space-around' }}>
          {[['154', 'теста'], ['0', 'серверов'], ['0', 'видео уходит наружу']].map(([n, t], i) => (
            <div key={t} style={{ textAlign: 'center', ...inn(f, cTech + 60 + i * 30, 10, 40) }}>
              <div style={{ ...txt(190, i ? C.gold : C.bright) }}>{n}</div><div style={{ ...txt(44, C.cream, 700) }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 11. ПЛАН: пилот в Астане, QR в выписке ———
export function Plan({ d }) {
  const f = useCurrentFrame();
  const cQr = cue('plan', 'qr', 0.45, d), cFree = cue('plan', 'free', 0.72, d);
  return (
    <AbsoluteFill style={{ background: '#eaf3ec' }}>
      <div style={{ position: 'absolute', left: 80, top: 70, ...txt(90, C.ink), ...inn(f, 2) }}>Дальше: <span style={{ color: C.green }}>пилот в Астане</span></div>
      <div style={{ position: 'absolute', left: 80, top: 230, width: 1000, display: 'flex', gap: 10, flexWrap: 'wrap', ...inn(f, 10) }}>
        {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ opacity: tt(f, 10 + i * 2, 6) }}><Person size={40} color={i < 3 ? C.green : '#9bbca8'} /></div>)}
      </div>
      <div style={{ position: 'absolute', left: 80, top: 360, ...txt(48, C.ink2, 700), ...inn(f, 30) }}>реабилитолог + 10–20 пациентов<br />после выписки</div>
      {f >= cQr && (
        <div style={{ position: 'absolute', left: 1180, top: 160, transform: `rotate(4deg)`, ...inn(f, cQr, 14, 80) }}>
          <div style={{ width: 600, background: '#fff', padding: 40, boxShadow: '0 30px 60px rgba(0,0,0,.2)' }}>
            <div style={{ ...txt(36, C.ink) }}>ВЫПИСКА ИЗ СТАЦИОНАРА</div>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 14, background: '#e3e3e3', borderRadius: 7, marginTop: 18, width: `${90 - i * 12}%` }} />)}
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 30 }}>
              <div style={{ width: 170, height: 170, background: `repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0/34px 34px`, border: '10px solid #fff', outline: '4px solid #111' }} />
              <div style={{ ...txt(34, C.green) }}>Отсканируйте —<br />занятия дома<br />с Qaita</div>
            </div>
          </div>
        </div>
      )}
      {f >= cFree && (
        <div style={{ position: 'absolute', left: 80, top: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[['Пациенту — бесплатно', C.green], ['Платит клиника за удалённый контроль', C.ink]].map(([t, col], i) => (
            <div key={t} style={{ ...txt(50, '#fff'), background: col, padding: '20px 36px', borderRadius: 999, alignSelf: 'flex-start', ...inn(f, cFree + i * 14, 10, 30) }}>{t}</div>
          ))}
        </div>
      )}
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 12. МУРАШКИ: мама берёт чашку сама → «снова» → логотип ———
export function Finale({ d }) {
  const f = useCurrentFrame();
  const cMorning = cue('finale', 'morning', 0.1, d), cGrab = cue('finale', 'grab', 0.3, d), cSnova = cue('finale', 'snova', 0.45, d), cEnd = cue('finale', 'end', 0.8, d);
  const reach = interpolate(f, [cMorning, cGrab + 10], [0, 1.8], { ...clamp, easing: ease });
  const grip = interpolate(f, [cGrab + 10, cGrab + 22], [0, 1], clamp);
  const lift = interpolate(f, [cGrab + 24, cGrab + 60], [0, 1], { ...clamp, easing: ease });
  const warm = interpolate(f, [0, cGrab], [0.6, 1.15], clamp);
  const endIn = spr(f, cEnd, { damping: 12, stiffness: 120 });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#f6d9a8, #e8b77c)' }}>
      <AbsoluteFill style={{ filter: `saturate(${warm})`, opacity: f >= cEnd ? 1 - endIn : 1 }}>
        <div style={{ position: 'absolute', left: 1060, top: 80, width: 700, height: 560, borderRadius: 18, background: 'radial-gradient(circle at 60% 40%, #fff7da, #ffd98a)', border: '18px solid #8a6a4c' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 16, background: '#8a6a4c', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 16, background: '#8a6a4c' }} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 790, bottom: 0, background: 'linear-gradient(#a8835e,#8a6a4c)' }} />
        <div style={{ position: 'absolute', left: 1240, top: 560 - lift * 120 }}><Cup size={260} /></div>
        <Arm reach={reach} grip={grip} lift={lift} x={0} y={600} />
        <div style={{ ...full, background: 'radial-gradient(circle at 75% 25%, rgba(255,240,200,.55), rgba(255,240,200,0) 55%)' }} />
        {f >= cGrab + 40 && <div style={{ position: 'absolute', left: 110, top: 140, ...txt(130, '#5a3a1c'), ...inn(f, cGrab + 40, 16) }}>Сама.</div>}
        {f >= cSnova && (
          <div style={{ position: 'absolute', left: 110, top: 320, ...inn(f, cSnova, 14) }}>
            <div style={{ ...txt(70, C.green) }}>Қайта — снова.</div>
            <div style={{ ...txt(52, '#5a3a1c', 700), marginTop: 16, ...inn(f, cSnova + 50) }}>Снова держать чашку.</div>
            <div style={{ ...txt(52, '#5a3a1c', 700), marginTop: 8, ...inn(f, cSnova + 100) }}>Снова обнять внуков.</div>
          </div>
        )}
      </AbsoluteFill>
      {f >= cEnd && (
        <AbsoluteFill style={{ background: C.cream, opacity: endIn, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ width: 300, height: 300, transform: `scale(${endIn})` }} dangerouslySetInnerHTML={{ __html: LOGO_SVG.replace('<svg ', '<svg width="300" height="300" ') }} />
          <div style={{ ...txt(84, C.ink), marginTop: 30 }}>Qaita возвращает руку в жизнь</div>
          <div style={{ ...txt(48, '#fff'), background: C.green, padding: '18px 40px', borderRadius: 999, marginTop: 30 }}>marvindpp.github.io/qaita</div>
          <div style={{ ...txt(38, C.ink2, 700), marginTop: 24 }}>Команда «Хастлеры» · Рахмет!</div>
        </AbsoluteFill>
      )}
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

// ——— 13. Шутка после титров ———
export function Post({ d }) {
  const f = useCurrentFrame();
  const drop = interpolate(f, [30, 50], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: '#0b0d0f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ ...txt(70, 'rgba(246,236,214,.7)', 700), ...inn(f, 4) }}>…И да.</div>
      <div style={{ ...txt(110, C.cream), marginTop: 20, ...inn(f, 26) }}>Плечо — опустите. <span style={{ display: 'inline-block', transform: `translateY(${drop * 20}px)` }}>🙂</span></div>
    </AbsoluteFill>
  );
}
