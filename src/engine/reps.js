// Машина состояний одного повтора: REST → REACHING → HOLD (0,5 с у цели) → RETURNING → REST (+1).
// Пока активна компенсация, удержание у цели не засчитывается — «исправь, и звезда засчитается».
export const REP_TIMING = { holdMs: 500 };

export function createRepCounter({ holdMs } = REP_TIMING) {
  let phase = 'REST';
  let held = 0;
  let lastT = null;
  let reached = false;
  let frames = 0, badFrames = 0;
  let peak = 0;

  return {
    get phase() { return phase; },
    /**
     * @param {{atRest:boolean, inTarget:boolean, blocked:boolean, progress:number, t:number}} f
     * @returns {{phase:string, holdProgress:number, rep?:{quality:number, peak:number}, incomplete?:{peak:number}}}
     */
    update({ atRest, inTarget, blocked, progress = 0, t }) {
      const dt = lastT == null ? 0 : Math.min(t - lastT, 100);
      lastT = t;
      const result = { phase, holdProgress: 0 };

      if (phase !== 'REST') {
        frames += 1;
        if (blocked) badFrames += 1;
        peak = Math.max(peak, progress);
      }

      if (phase === 'REST') {
        if (!atRest) { phase = 'REACHING'; reached = false; frames = 0; badFrames = 0; peak = progress; held = 0; }
      } else if (phase === 'REACHING') {
        if (inTarget) phase = 'HOLD';
        else if (atRest) {
          phase = 'REST';
          if (peak > 0.25) result.incomplete = { peak };
        }
      } else if (phase === 'HOLD') {
        if (!inTarget) { phase = 'REACHING'; held = 0; }
        else if (!blocked) {
          held += dt;
          if (held >= holdMs) { reached = true; phase = 'RETURNING'; }
        }
      } else if (phase === 'RETURNING' && atRest) {
        phase = 'REST';
        if (reached) result.rep = { quality: frames ? 1 - badFrames / frames : 1, peak };
      }

      result.phase = phase;
      result.holdProgress = phase === 'HOLD' ? Math.min(1, held / holdMs) : phase === 'RETURNING' ? 1 : 0;
      return result;
    },
  };
}
