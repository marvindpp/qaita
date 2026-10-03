import { Composition, staticFile, delayRender, continueRender } from 'remotion';
import { Promo } from './Promo.jsx';
import { FPS, DURATION } from './timing.js';

// Шрифт Manrope (OFL) из public/fonts — грузим до первого кадра, чтобы текст не «прыгал».
const fontsReady = (() => {
  if (typeof document === 'undefined') return;
  const h = delayRender('Manrope');
  Promise.all([500, 700, 800].map((w) => new FontFace('Manrope', `url(${staticFile(`fonts/manrope-${w}.ttf`)})`, { weight: String(w) }).load().then((f) => document.fonts.add(f))))
    .then(() => continueRender(h), () => continueRender(h));
})();

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
);
