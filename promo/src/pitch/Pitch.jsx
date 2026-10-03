// Видео-питч Qaita, 16:9, ≈4:50. Сцены идут по озвучке (pitch-timing.json), звук: голос + музыка/эффекты.
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { SCENES, FPS } from './timing.js';
import real from './pitch-timing.json';
import { Storm, Sad, Memes, Numbers, Turn } from './scenes1.jsx';
import { Demo, ErrorMode, Doctor, Home, Proud, Plan, Finale, Post } from './scenes2.jsx';

const COMP = { storm: Storm, sad: Sad, memes: Memes, numbers: Numbers, turn: Turn, demo: Demo, error: ErrorMode, doctor: Doctor, home: Home, proud: Proud, plan: Plan, finale: Finale, post: Post };
const LEAD = real?.lead ?? 1.5;

export function Pitch({ withMusic = true }) {
  return (
    <AbsoluteFill style={{ background: '#0b0d0f' }}>
      {SCENES.map(({ id, from, dur }) => {
        const Comp = COMP[id];
        return <Sequence key={id} from={from} durationInFrames={dur} name={id}><Comp d={dur} /></Sequence>;
      })}
      <Sequence from={Math.round(LEAD * FPS)} name="voice"><Audio src={staticFile('voice.mp3')} /></Sequence>
      {withMusic && <Audio src={staticFile('pitch-music.wav')} volume={0.3} />}
    </AbsoluteFill>
  );
}
