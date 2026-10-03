// Сцены 1–5: страшно (гроза) → грустно (дождь) → смешно (мемы) → жёстко (цифры) → свет (логотип).
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import { C, FONT, clamp, ease, easeIn, useT, useSpring, Slam, shake, Person } from '../kit.jsx';
import { LOGO_SVG } from '../logo.js';
import { W, H } from './timing.js';
import { full, txt, cue, useIn, useWin, Grain, Vignette, Rain, WindowDrops, Lightning, Clouds, Ecg, FillRing, Stamp, MemeText, Felt, Toast, Achievement, Cup, Arm } from './fx.jsx';

const center = { position: 'absolute', left: 0, right: 0, textAlign: 'center' };

// ——— 1. СТРАШНО: гроза, часы 13 минут, 40 000, «чья-то мама» ———
export function Storm({ d }) {
  const f = useCurrentFrame();
  const c40 = cue('storm', 'n40', 0.3, d), cMom = cue('storm', 'mom', 0.48, d), cMin = cue('storm', 'minutes', 0.7, d);
  const clockT = interpolate(f, [20, c40 - 10], [0, 1], { ...clamp, easing: (x) => x }); // кольцо заполняется ровно, по часовой
  const mm = Math.floor(clockT * 13), ss = Math.floor((clockT * 13 * 60) % 60);
  const n = Math.round(interpolate(f, [c40, c40 + 24], [0, 40000], { ...clamp, easing: ease }) / 100) * 100;
  const siren = 0.5 + 0.5 * Math.sin(f / 4);
  const bolts = [8, c40 - 2, cMom + 30, cMin - 4];
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#0b1116, #141e26 60%, #0e1519)' }}>
      <Clouds />
      <Rain n={180} />
      {/* отблески скорой по краям */}
      <div style={{ ...full, boxShadow: `inset 140px 0 160px -80px rgba(220,40,40,${0.35 * siren}), inset -140px 0 160px -80px rgba(40,90,230,${0.35 * (1 - siren)})`, opacity: interpolate(f, [cMom, cMom + 20], [0.4, 1], clamp) }} />
      <AbsoluteFill style={{ transform: shake(f, c40, 22) }}>
        {/* часы */}
        <div style={{ position: 'absolute', left: W / 2 - 230, top: 150, opacity: useWin(10, c40 + 4) }}>
          <FillRing t={clockT} size={460} stroke={28} color={C.red}>
            <div style={{ ...txt(130, C.cream), fontVariantNumeric: 'tabular-nums' }}>{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</div>
          </FillRing>
        </div>
        <div style={{ ...center, top: 660, ...txt(76, C.cream), opacity: useWin(18, c40 + 4) }}>Каждые <span style={{ color: C.red }}>13 минут</span> — инсульт</div>
        {/* 40 000 */}
        <div style={{ opacity: useWin(c40, cMom + 4) }}>
          <Slam at={c40} from={2.2} style={{ ...center, top: 230, ...txt(300, C.ochre), fontVariantNumeric: 'tabular-nums' }}>{n.toLocaleString('ru-RU').replace(/\s/g, ' ')}</Slam>
          <div style={{ ...center, top: 590, ...txt(70, C.cream), ...useIn(c40 + 18) }}>человек в год. В Казахстане.</div>
        </div>
        {/* толпа, две фигуры подсвечены */}
        <div style={{ position: 'absolute', top: 230, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', padding: '0 120px', opacity: useWin(cMom, cMin + 2) }}>
          {Array.from({ length: 22 }, (_, i) => {
            const hi = i === 8 || i === 13;
            const s = interpolate(f - cMom - i * 1.5, [0, 10], [0, 1], { ...clamp, easing: ease });
            return (
              <div key={i} style={{ transform: `translateY(${(1 - s) * 60}px)`, opacity: s * (hi ? 1 : 0.35), position: 'relative' }}>
                <Person size={hi ? 110 : 90} color={hi ? C.cream : 'rgba(246,236,214,.8)'} glow={hi ? 20 : 0} />
                {hi && <div style={{ position: 'absolute', top: -54, left: -30, right: -30, textAlign: 'center', ...txt(34, C.gold), ...useIn(cMom + 25 + (i === 13 ? 14 : 0), 10, 16) }}>{i === 8 ? 'мама' : 'папа'}</div>}
              </div>
            );
          })}
        </div>
        {/* минуты / месяцы */}
        <div style={{ opacity: useWin(cMin, d + 10) }}>
          <div style={{ ...center, top: 300, ...txt(110, C.cream), ...useIn(cMin) }}>Инсульт — <span style={{ color: C.red }}>за минуты</span></div>
          <div style={{ ...center, top: 450, ...txt(110, C.cream), ...useIn(cMin + 22) }}>Рука — <span style={{ color: C.ochre }}>месяцами</span></div>
        </div>
      </AbsoluteFill>
      <Ecg y={930} bpm={interpolate(f, [0, d], [70, 110], clamp)} opacity={0.9} />
      {bolts.map((b, i) => <Lightning key={i} at={b} x={[0.75, 0.25, 0.6, 0.4][i]} seed={i + 1} />)}
      <Vignette strength={0.7} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
}

// ——— 2. ГРУСТНО: мама, чашка, рука не слушается ———
export function Sad({ d }) {
  const f = useCurrentFrame();
  const cReach = cue('sad', 'reach', 0.3, d), cFail = cue('sad', 'fail', 0.5, d), cDoc = cue('sad', 'doctor', 0.68, d);
  const reach = interpolate(f, [cReach, cFail], [0, 0.55], { ...clamp, easing: ease });
  const droop = interpolate(f, [cFail, cFail + 30], [0, 1], { ...clamp, easing: ease });
  const push = interpolate(f, [0, d], [1, 1.08], clamp);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#2a3a4a, #1b2632)' }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, filter: 'saturate(.55)' }}>
        {/* окно */}
        <div style={{ position: 'absolute', left: 1060, top: 80, width: 700, height: 560, borderRadius: 18, background: 'linear-gradient(#5b7287,#3e5163)', border: '18px solid #6e5641' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 16, background: '#6e5641', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 16, background: '#6e5641' }} />
        </div>
        {/* стол */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 790, bottom: 0, background: 'linear-gradient(#8a6a4c,#6b4f37)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 790, height: 18, background: '#a07c58' }} />
        <div style={{ position: 'absolute', left: 1240, top: 560 }}><Cup size={260} /></div>
        <Arm reach={reach} droop={droop} shake={reach > 0.05 ? 1 : 0} x={0} y={600} />
      </AbsoluteFill>
      <WindowDrops n={46} />
      <div style={{ position: 'absolute', left: 110, top: 110, ...useIn(10, 16) }}>
        <div style={{ ...txt(44, 'rgba(246,236,214,.75)', 700) }}>Представьте: маме</div>
        <div style={{ ...txt(150, C.cream) }}>62 года</div>
        <div style={{ ...txt(44, 'rgba(246,236,214,.75)', 700), ...useIn(40, 14) }}>Выжила. Выписали домой.</div>
      </div>
      {f >= cFail + 10 && <div style={{ position: 'absolute', left: 860, top: 470, ...txt(48, '#cfe0ee', 700), ...useIn(cFail + 10, 14, 10), fontStyle: 'italic' }}>…не слушается</div>}
      {/* записка врача */}
      {f >= cDoc && (
        <div style={{ position: 'absolute', left: 170, top: 540, transform: `rotate(-4deg) translateY(${(1 - useT(cDoc, 14)) * 300}px)` }}>
          <div style={{ width: 640, background: '#f4f1e8', padding: '34px 40px', boxShadow: '0 20px 40px rgba(0,0,0,.4)', borderTop: '10px solid #c9d6e2' }}>
            <div style={{ ...txt(30, '#55697a', 700) }}>Рекомендация врача:</div>
            <div style={{ fontFamily: '"Comic Sans MS", cursive', fontSize: 48, color: '#24384a', marginTop: 10 }}>Делайте упражнения каждый день.</div>
          </div>
          <div style={{ ...txt(90, C.cream), marginTop: 24, ...useIn(cDoc + 40, 10) }}>И всё.</div>
        </div>
      )}
      <Vignette strength={0.65} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
}

// ——— 3. СМЕШНО: ожидание / реальность, листок под пультом, «технически дотянулась», мозг сохранил ———
export function Memes({ d }) {
  const f = useCurrentFrame();
  const cReal = cue('memes', 'reality', 0.14, d), cRemote = cue('memes', 'remote', 0.26, d), cCheat = cue('memes', 'cheat', 0.42, d),
    cGot = cue('memes', 'got', 0.6, d), cBrain = cue('memes', 'brain', 0.8, d);
  const reps = Math.round(interpolate(f, [8, cReal - 4], [0, 300], clamp));
  const zoomIn = useSpring(0, { damping: 14, stiffness: 160 });
  return (
    <AbsoluteFill style={{ background: '#fff4dc' }}>
      {/* А. Ожидание / реальность */}
      <div style={{ ...full, opacity: useWin(0, cRemote), transform: `scale(${0.9 + zoomIn * 0.1})` }}>
        <div style={{ position: 'absolute', left: 90, top: 90, right: 90, bottom: 90, display: 'flex', gap: 40 }}>
          <Felt bg="#dff2e6" style={{ flex: 1 }}>
            <MemeText size={72} style={{ marginTop: 40 }}>Ожидание</MemeText>
            <div style={{ ...center, top: 250, ...txt(230, C.green) }}>{reps}</div>
            <div style={{ ...center, top: 510, ...txt(56, C.ink) }}>идеальных повторов 💪</div>
            <div style={{ ...center, top: 640, fontSize: 120 }}>{['🏋️', '✨', '🥇'][Math.floor(f / 8) % 3]}</div>
          </Felt>
          <Felt bg="#f6e0da" style={{ flex: 1, opacity: f >= cReal ? 1 : 0.15 }}>
            <MemeText size={72} style={{ marginTop: 40 }}>Реальность</MemeText>
            {f >= cReal && (
              <>
                <Slam at={cReal} style={{ ...center, top: 250, ...txt(230, C.red) }}>3</Slam>
                <div style={{ ...center, top: 510, ...txt(56, C.ink), ...useIn(cReal + 10) }}>повтора… и сериал</div>
                <div style={{ ...center, top: 620, fontSize: 150, transform: `rotate(${Math.sin(f / 5) * 4}deg)`, ...useIn(cReal + 16) }}>🛋️📺</div>
              </>
            )}
          </Felt>
        </div>
      </div>
      {/* Б. Через неделю листок под пультом */}
      <div style={{ ...full, opacity: useWin(cRemote, cCheat) }}>
        <div style={{ ...center, top: 90, ...txt(64, C.ink2, 700) }}>Через неделю:</div>
        <div style={{ position: 'absolute', left: 560, top: 300, width: 800, height: 520, background: '#7b5a3f', borderRadius: 40, boxShadow: '0 30px 60px rgba(0,0,0,.25)' }} />
        <div style={{ position: 'absolute', left: 660, top: 340, width: 520, padding: 34, background: '#fff', transform: 'rotate(-6deg)', boxShadow: '0 8px 20px rgba(0,0,0,.2)' }}>
          <div style={{ ...txt(40, C.ink) }}>Упражнения для руки</div>
          {['Пн ✓', 'Вт ✓', 'Ср …', 'Чт', 'Пт'].map((s) => <div key={s} style={{ ...txt(34, C.ink2, 600), marginTop: 10 }}>{s}</div>)}
        </div>
        {/* пульт падает сверху на листок */}
        <div style={{ position: 'absolute', left: 820, top: interpolate(f, [cRemote + 10, cRemote + 24], [-500, 440], { ...clamp, easing: easeIn }), transform: 'rotate(18deg)' }}>
          <div style={{ width: 150, height: 420, borderRadius: 40, background: '#23272b', boxShadow: '0 20px 40px rgba(0,0,0,.4)', padding: 26, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignContent: 'start' }}>
            <div style={{ gridColumn: 'span 2', height: 46, borderRadius: 23, background: C.red }} />
            {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ height: 36, borderRadius: 18, background: '#4a5056' }} />)}
          </div>
        </div>
        <MemeText size={60} style={{ position: 'absolute', left: 0, right: 0, bottom: 70, ...useIn(cRemote + 28) }}>Листок с упражнениями — под пультом</MemeText>
      </div>
      {/* В. Тянется всем телом → «технически дотянулась» */}
      <div style={{ ...full, opacity: useWin(cCheat, cBrain) }}>
        <CheatFigure at={cCheat} d={cBrain - cCheat} />
        <Achievement at={cGot} title="Технически дотянулась" style={{ top: 80 }} />
        {f >= cGot + 20 && <MemeText size={58} style={{ position: 'absolute', left: 0, right: 0, bottom: 60, ...useIn(cGot + 20) }}>«Смотрите, я дотянулась!»</MemeText>}
      </div>
      {/* Г. Мозг сохранил неправильное движение */}
      <div style={{ ...full, opacity: useWin(cBrain, d + 10), background: '#2b2f35' }}>
        <div style={{ ...center, top: 360, fontSize: 260, transform: `scale(${1 + Math.sin(f / 6) * 0.03})` }}>🧠</div>
        <Toast at={cBrain + 12} icon="🧠" app="Мозг" title="Неправильное движение сохранено ✓" body="Будем повторять его и дальше" style={{ left: W / 2 - 380, top: 90 }} />
        {f >= cBrain + 50 && <div style={{ ...center, bottom: 110, ...txt(70, C.gold), ...useIn(cBrain + 50) }}>Мама довольна. А мозг учится неправильному.</div>}
      </div>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

/** Человечек тянется к звезде всем корпусом и поднимает плечо (смешно-утрированно). */
function CheatFigure({ at, d }) {
  const f = useCurrentFrame();
  const t = interpolate(f, [at + 10, at + d * 0.45], [0, 1], { ...clamp, easing: ease });
  const lean = t * 28;
  return (
    <svg width={W} height={H} style={full}>
      <g transform={`translate(860 900)`}>
        {/* стул */}
        <rect x="-110" y="-40" width="220" height="30" rx="10" fill="#8a6a4c" />
        <rect x="-100" y="-10" width="20" height="120" fill="#6b4f37" /><rect x="80" y="-10" width="20" height="120" fill="#6b4f37" />
        <g transform={`rotate(${lean} 0 -40)`}>
          <rect x="-70" y="-340" width="140" height="300" rx="60" fill="#3f6d8a" />
          {/* плечо к уху */}
          <circle cx="0" cy={-410 + t * 30} r="70" fill="#e2b48d" />
          <circle cx="-22" cy={-420 + t * 30} r="7" fill="#222" /><circle cx="22" cy={-420 + t * 30} r="7" fill="#222" />
          <path d={`M-24 ${-386 + t * 30} q24 ${18 + t * 10} 48 0`} stroke="#222" strokeWidth="6" fill="none" strokeLinecap="round" />
          <g transform={`translate(60 ${-300 - t * 60}) rotate(${-70 + t * 10})`}>
            <rect x="0" y="-24" width="260" height="48" rx="24" fill="#e2b48d" />
          </g>
        </g>
      </g>
      <text x={1320} y={260} fontSize="150" textAnchor="middle">⭐</text>
      <line x1={860} y1={250} x2={860} y2={900} stroke="rgba(184,65,47,.25)" strokeWidth="4" strokeDasharray="14 10" opacity={t} />
      {t > 0.6 && <text x={1060} y={560} fontFamily={FONT} fontWeight="800" fontSize="44" fill={C.red}>корпус ↗  плечо ↑</text>}
    </svg>
  );
}

// ——— 4. ЖЁСТКО: цифры + спидран «приём врача» ———
export function Numbers({ d }) {
  const f = useCurrentFrame();
  const c1 = cue('numbers', 'fifth', 0.1, d), c2 = cue('numbers', 'reps', 0.22, d), c3 = cue('numbers', 'quit', 0.38, d),
    c4 = cue('numbers', 'doctor', 0.52, d), c5 = cue('numbers', 'blind', 0.78, d);
  const glitch = f < 8 ? (random(`g${f}`) - 0.5) * 40 : 0;
  return (
    <AbsoluteFill style={{ background: '#0b0d0f' }}>
      {/* «И это уже не смешно» */}
      <div style={{ ...full, opacity: useWin(0, c1), display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateX(${glitch}px)` }}>
        <div style={{ ...txt(110, C.cream), textShadow: f < 8 ? `6px 0 ${C.red}, -6px 0 #3af` : 'none' }}>И это уже не смешно.</div>
      </div>
      {/* 1 из 5 */}
      <div style={{ ...full, opacity: useWin(c1, c2) }}>
        <Slam at={c1} style={{ ...center, top: 130, ...txt(260, C.bright) }}>1 из 5</Slam>
        <div style={{ position: 'absolute', top: 520, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 40 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ opacity: i === 4 ? 1 : 0.28, ...useIn(c1 + i * 4, 10, 30) }}><Person size={130} color={i === 4 ? C.bright : C.cream} glow={i === 4 ? 30 : 0} /></div>)}
        </div>
        <div style={{ ...center, top: 860, ...txt(56, C.cream, 700), ...useIn(c1 + 26) }}>получает реабилитацию. Остальные — дома, одни.</div>
      </div>
      {/* 30 вместо сотен */}
      <div style={{ ...full, opacity: useWin(c2, c3) }}>
        <div style={{ position: 'absolute', left: 260, bottom: 200, display: 'flex', alignItems: 'flex-end', gap: 160 }}>
          {[[30, 'на занятии', C.red], [300, 'нужно в день', C.bright]].map(([v, l, col], i) => {
            const h = interpolate(f, [c2 + 6 + i * 16, c2 + 30 + i * 16], [0, v * 2.2], { ...clamp, easing: ease });
            return (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ ...txt(110, col) }}>{i ? 'сотни' : '≈30'}</div>
                <div style={{ width: 300, height: h, background: col, borderRadius: '20px 20px 0 0', margin: '0 auto' }} />
                <div style={{ ...txt(44, C.cream, 700), marginTop: 18 }}>{l}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', right: 140, top: 300, width: 520, ...txt(60, C.cream), ...useIn(c2 + 40) }}>повторов. <span style={{ color: C.ochre }}>А дома их не считает никто.</span></div>
      </div>
      {/* 70% бросают */}
      <div style={{ ...full, opacity: useWin(c3, c4), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90 }}>
        <FillRing t={interpolate(f, [c3 + 4, c3 + 34], [0, 0.7], { ...clamp, easing: ease })} size={480} stroke={46} color={C.red}>
          <div style={{ ...txt(150, C.cream) }}>{Math.round(interpolate(f, [c3 + 4, c3 + 34], [0, 70], clamp))}%</div>
        </FillRing>
        <div style={{ ...txt(100, C.cream), ...useIn(c3 + 20) }}>бросают<br />упражнения</div>
      </div>
      {/* Спидран приёма */}
      <div style={{ ...full, opacity: useWin(c4, c5) }}>
        <Speedrun at={c4} len={c5 - c4} />
      </div>
      {/* Он лечит вслепую */}
      <div style={{ ...full, opacity: useWin(c5, d + 10), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 200, filter: `blur(${interpolate(f, [c5, c5 + 40], [0, 14], clamp)}px)` }}>👁️</div>
        <div style={{ ...txt(84, C.cream), marginTop: 30, ...useIn(c5 + 8) }}>Он не видит, что было дома.</div>
        <div style={{ ...txt(110, C.red), marginTop: 16, ...useIn(c5 + 34) }}>Он лечит вслепую.</div>
      </div>
      <Vignette strength={0.5} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
}

function Speedrun({ at, len }) {
  const f = useCurrentFrame();
  const k = f - at;
  const total = 15 * 60;
  const t = interpolate(k, [10, Math.max(40, len * 0.75)], [0, total], clamp);
  const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(Math.floor(t % 60)).padStart(2, '0'), ms = String(Math.floor((t * 100) % 100)).padStart(2, '0');
  const splits = [['Здравствуйте', 0.15], ['Как рука?', 0.33], ['Хорошо', 0.5], ['Следующий!', 0.68]];
  return (
    <>
      <div style={{ position: 'absolute', left: 120, top: 100, ...txt(46, C.gold, 800), letterSpacing: 6 }}>ПРИЁМ ВРАЧА · ANY% · WORLD RECORD</div>
      <div style={{ position: 'absolute', left: 120, top: 170, ...txt(240, t >= total ? C.red : C.bright), fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>{mm}:{ss}.{ms}</div>
      <div style={{ position: 'absolute', right: 140, top: 160, width: 640 }}>
        {splits.map(([s, p], i) => {
          const a = Math.round(at + 10 + p * (len * 0.75));
          return f >= a && (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', background: i === 3 ? 'rgba(184,65,47,.3)' : 'rgba(255,255,255,.07)', padding: '20px 30px', borderRadius: 14, marginBottom: 14, ...useIn(a, 6, 20) }}>
              <span style={{ ...txt(48, C.cream) }}>{s}</span><span style={{ ...txt(48, C.bright), fontFamily: 'monospace' }}>✓</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 120, bottom: 120, ...txt(54, 'rgba(246,236,214,.7)', 700) }}>15 минут на приём. На дом — ни минуты.</div>
    </>
  );
}

// ——— 5. СВЕТ: «А что если реабилитолог… будет дома?» → гроза уходит → логотип ———
export function Turn({ d }) {
  const f = useCurrentFrame();
  const cDrop = cue('turn', 'drop', 0.22, d), cTeam = cue('turn', 'team', 0.36, d), cLink = cue('turn', 'link', 0.62, d);
  const part = interpolate(f, [cDrop, cDrop + 50], [0, 1], { ...clamp, easing: ease });
  const sunY = interpolate(f, [cDrop, cDrop + 60], [900, 330], { ...clamp, easing: ease });
  const logo = useSpring(cDrop + 20, { damping: 10, stiffness: 120 });
  const sky = `linear-gradient(rgb(${interpolate(part, [0, 1], [14, 250])},${interpolate(part, [0, 1], [21, 236])},${interpolate(part, [0, 1], [27, 214])}), rgb(${interpolate(part, [0, 1], [20, 253])},${interpolate(part, [0, 1], [30, 245])},${interpolate(part, [0, 1], [38, 230])}))`;
  return (
    <AbsoluteFill style={{ background: sky }}>
      {/* лучи солнца-шаңырақа */}
      <div style={{ position: 'absolute', left: W / 2 - 700, top: sunY - 700, width: 1400, height: 1400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,107,.55) 0%, rgba(255,214,107,0) 60%)', opacity: part, transform: `rotate(${f / 3}deg)` }} />
      <Clouds part={part} opacity={1 - part * 0.3} />
      <Rain n={150} opacity={1 - part} />
      <div style={{ opacity: 1 - part }}>
        <div style={{ ...center, top: 360, ...txt(96, C.cream), ...useIn(4, 14) }}>А что если реабилитолог…</div>
        <Slam at={Math.max(10, cDrop - 22)} style={{ ...center, top: 520, ...txt(140, C.gold) }}>будет дома?</Slam>
      </div>
      {f >= cDrop + 10 && (
        <>
          <div style={{ position: 'absolute', left: W / 2 - 170, top: sunY - 170, width: 340, height: 340, transform: `scale(${logo}) rotate(${(1 - logo) * -60}deg)` }} dangerouslySetInnerHTML={{ __html: LOGO_SVG.replace('<svg ', '<svg width="340" height="340" ') }} />
          <div style={{ ...center, top: 540, ...txt(170, C.green), ...useIn(cDrop + 30, 14) }}>Qaita</div>
          <div style={{ ...center, top: 730, ...txt(52, C.ink2, 700), ...useIn(cDrop + 42, 14) }}>қайта — «снова» · команда «Хастлеры»</div>
        </>
      )}
      {f >= cLink && (
        <div style={{ position: 'absolute', top: 860, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26 }}>
          {['🔗 Ссылка', '📷 Вебкамера', '✋ Без мыши', '🚫 Без установки', '👤 Без регистрации'].map((s, i) => (
            <div key={s} style={{ ...txt(40, i < 2 ? '#fff' : C.ink), background: i < 2 ? C.green : '#fff', padding: '16px 30px', borderRadius: 999, boxShadow: '0 10px 26px rgba(60,45,20,.18)', ...useIn(cLink + i * 8, 10, 30) }}>{s}</div>
          ))}
        </div>
      )}
      <Lightning at={cDrop - 4} x={0.5} seed={9} />
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
}
