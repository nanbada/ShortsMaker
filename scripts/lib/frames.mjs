// Time conversion rules (design §4.6, §5.4). Inputs are non-negative integers (ms or frames).
export const FPS = 30;
export const MIN_SCENE_FRAMES = 24;
export const MAX_TOTAL_FRAMES = 2700;
export const CAPTION_GAP_HOLD_MS = 250;
export const MIN_PHRASE_MS = 200;

// round(ms * fps / 1000), half up, integer arithmetic.
export const msToFrameRound = (ms) => Math.floor((ms * FPS + 500) / 1000);
// ceil(ms * fps / 1000), integer arithmetic.
export const msToFrameCeil = (ms) => Math.floor((ms * FPS + 999) / 1000);

export const totalFrames = (durationMs, tailFrames) => msToFrameCeil(durationMs) + tailFrames;

// Transition of length d across boundary b: incoming scene starts floor(d/2) early,
// outgoing scene ends ceil(d/2) late. Cut is d = 0.
export const leadSplit = (d) => ({ leadIn: Math.floor(d / 2), leadOut: Math.ceil(d / 2) });

// startMs[i]: start of scene i's startPhrase. Returns [{nominalStart, nominalEnd}].
export function sceneNominal(startMs, total) {
  const starts = startMs.map((ms, i) => (i === 0 ? 0 : msToFrameRound(ms)));
  return starts.map((s, i) => ({ nominalStart: s, nominalEnd: i + 1 < starts.length ? starts[i + 1] : total }));
}

// transitionFrames[i]: length of the transition after scene i (0 for cut or last scene).
export function sceneClips(nominal, transitionFrames) {
  return nominal.map((n, i) => {
    const leadIn = i === 0 ? 0 : leadSplit(transitionFrames[i - 1]).leadIn;
    const leadOut = i === nominal.length - 1 ? 0 : leadSplit(transitionFrames[i]).leadOut;
    return {
      ...n,
      leadIn,
      leadOut,
      clipStart: n.nominalStart - leadIn,
      clipEnd: n.nominalEnd + leadOut,
    };
  });
}

// phrases: [{startMs, endMs}] in order. Gaps shorter than holdMs are closed in ms before conversion.
export function captionFrames(phrases, holdMs = CAPTION_GAP_HOLD_MS) {
  return phrases.map((p, i) => {
    let endMs = p.endMs;
    const next = phrases[i + 1];
    if (next && next.startMs - endMs >= 0 && next.startMs - endMs < holdMs) endMs = next.startMs;
    return { startFrame: msToFrameCeil(p.startMs), endFrame: msToFrameCeil(endMs) };
  });
}

// Engine adapter only: frames → seconds strings with 6 decimals. Start is floored to µs.
// The engine shows a clip while start <= t < start + duration, adding the two as doubles
// (0.4 + 0.8 = 1.2000000000000002 would keep frame 36 visible), so the end is floored to µs
// and moved 1 µs earlier. Frame f is sampled at t = f / fps.
const usToSeconds = (us) => `${Math.floor(us / 1e6)}.${String(us % 1e6).padStart(6, '0')}`;
export function framesToSecondsAttrs(startFrame, endFrame) {
  const startUs = Math.floor((startFrame * 1e6) / FPS);
  const endUs = Math.floor((endFrame * 1e6) / FPS) - 1;
  return { start: usToSeconds(startUs), duration: usToSeconds(endUs - startUs) };
}

// Timeline position (seconds) for a discrete change that must take effect at frame f:
// half a frame early, so seeking exactly to f / fps never lands on the set point.
export const discreteAt = (f) => (f - 0.5) / FPS;
