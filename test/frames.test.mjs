// Time conversion rules (design §4.6, §5.4, §11 S0 "시간 변환").
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FPS, MIN_SCENE_FRAMES, MAX_TOTAL_FRAMES, CAPTION_GAP_HOLD_MS,
  msToFrameRound, msToFrameCeil, totalFrames, leadSplit, sceneNominal, sceneClips,
  captionFrames, framesToSecondsAttrs, discreteAt,
} from '../scripts/lib/frames.mjs';

test('constants', () => {
  assert.equal(FPS, 30);
  assert.equal(MIN_SCENE_FRAMES, 24);
  assert.equal(MAX_TOTAL_FRAMES, 2700);
  assert.equal(CAPTION_GAP_HOLD_MS, 250);
});

describe('scene boundary: round, half up', () => {
  test('50 ms -> 2, 16 ms -> 0, 17 ms -> 1', () => {
    assert.equal(msToFrameRound(50), 2);
    assert.equal(msToFrameRound(16), 0);
    assert.equal(msToFrameRound(17), 1);
  });
  test('exact multiples and half points', () => {
    assert.equal(msToFrameRound(0), 0);
    assert.equal(msToFrameRound(1000), 30);
    assert.equal(msToFrameRound(500), 15);
    // 14250 ms = 427.5 frames, rounds up
    assert.equal(msToFrameRound(14250), 428);
    // 16.666 ms is exactly half a frame only at 50/3; 17 is above, 16 below
    assert.equal(msToFrameRound(33), 1);
    assert.equal(msToFrameRound(34), 1);
    assert.equal(msToFrameRound(50), 2);
  });
  test('returns integers for every ms in a minute', () => {
    for (let ms = 0; ms <= 60000; ms++) {
      const f = msToFrameRound(ms);
      assert.ok(Number.isInteger(f));
      assert.equal(f, Math.floor(ms * 0.03 + 0.5 + 1e-9));
    }
  });
});

describe('caption boundary: ceil', () => {
  test('33 -> 1, 34 -> 2, 0 -> 0, 1000 -> 30', () => {
    assert.equal(msToFrameCeil(33), 1);
    assert.equal(msToFrameCeil(34), 2);
    assert.equal(msToFrameCeil(0), 0);
    assert.equal(msToFrameCeil(1000), 30);
  });
  test('1 ms -> 1 frame and 334 ms -> 11 (333.33 is not a whole frame)', () => {
    assert.equal(msToFrameCeil(1), 1);
    assert.equal(msToFrameCeil(333), 10);
    assert.equal(msToFrameCeil(334), 11);
  });
  test('a frame is visible iff f*1000/30 lies in [startMs, endMs)', () => {
    for (const [startMs, endMs] of [[120, 1310], [3010, 4870], [0, 33], [17, 34], [999, 1001]]) {
      const { startFrame, endFrame } = captionFrames([{ startMs, endMs }])[0];
      for (let f = 0; f < 200; f++) {
        const t = (f * 1000) / 30;
        assert.equal(f >= startFrame && f < endFrame, t >= startMs && t < endMs, `f=${f} [${startMs},${endMs})`);
      }
    }
  });
});

describe('caption gap hold', () => {
  const pair = (gap) => captionFrames([
    { startMs: 0, endMs: 1000 },
    { startMs: 1000 + gap, endMs: 2000 + gap },
  ]);

  test('gap 249 ms is closed: previous caption ends at the next start', () => {
    const [a, b] = pair(249);
    assert.equal(a.endFrame, msToFrameCeil(1249));
    assert.equal(a.endFrame, b.startFrame);
  });
  test('gap 250 ms is kept', () => {
    const [a, b] = pair(250);
    assert.equal(a.endFrame, 30);
    assert.ok(a.endFrame < b.startFrame);
  });
  test('gap 251 ms is kept', () => {
    const [a, b] = pair(251);
    assert.equal(a.endFrame, 30);
    assert.ok(a.endFrame < b.startFrame);
  });
  test('gap 0 stays contiguous, overlap is never stretched', () => {
    const [a, b] = pair(0);
    assert.equal(a.endFrame, b.startFrame);
    const [c] = captionFrames([{ startMs: 0, endMs: 1100 }, { startMs: 1000, endMs: 2000 }]);
    assert.equal(c.endFrame, msToFrameCeil(1100));
  });
  test('closing happens in ms before conversion (non-integer frame boundary)', () => {
    // end 1000 ms is frame 30 exactly, next start 1240 ms is 37.2 -> ceil 38
    const [a] = captionFrames([{ startMs: 0, endMs: 1000 }, { startMs: 1240, endMs: 2000 }]);
    assert.equal(a.endFrame, 38);
  });
  test('last caption ends at its own endMs', () => {
    const out = captionFrames([{ startMs: 100, endMs: 1310 }]);
    assert.deepEqual(out, [{ startFrame: 3, endFrame: 40 }]);
  });
  test('custom holdMs is honored and each gap is judged on the original ends', () => {
    const phrases = [
      { startMs: 0, endMs: 100 }, { startMs: 150, endMs: 300 }, { startMs: 340, endMs: 500 },
    ];
    const out = captionFrames(phrases, 60);
    assert.equal(out[0].endFrame, msToFrameCeil(150));
    assert.equal(out[1].endFrame, msToFrameCeil(340));
    assert.equal(captionFrames(phrases, 40)[0].endFrame, msToFrameCeil(100));
  });
});

describe('transition lead split', () => {
  test('even d splits evenly', () => assert.deepEqual(leadSplit(12), { leadIn: 6, leadOut: 6 }));
  test('odd d gives the extra frame to the outgoing scene', () => assert.deepEqual(leadSplit(13), { leadIn: 6, leadOut: 7 }));
  test('cut and minimum crossfade', () => {
    assert.deepEqual(leadSplit(0), { leadIn: 0, leadOut: 0 });
    assert.deepEqual(leadSplit(1), { leadIn: 0, leadOut: 1 });
    assert.deepEqual(leadSplit(2), { leadIn: 1, leadOut: 1 });
  });
  test('leadIn + leadOut always equals d', () => {
    for (let d = 0; d <= 30; d++) {
      const { leadIn, leadOut } = leadSplit(d);
      assert.equal(leadIn + leadOut, d);
      assert.ok(leadOut - leadIn === 0 || leadOut - leadIn === 1);
    }
  });
});

describe('totalFrames', () => {
  test('ceil(duration) plus tail', () => {
    assert.equal(totalFrames(1000, 0), 30);
    assert.equal(totalFrames(1001, 0), 31);
    assert.equal(totalFrames(45120, 15), 1354 + 15);
    assert.equal(totalFrames(1, 90), 91);
  });
});

describe('sceneNominal / sceneClips', () => {
  test('first scene starts at 0 regardless of its phrase start; others round half up', () => {
    const n = sceneNominal([120, 14250, 20000], 900);
    assert.deepEqual(n, [
      { nominalStart: 0, nominalEnd: 428 },
      { nominalStart: 428, nominalEnd: 600 },
      { nominalStart: 600, nominalEnd: 900 },
    ]);
  });
  test('single scene spans the whole video', () => {
    assert.deepEqual(sceneNominal([0], 300), [{ nominalStart: 0, nominalEnd: 300 }]);
  });
  test('nominal ranges tile [0, total) without gaps', () => {
    const n = sceneNominal([0, 1234, 5678, 9999, 20001], 700);
    assert.equal(n[0].nominalStart, 0);
    for (let i = 1; i < n.length; i++) assert.equal(n[i].nominalStart, n[i - 1].nominalEnd);
    assert.equal(n.at(-1).nominalEnd, 700);
  });

  test('mixed odd crossfade, cut, even crossfade', () => {
    const nominal = [
      { nominalStart: 0, nominalEnd: 90 },
      { nominalStart: 90, nominalEnd: 180 },
      { nominalStart: 180, nominalEnd: 300 },
      { nominalStart: 300, nominalEnd: 400 },
    ];
    // after scene 0: crossfade 13, after scene 1: cut, after scene 2: crossfade 12, last: none
    const clips = sceneClips(nominal, [13, 0, 12, 0]);
    assert.deepEqual(clips, [
      { nominalStart: 0, nominalEnd: 90, leadIn: 0, leadOut: 7, clipStart: 0, clipEnd: 97 },
      { nominalStart: 90, nominalEnd: 180, leadIn: 6, leadOut: 0, clipStart: 84, clipEnd: 180 },
      { nominalStart: 180, nominalEnd: 300, leadIn: 0, leadOut: 6, clipStart: 180, clipEnd: 306 },
      { nominalStart: 300, nominalEnd: 400, leadIn: 6, leadOut: 0, clipStart: 294, clipEnd: 400 },
    ]);
  });
  test('crossfade window [b - floor(d/2), b + ceil(d/2)) is covered by both clips', () => {
    const nominal = [{ nominalStart: 0, nominalEnd: 100 }, { nominalStart: 100, nominalEnd: 200 }];
    for (const d of [2, 3, 12, 13, 30]) {
      const [a, b] = sceneClips(nominal, [d, 0]);
      assert.equal(b.clipStart, 100 - Math.floor(d / 2));
      assert.equal(a.clipEnd, 100 + Math.ceil(d / 2));
      assert.equal(a.clipEnd - b.clipStart, d);
    }
  });
  test('all cuts leave clips equal to nominal ranges', () => {
    const nominal = [{ nominalStart: 0, nominalEnd: 50 }, { nominalStart: 50, nominalEnd: 120 }];
    for (const c of sceneClips(nominal, [0, 0])) {
      assert.equal(c.clipStart, c.nominalStart);
      assert.equal(c.clipEnd, c.nominalEnd);
    }
  });
  test('first scene never leads in and last scene never leads out, even if a stray transition value is given', () => {
    const nominal = [{ nominalStart: 0, nominalEnd: 60 }, { nominalStart: 60, nominalEnd: 120 }];
    const [a, b] = sceneClips(nominal, [10, 10]);
    assert.equal(a.leadIn, 0);
    assert.equal(b.leadOut, 0);
  });
});

describe('framesToSecondsAttrs (microsecond floor, end 1 µs early)', () => {
  test('frame 1 starts at 0.033333', () => {
    assert.equal(framesToSecondsAttrs(1, 2).start, '0.033333');
  });
  test('[1,2) lasts 0.033333', () => {
    assert.deepEqual(framesToSecondsAttrs(1, 2), { start: '0.033333', duration: '0.033332' });
  });
  test('[0,3) lasts 0.099999', () => {
    assert.deepEqual(framesToSecondsAttrs(0, 3), { start: '0.000000', duration: '0.099999' });
  });
  test('[2,3) starts 0.066666 and lasts 0.033333 (start and end floored separately)', () => {
    assert.deepEqual(framesToSecondsAttrs(2, 3), { start: '0.066666', duration: '0.033333' });
  });
  test('whole seconds and large frames keep six decimals', () => {
    assert.deepEqual(framesToSecondsAttrs(30, 60), { start: '1.000000', duration: '0.999999' });
    assert.deepEqual(framesToSecondsAttrs(0, 2700), { start: '0.000000', duration: '89.999999' });
    assert.equal(framesToSecondsAttrs(2699, 2700).start, '89.966666');
  });
  test('output is always digits.dddddd', () => {
    for (let s = 0; s <= 2700; s += 7) {
      const { start, duration } = framesToSecondsAttrs(s, s + 5);
      assert.match(start, /^\d+\.\d{6}$/);
      assert.match(duration, /^\d+\.\d{6}$/);
    }
  });

  // Engine seek time f/30 must fall inside [start, start + duration) for every visible frame.
  const covers = (s, e, f) => {
    const { start, duration } = framesToSecondsAttrs(s, e);
    const lo = parseFloat(start);
    const t = f / 30;
    return { ok: lo <= t && t < lo + parseFloat(duration), lo, hi: lo + parseFloat(duration), t };
  };

  test('seek time f/30 is inside the attrs window for every f, frames 0..2700, assorted lengths', () => {
    const failures = [];
    const lengths = [1, 2, 3, 4, 7, 24, 29, 30, 31, 90];
    for (let s = 0; s <= 2700; s++) {
      for (const len of lengths) {
        const e = Math.min(s + len, 2700);
        if (e <= s) continue;
        for (let f = s; f < e; f++) {
          const r = covers(s, e, f);
          if (!r.ok) failures.push(`[${s},${e}) f=${f} t=${r.t} window=[${r.lo},${r.hi})`);
        }
      }
    }
    assert.deepEqual(failures.slice(0, 5), []);
  });

  test('in double arithmetic (as the engine adds them) the end frame is outside the window', () => {
    const failures = [];
    for (let s = 0; s < 2700; s++) {
      for (let e = s + 1; e <= 2700; e++) {
        if (covers(s, e, e).ok) failures.push(`[${s},${e})`);
        if (failures.length > 5) break;
      }
      if (failures.length > 5) break;
    }
    assert.deepEqual(failures, []);
  });

  test('discreteAt is half a frame before the frame time', () => {
    assert.equal(discreteAt(30), 29.5 / 30);
    for (let f = 1; f <= 2700; f++) assert.ok(discreteAt(f) < f / 30 && discreteAt(f) > (f - 1) / 30);
  });

  test('seek time check at both extremes (first and last visible frame) for every start/end pair', () => {
    const failures = [];
    for (let s = 0; s <= 2700; s++) {
      for (let e = s + 1; e <= 2700; e++) {
        const first = covers(s, e, s);
        const last = covers(s, e, e - 1);
        if (!first.ok || !last.ok) failures.push(`[${s},${e})`);
        if (failures.length > 5) break;
      }
      if (failures.length > 5) break;
    }
    assert.deepEqual(failures, []);
  });

  // Exact (integer microsecond) half-open check. Seek time f/30 s is f*1e6/30 us, compared as f*1e6 vs us*30.
  // Float sums such as parseFloat(start) + parseFloat(duration) can round above the true end
  // (e.g. [12,36): 0.4 + 0.8 = 1.2000000000000002), so exclusivity of the end frame is only
  // guaranteed in exact arithmetic; the engine's own end comparison is verified in S1 (design §5.4).
  const us = (str) => Number(str.replace('.', ''));
  test('in exact arithmetic the frame before start and the end frame are outside the window', () => {
    const failures = [];
    for (let s = 1; s <= 2700; s++) {
      for (const len of [1, 24, 90]) {
        const e = s + len;
        if (e > 2700) continue;
        const { start, duration } = framesToSecondsAttrs(s, e);
        const lo = us(start) * 30;
        const hi = (us(start) + us(duration)) * 30;
        if ((s - 1) * 1e6 >= lo) failures.push(`before [${s},${e})`);
        if (s * 1e6 < lo || (e - 1) * 1e6 >= hi) failures.push(`inside [${s},${e})`);
        if (e * 1e6 < hi) failures.push(`end [${s},${e})`);
      }
    }
    assert.deepEqual(failures.slice(0, 5), []);
  });
});
