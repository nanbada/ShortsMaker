// scenes.json + timings.json → timeline.json (design §4.6). Frames are computed here only.
// Inputs must already pass scripts/validate.mjs.
import {
  FPS, totalFrames, sceneNominal, sceneClips, captionFrames, msToFrameRound,
} from './lib/frames.mjs';

// Replace every { atPhrase } with { atFrame } relative to the scene's nominal start.
function resolveProps(value, phraseFrame, nominalStart) {
  if (Array.isArray(value)) return value.map((v) => resolveProps(v, phraseFrame, nominalStart));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'atPhrase') out.atFrame = phraseFrame(v) - nominalStart;
      else out[k] = resolveProps(v, phraseFrame, nominalStart);
    }
    return out;
  }
  return value;
}

export function resolve(scenes, timings) {
  const byId = new Map(timings.phrases.map((p) => [p.id, p]));
  const total = totalFrames(timings.audio.durationMs, scenes.tailFrames);
  const nominal = sceneNominal(scenes.scenes.map((s) => byId.get(s.startPhrase).startMs), total);
  const transitionFrames = scenes.scenes.map((s) => s.transition?.durationFrames ?? 0);
  const clips = sceneClips(nominal, transitionFrames);
  // atPhrase uses the same rounding as scene starts so an item on a scene's first phrase lands on frame 0.
  const phraseFrame = (id) => msToFrameRound(byId.get(id).startMs);
  const caps = captionFrames(timings.phrases);
  return {
    schemaVersion: '2.0.0',
    jobId: scenes.jobId,
    lang: scenes.lang,
    fps: FPS,
    totalFrames: total,
    narration: { durationMs: timings.audio.durationMs, sha256: timings.audio.sha256 },
    theme: scenes.theme,
    captions: {
      ...scenes.captions,
      items: scenes.captions.enabled
        ? timings.phrases.map((p, i) => ({ id: p.id, text: p.display, ...caps[i] }))
        : [],
    },
    scenes: scenes.scenes.map((s, i) => {
      const c = clips[i];
      const prev = scenes.scenes[i - 1]?.transition;
      return {
        id: s.id,
        type: s.type,
        ...c,
        transitionIn: i > 0 && prev?.id === 'crossfade' ? { id: 'crossfade', durationFrames: prev.durationFrames } : { id: 'cut' },
        motion: s.motion ?? null,
        props: {
          ...resolveProps(s.props, phraseFrame, c.nominalStart),
          $timing: {
            fps: FPS,
            clipFrames: c.clipEnd - c.clipStart,
            leadInFrames: c.leadIn,
            nominalFrames: c.nominalEnd - c.nominalStart,
          },
        },
      };
    }),
  };
}
