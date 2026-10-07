// scenes + timings -> timeline (design §4.6). Hand-made inputs, no files.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from '../scripts/resolve.mjs';

const phrase = (id, startMs, endMs) => ({ id, sentenceId: id.slice(0, 3), display: `text ${id}`, startMs, endMs });

function make({ phrases, scenes, durationMs = 4010, tailFrames = 15, captions = { enabled: true, style: 'phrase-bottom' } }) {
  return {
    scenes: {
      schemaVersion: '2.0.0', jobId: 'job', lang: 'ko-KR', theme: { id: 'base', accent: 'blue' },
      captions, tailFrames, scenes,
    },
    timings: { schemaVersion: '2.0.0', audio: { sha256: 'a'.repeat(64), durationMs }, phrases },
  };
}

// 120 ms -> frame 3.6 (but the first scene always starts at 0); 1050 ms -> 31.5 -> 32 (half up);
// 2000 ms -> 60; 3333 ms -> 99.99 -> 100. durationMs 4010 -> ceil(120.3) = 121, + 15 tail = 136.
const PHRASES = [phrase('p1', 120, 900), phrase('p2', 1050, 1900), phrase('p3', 2000, 3000), phrase('p4', 3333, 3900)];
const scene = (id, startPhrase, transition, props = {}) => ({ id, type: 'keyword', startPhrase, props, ...(transition ? { transition } : {}) });
const SCENES = [
  scene('a', 'p1', { id: 'crossfade', durationFrames: 12 }),
  scene('b', 'p2', { id: 'crossfade', durationFrames: 13 }),
  scene('c', 'p3', { id: 'cut' }),
  scene('d', 'p4'),
];
const base = () => make({ phrases: PHRASES, scenes: SCENES });
const run = (m = base()) => resolve(m.scenes, m.timings);

describe('nominal ranges', () => {
  const t = run();
  const nominal = t.scenes.map((s) => [s.nominalStart, s.nominalEnd]);

  test('total frames = ceil(durationMs * 30 / 1000) + tailFrames', () => {
    assert.equal(t.totalFrames, 136);
    assert.equal(t.fps, 30);
    for (const [ms, tail, want] of [[4000, 0, 120], [4001, 0, 121], [4010, 15, 136], [33, 0, 1], [34, 3, 5], [0, 7, 7]]) {
      const m = make({ phrases: [phrase('p1', 0, 10)], scenes: [scene('a', 'p1')], durationMs: ms, tailFrames: tail });
      assert.equal(run(m).totalFrames, want, `${ms} ms + ${tail}`);
    }
  });

  test('first scene starts at 0 even when its phrase starts later', () => {
    assert.equal(nominal[0][0], 0);
  });

  test('other scenes start at round(startMs * 30 / 1000), half up', () => {
    assert.deepEqual(nominal.map((n) => n[0]), [0, 32, 60, 100]);
  });

  test('each scene ends where the next begins; the last ends at totalFrames', () => {
    assert.deepEqual(nominal, [[0, 32], [32, 60], [60, 100], [100, 136]]);
  });

  test('half-up boundaries: 50 ms -> 2, 16 ms -> 0, 17 ms -> 1', () => {
    const m = make({
      phrases: [phrase('p1', 0, 5), phrase('p2', 50, 60), phrase('p3', 67, 90)],
      scenes: [scene('a', 'p1'), scene('b', 'p2'), scene('c', 'p3')],
      durationMs: 1000,
    });
    assert.deepEqual(run(m).scenes.map((s) => s.nominalStart), [0, 2, 2]);
    const m2 = make({
      phrases: [phrase('p1', 0, 5), phrase('p2', 16, 20), phrase('p3', 17, 30)],
      scenes: [scene('a', 'p1'), scene('b', 'p2'), scene('c', 'p3')],
      durationMs: 1000,
    });
    assert.deepEqual(run(m2).scenes.map((s) => s.nominalStart), [0, 0, 1]);
  });
});

describe('clip ranges', () => {
  const t = run();
  const by = Object.fromEntries(t.scenes.map((s) => [s.id, s]));

  test('crossfade d=12: leadIn 6 on the incoming scene, leadOut 6 on the outgoing scene', () => {
    assert.equal(by.a.leadOut, 6);
    assert.equal(by.b.leadIn, 6);
    assert.equal(by.a.clipEnd, by.a.nominalEnd + 6);
    assert.equal(by.b.clipStart, by.b.nominalStart - 6);
  });

  test('crossfade d=13: leadIn floor = 6 on the incoming scene, leadOut ceil = 7 on the outgoing scene', () => {
    assert.equal(by.b.leadOut, 7);
    assert.equal(by.c.leadIn, 6);
    assert.equal(by.b.clipEnd, 60 + 7);
    assert.equal(by.c.clipStart, 60 - 6);
  });

  test('cut: no lead on either side', () => {
    assert.equal(by.c.leadOut, 0);
    assert.equal(by.d.leadIn, 0);
    assert.equal(by.c.clipEnd, by.c.nominalEnd);
    assert.equal(by.d.clipStart, by.d.nominalStart);
  });

  test('first scene has no leadIn and the last has no leadOut', () => {
    assert.equal(by.a.leadIn, 0);
    assert.equal(by.a.clipStart, 0);
    assert.equal(by.d.leadOut, 0);
    assert.equal(by.d.clipEnd, 136);
  });

  test('full clip table', () => {
    assert.deepEqual(t.scenes.map((s) => [s.clipStart, s.clipEnd]), [[0, 38], [26, 67], [54, 100], [100, 136]]);
  });

  test('odd d=1 gives leadIn 0, leadOut 1', () => {
    const m = make({
      phrases: PHRASES.slice(0, 2),
      scenes: [scene('a', 'p1', { id: 'crossfade', durationFrames: 1 }), scene('b', 'p2')],
    });
    const s = run(m).scenes;
    assert.equal(s[0].leadOut, 1);
    assert.equal(s[1].leadIn, 0);
  });
});

describe('transitionIn', () => {
  const t = run();
  test("first scene is { id: 'cut' }", () => {
    assert.deepEqual(t.scenes[0].transitionIn, { id: 'cut' });
  });
  test('a scene after a crossfade carries its duration', () => {
    assert.deepEqual(t.scenes[1].transitionIn, { id: 'crossfade', durationFrames: 12 });
    assert.deepEqual(t.scenes[2].transitionIn, { id: 'crossfade', durationFrames: 13 });
  });
  test("a scene after a cut is { id: 'cut' }", () => {
    assert.deepEqual(t.scenes[3].transitionIn, { id: 'cut' });
  });
  test("a scene whose predecessor has no transition field is { id: 'cut' }", () => {
    const m = make({ phrases: PHRASES.slice(0, 2), scenes: [scene('a', 'p1'), scene('b', 'p2')] });
    assert.deepEqual(run(m).scenes[1].transitionIn, { id: 'cut' });
  });
});

describe('atPhrase -> atFrame', () => {
  const props = {
    title: 'x',
    items: [
      { text: 'one', atPhrase: 'p2' },
      { text: 'two', atPhrase: 'p3' },
      { text: 'deep', nested: { list: [{ atPhrase: 'p4' }] } },
    ],
  };
  const m = make({
    phrases: PHRASES,
    scenes: [scene('a', 'p1'), scene('b', 'p2', { id: 'cut' }, props), scene('c', 'p3'), scene('d', 'p4')],
  });
  const before = structuredClone(m);
  const t = run(m);
  const b = t.scenes[1];

  test('atFrame is relative to the scene nominalStart, atPhrase key is removed (nested in arrays)', () => {
    // b.nominalStart = 32; p2 -> 32, p3 -> 60, p4 -> 100
    assert.deepEqual(b.props.items[0], { text: 'one', atFrame: 0 });
    assert.deepEqual(b.props.items[1], { text: 'two', atFrame: 28 });
    assert.deepEqual(b.props.items[2], { text: 'deep', nested: { list: [{ atFrame: 68 }] } });
    assert.ok(!JSON.stringify(t).includes('atPhrase'));
    assert.equal(b.props.title, 'x');
  });

  test('item on the scene first phrase lands on frame 0 (same rounding as scene starts)', () => {
    assert.equal(b.props.items[0].atFrame, 0);
  });

  test('first scene is measured from frame 0, not from its phrase start', () => {
    const m2 = make({ phrases: PHRASES, scenes: [scene('a', 'p1', undefined, { atPhrase: 'p1' })] });
    // p1 at 120 ms = 3.6 -> 4 frames from nominalStart 0
    assert.equal(run(m2).scenes[0].props.atFrame, 4);
  });

  test('inputs are not mutated', () => {
    assert.deepEqual(m, before);
  });
});

describe('$timing', () => {
  const t = run();
  test('{ fps, clipFrames, leadInFrames, nominalFrames } for every scene', () => {
    assert.deepEqual(t.scenes.map((s) => s.props.$timing), [
      { fps: 30, clipFrames: 38, leadInFrames: 0, nominalFrames: 32 },
      { fps: 30, clipFrames: 41, leadInFrames: 6, nominalFrames: 28 },
      { fps: 30, clipFrames: 46, leadInFrames: 6, nominalFrames: 40 },
      { fps: 30, clipFrames: 36, leadInFrames: 0, nominalFrames: 36 },
    ]);
  });
  test('source props are kept next to $timing', () => {
    const m = make({ phrases: PHRASES.slice(0, 1), scenes: [scene('a', 'p1', undefined, { text: 'hi', emphasis: 'accent' })] });
    const p = run(m).scenes[0].props;
    assert.equal(p.text, 'hi');
    assert.equal(p.emphasis, 'accent');
    assert.deepEqual(Object.keys(p).sort(), ['$timing', 'emphasis', 'text']);
  });
});

describe('top-level fields', () => {
  test('metadata is carried over', () => {
    const t = run();
    assert.equal(t.schemaVersion, '2.0.0');
    assert.equal(t.jobId, 'job');
    assert.equal(t.lang, 'ko-KR');
    assert.deepEqual(t.theme, { id: 'base', accent: 'blue' });
    assert.deepEqual(t.narration, { durationMs: 4010, sha256: 'a'.repeat(64) });
  });
  test('scene id, type and motion (null when absent)', () => {
    const m = base();
    m.scenes.scenes[1].motion = { in: 'fade-up' };
    const t = run(m);
    assert.deepEqual(t.scenes.map((s) => [s.id, s.type]), [['a', 'keyword'], ['b', 'keyword'], ['c', 'keyword'], ['d', 'keyword']]);
    assert.equal(t.scenes[0].motion, null);
    assert.deepEqual(t.scenes[1].motion, { in: 'fade-up' });
  });
});

describe('captions', () => {
  // gaps: q1->q2 249 ms (closed), q2->q3 250 ms (kept), q3->q4 0 ms (closed, no-op), q4->q5 100 ms (closed)
  const phrases = [
    phrase('q1', 0, 1000), phrase('q2', 1249, 2000), phrase('q3', 2250, 3000),
    phrase('q4', 3000, 3500), phrase('q5', 3600, 3601),
  ];
  const mk = (captions) => make({ phrases, scenes: [scene('a', 'q1')], durationMs: 4000, captions });
  const t = run(mk({ enabled: true, style: 'phrase-bottom' }));
  const items = t.captions.items;

  test('items carry id, display text and frames (ceil)', () => {
    assert.deepEqual(items.map((i) => [i.id, i.text]), phrases.map((p) => [p.id, p.display]));
    assert.deepEqual(Object.keys(items[0]).sort(), ['endFrame', 'id', 'startFrame', 'text']);
    // 3601 ms -> ceil(108.03) = 109, 3600 -> 108
    assert.deepEqual([items[4].startFrame, items[4].endFrame], [108, 109]);
  });

  test('a 249 ms gap is closed: q1 ends at ceil(1249 * 30 / 1000) = 38, not 30', () => {
    assert.equal(items[0].startFrame, 0);
    assert.equal(items[0].endFrame, 38);
    assert.equal(items[1].startFrame, 38);
  });

  test('a 250 ms gap is not closed: q2 ends at ceil(2000 * 30 / 1000) = 60, not 68', () => {
    assert.equal(items[1].endFrame, 60);
    assert.equal(items[2].startFrame, 68);
  });

  test('touching phrases and small gaps stay contiguous; the last ends at its own endMs', () => {
    assert.equal(items[2].endFrame, 90);
    assert.equal(items[3].startFrame, 90);
    // q4 ends at 3500 ms (frame 105) unless its 100 ms gap to q5 is closed, which moves it to 3600 ms (frame 108)
    assert.equal(items[3].endFrame, 108);
    assert.equal(items[4].startFrame, 108);
  });

  test('captions config is carried; enabled false -> items []', () => {
    assert.equal(t.captions.enabled, true);
    assert.equal(t.captions.style, 'phrase-bottom');
    const off = run(mk({ enabled: false, style: 'phrase-bottom' }));
    assert.deepEqual(off.captions, { enabled: false, style: 'phrase-bottom', items: [] });
  });
});
