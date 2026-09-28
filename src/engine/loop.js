// Цикл кадров: requestVideoFrameCallback, иначе requestAnimationFrame.
export function startLoop(video, onFrame) {
  let running = true;
  const useRvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const tick = (now) => {
    if (!running) return;
    onFrame(now);
    schedule();
  };
  const schedule = () => (useRvfc ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick));
  schedule();
  return () => { running = false; };
}

export function createFpsMeter() {
  let frames = 0, last = performance.now(), fps = 0;
  return () => {
    frames += 1;
    const now = performance.now();
    if (now - last >= 1000) { fps = Math.round((frames * 1000) / (now - last)); frames = 0; last = now; }
    return fps;
  };
}
