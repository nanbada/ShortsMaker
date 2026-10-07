// Forced-alignment character mapping (design §7.2 steps 3-4). Response shape: characters[{text, start, end}] in seconds.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { phraseTimes } from '../scripts/align.mjs';

const ch = (text, start, end) => ({ text, start, end });

// Sentence texts sent to the aligner: "안녕 하세요" + "\n" + "네요"
const LINES = ['안녕 하세요', '네요'];
const IDS = ['s01', 's02'];
const PHRASES = [
  { id: 's01-aaaaaaaa', sentenceId: 's01', spokenRange: [0, 2] }, // 안녕
  { id: 's01-bbbbbbbb', sentenceId: 's01', spokenRange: [3, 6] }, // 하세요
  { id: 's02-cccccccc', sentenceId: 's02', spokenRange: [0, 2] }, // 네요
];

// Aligner output with whitespace entries whose times differ from the neighbouring letters.
const withSpaces = (nl = '\n') => [
  ch('안', 0.1236, 0.3), ch('녕', 0.3, 0.5004),
  ch(' ', 0.5004, 0.6199),
  ch('하', 0.65, 0.8), ch('세', 0.8, 0.9), ch('요', 0.9, 1.1996),
  ch(nl, 1.1996, 1.5),
  ch('네', 1.52, 1.7), ch('요', 1.7, 1.9234),
];

const EXPECTED = [
  { id: 's01-aaaaaaaa', startMs: 124, endMs: 500 },
  { id: 's01-bbbbbbbb', startMs: 650, endMs: 1200 },
  { id: 's02-cccccccc', startMs: 1520, endMs: 1923 },
];

const run = (chars, lines = LINES, phrases = PHRASES, ids = IDS) => phraseTimes(lines, chars, phrases, ids);
const mappingError = (e) => e instanceof Error && e.message.startsWith('mapping-error');

describe('phraseTimes', () => {
  test('two sentences: start = first non-space char start, end = last non-space char end, rounded to ms', () => {
    assert.deepEqual(run(withSpaces()), EXPECTED);
  });

  test('seconds are converted to rounded integer ms', () => {
    const r = run(withSpaces());
    for (const p of r) {
      assert.ok(Number.isInteger(p.startMs) && Number.isInteger(p.endMs));
    }
    assert.equal(r[0].startMs, 124); // 0.1236 s -> 123.6 -> 124
    assert.equal(r[0].endMs, 500); // 0.5004 s -> 500.4 -> 500
  });

  test('whitespace entries do not affect the phrase window', () => {
    // the space after "녕" spans 0.5004-0.6199 and the newline 1.1996-1.5; neither shows up in any phrase
    const r = run(withSpaces());
    assert.equal(r[0].endMs, 500);
    assert.equal(r[1].startMs, 650);
    assert.equal(r[1].endMs, 1200);
    assert.equal(r[2].startMs, 1520);
  });

  test('aligner returning "\\r\\n" as one entry where we sent "\\n"', () => {
    assert.deepEqual(run(withSpaces('\r\n')), EXPECTED);
  });

  test('aligner returning "\\r" and "\\n" as separate entries', () => {
    const chars = withSpaces();
    chars.splice(6, 1, ch('\r', 1.1996, 1.3), ch('\n', 1.3, 1.5));
    assert.deepEqual(run(chars), EXPECTED);
  });

  test('aligner omitting whitespace entries entirely, or adding leading/trailing ones', () => {
    const letters = withSpaces().filter((c) => !/\s/.test(c.text));
    assert.deepEqual(run(letters), EXPECTED);
    assert.deepEqual(run([ch(' ', 0, 0.1), ...withSpaces(), ch('\r\n', 1.9234, 2)]), EXPECTED);
  });

  test('our text with extra whitespace (double space, trailing space) still maps', () => {
    assert.deepEqual(run(withSpaces(), ['안녕  하세요 ', '네요'], [
      { id: 's01-aaaaaaaa', sentenceId: 's01', spokenRange: [0, 2] },
      { id: 's01-bbbbbbbb', sentenceId: 's01', spokenRange: [4, 7] },
      { id: 's02-cccccccc', sentenceId: 's02', spokenRange: [0, 2] },
    ]), EXPECTED);
  });

  test('a phrase range that includes spaces uses the first and last non-space chars only', () => {
    const phrases = [{ id: 'x', sentenceId: 's01', spokenRange: [0, 6] }]; // whole "안녕 하세요"
    assert.deepEqual(run(withSpaces(), LINES, phrases), [{ id: 'x', startMs: 124, endMs: 1200 }]);
    const padded = [{ id: 'y', sentenceId: 's01', spokenRange: [2, 4] }]; // " 하"
    assert.deepEqual(run(withSpaces(), LINES, padded), [{ id: 'y', startMs: 650, endMs: 800 }]);
  });

  test('positions are code points: an emoji counts as one character on both sides', () => {
    const phrases = [
      { id: 'e1', sentenceId: 's01', spokenRange: [0, 2] }, // "A😀"
      { id: 'e2', sentenceId: 's01', spokenRange: [2, 3] }, // "B"
    ];
    const chars = [ch('A', 0, 0.1), ch('😀', 0.1, 0.4), ch('B', 0.4, 0.6)];
    assert.deepEqual(run(chars, ['A😀B'], phrases, ['s01']), [
      { id: 'e1', startMs: 0, endMs: 400 },
      { id: 'e2', startMs: 400, endMs: 600 },
    ]);
  });

  test('phrase order and ids follow the phrases argument', () => {
    const r = run(withSpaces(), LINES, [...PHRASES].reverse());
    assert.deepEqual(r.map((p) => p.id), ['s02-cccccccc', 's01-bbbbbbbb', 's01-aaaaaaaa']);
  });
});

describe('mapping-error', () => {
  const bad = (mutate) => {
    const chars = withSpaces();
    mutate(chars);
    return () => run(chars);
  };

  test('a mismatched non-space character throws an error starting with "mapping-error"', () => {
    assert.throws(bad((c) => { c[4] = ch('새', 0.8, 0.9); }), mappingError);
  });

  test('the error names the position and both characters', () => {
    assert.throws(bad((c) => { c[4] = ch('새', 0.8, 0.9); }), (e) => {
      assert.match(e.message, /^mapping-error at non-space character 3/);
      assert.ok(e.message.includes('"세"') && e.message.includes('"새"'));
      return true;
    });
  });

  test('aligner returns an extra non-space character', () => {
    assert.throws(bad((c) => { c.push(ch('!', 2, 2.1)); }), mappingError);
  });

  test('aligner drops a non-space character', () => {
    assert.throws(bad((c) => { c.splice(3, 1); }), mappingError);
    assert.throws(bad((c) => { c.pop(); }), mappingError);
  });

  test('aligner returns nothing', () => {
    assert.throws(() => run([]), mappingError);
  });

  test('a whitespace difference alone is not an error, a letter difference after whitespace is', () => {
    const chars = withSpaces();
    chars[7] = ch('내', 1.52, 1.7); // first letter of sentence 2
    assert.throws(() => run(chars), mappingError);
  });
});
