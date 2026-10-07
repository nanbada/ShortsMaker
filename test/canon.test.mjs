// Normalization and hashing rules (design §4).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  nfc, graphemeCount, cpLength, cpSlice, sha256Hex, canonicalJson, hashJson, phraseHash, phraseIdsForSentence,
} from '../scripts/lib/canon.mjs';

describe('canonicalJson', () => {
  test('sorts keys, no whitespace', () => {
    assert.equal(canonicalJson({ b: 1, a: 2, c: 'x' }), '{"a":2,"b":1,"c":"x"}');
  });
  test('sorts nested keys recursively and keeps array order', () => {
    assert.equal(
      canonicalJson({ z: [{ b: 1, a: 2 }, 3, [{ y: 1, x: 0 }]], a: { d: null, c: true } }),
      '{"a":{"c":true,"d":null},"z":[{"a":2,"b":1},3,[{"x":0,"y":1}]]}',
    );
    assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
  });
  test('scalars and empties', () => {
    assert.equal(canonicalJson(null), 'null');
    assert.equal(canonicalJson(true), 'true');
    assert.equal(canonicalJson('가"\n'), '"가\\"\\n"');
    assert.equal(canonicalJson({}), '{}');
    assert.equal(canonicalJson([]), '[]');
  });
  test('rejects NaN and Infinity, also nested', () => {
    assert.throws(() => canonicalJson(NaN), /non-finite/);
    assert.throws(() => canonicalJson(Infinity), /non-finite/);
    assert.throws(() => canonicalJson(-Infinity), /non-finite/);
    assert.throws(() => canonicalJson({ a: [1, NaN] }), /non-finite/);
  });
  test('rejects unsupported types', () => {
    assert.throws(() => canonicalJson(undefined), /unsupported/);
    assert.throws(() => canonicalJson(() => 1), /unsupported/);
    assert.throws(() => canonicalJson(10n), /unsupported/);
    assert.throws(() => canonicalJson([undefined]), /unsupported/);
  });
  test('object keys with undefined values are dropped', () => {
    assert.equal(canonicalJson({ a: undefined, b: 1 }), '{"b":1}');
  });
  test('number formatting follows JSON.stringify', () => {
    assert.equal(canonicalJson(0.1), '0.1');
    assert.equal(canonicalJson(0.5), '0.5');
    assert.equal(canonicalJson(1e21), '1e+21');
    assert.equal(canonicalJson(1e-7), '1e-7');
    assert.equal(canonicalJson(123456789012345680000), '123456789012345680000');
    assert.equal(canonicalJson(5e-324), '5e-324');
    assert.equal(canonicalJson(1.0), '1');
    assert.equal(canonicalJson(-1.5), '-1.5');
  });
  test('-0 is written as 0', () => {
    assert.equal(canonicalJson(-0), '0');
    assert.equal(canonicalJson({ a: -0 }), '{"a":0}');
  });
  test('output parses back to an equal value', () => {
    const v = { s: 'a b', n: [0.1, 1e21, -3], o: { k: [null, false] } };
    assert.deepEqual(JSON.parse(canonicalJson(v)), v);
  });
});

describe('hashJson', () => {
  test('stable across key order', () => {
    const a = { schemaVersion: '2.0.0', voice: { seed: 7, settings: { stability: 0.5, similarity: 0.75 } }, list: [1, 2] };
    const b = { list: [1, 2], voice: { settings: { similarity: 0.75, stability: 0.5 }, seed: 7 }, schemaVersion: '2.0.0' };
    assert.equal(hashJson(a), hashJson(b));
  });
  test('differs when a value or array order differs', () => {
    assert.notEqual(hashJson({ a: [1, 2] }), hashJson({ a: [2, 1] }));
    assert.notEqual(hashJson({ a: 1 }), hashJson({ a: 2 }));
  });
  test('is lowercase hex sha256 of the canonical UTF-8 bytes', () => {
    const v = { b: '한글', a: 1 };
    const expected = createHash('sha256').update(Buffer.from('{"a":1,"b":"한글"}', 'utf8')).digest('hex');
    assert.equal(hashJson(v), expected);
    assert.match(hashJson(v), /^[0-9a-f]{64}$/);
  });
  test('known vector: empty object', () => {
    assert.equal(hashJson({}), '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  });
  test('sha256Hex of empty input', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('NFC', () => {
  test('decomposed Hangul equals composed after nfc', () => {
    const decomposed = '가'; // ㄱ + ㅏ
    assert.notEqual(decomposed, '가');
    assert.equal(nfc(decomposed), '가');
    assert.equal(nfc('가'), '가');
  });
  test('combining accents compose', () => {
    assert.equal(nfc('é'), 'é');
  });
  test('phrase hash is the same for decomposed and composed input', () => {
    assert.equal(phraseHash('가나다'), phraseHash('가나다'));
  });
});

describe('graphemeCount', () => {
  test('ASCII and empty', () => {
    assert.equal(graphemeCount(''), 0);
    assert.equal(graphemeCount('abc'), 3);
  });
  test('Hangul syllables and decomposed jamo', () => {
    assert.equal(graphemeCount('한글'), 2);
    assert.equal(graphemeCount('한'), 1);
    assert.equal(graphemeCount('1,200원'), 6);
  });
  test('emoji, ZWJ sequences, skin tones, flags, combining marks', () => {
    assert.equal(graphemeCount('😀'), 1);
    assert.equal(graphemeCount('👨‍👩‍👧‍👦'), 1);
    assert.equal(graphemeCount('👍🏽'), 1);
    assert.equal(graphemeCount('🇰🇷'), 1);
    assert.equal(graphemeCount('é'), 1);
    assert.equal(graphemeCount('a👨‍👩‍👧‍👦b'), 3);
  });
  test('differs from code point and UTF-16 lengths', () => {
    const family = '👨‍👩‍👧‍👦';
    assert.equal(cpLength(family), 7);
    assert.equal(family.length, 11);
    assert.equal(graphemeCount(family), 1);
  });
});

describe('code point helpers', () => {
  const s = 'a😀b😀c';
  test('cpLength counts astral characters once', () => {
    assert.equal(cpLength(s), 5);
    assert.equal(s.length, 7);
    assert.equal(cpLength('가나다'), 3);
  });
  test('cpSlice never splits a surrogate pair', () => {
    assert.equal(cpSlice(s, 1, 3), '😀b');
    assert.equal(cpSlice(s, 0, 2), 'a😀');
    assert.equal(cpSlice(s, 3), '😀c');
    assert.equal(cpSlice(s, 2, 2), '');
    assert.equal(cpSlice(s, 0, 5), s);
    assert.notEqual(s.slice(1, 2), cpSlice(s, 1, 2));
  });
  test('half-open ranges tile a string', () => {
    assert.equal(cpSlice(s, 0, 2) + cpSlice(s, 2, 5), s);
  });
});

describe('phraseIdsForSentence', () => {
  test('format is <sentenceId>-<8 hex of sha256(NFC display)>', () => {
    const [id] = phraseIdsForSentence('s01', ['M/M 계산법,']);
    assert.match(id, /^s01-[0-9a-f]{8}$/);
    assert.equal(id, `s01-${sha256Hex(Buffer.from('M/M 계산법,', 'utf8')).slice(0, 8)}`);
  });
  test('repeats get -2, -3 in order of appearance', () => {
    const ids = phraseIdsForSentence('s05', ['네,', '아니요,', '네,', '네,', '아니요,']);
    const h = (d) => `s05-${phraseHash(d)}`;
    assert.deepEqual(ids, [h('네,'), h('아니요,'), `${h('네,')}-2`, `${h('네,')}-3`, `${h('아니요,')}-2`]);
    assert.equal(new Set(ids).size, ids.length);
  });
  test('repeat counters are per call, so sentences are independent', () => {
    const a = phraseIdsForSentence('s01', ['네,', '네,']);
    const b = phraseIdsForSentence('s02', ['네,', '네,']);
    assert.ok(a[1].startsWith('s01-') && b[1].startsWith('s02-'));
    assert.ok(a[1].endsWith('-2') && b[1].endsWith('-2'));
    assert.equal(a[0].slice(4), b[0].slice(4));
  });
  test('ids stay valid against the schema phraseId pattern', () => {
    const re = /^[a-z0-9][a-z0-9-]{0,31}-[0-9a-f]{8}(-[1-9][0-9]*)?$/;
    for (const id of phraseIdsForSentence('s01', ['a', 'a', 'b', 'a'])) assert.match(id, re);
  });
  test('inserting a phrase before another leaves the later phrase id unchanged', () => {
    const before = phraseIdsForSentence('s03', ['먼저 투입', '인원을 확인하고,']);
    const after = phraseIdsForSentence('s03', ['먼저', '투입', '인원을 확인하고,']);
    assert.equal(before[1], after[2]);
  });
  test('decomposed and composed display give the same id', () => {
    assert.deepEqual(phraseIdsForSentence('s01', ['가']), phraseIdsForSentence('s01', ['가']));
  });
  test('8-char hash separates strings that collide at 4 chars', () => {
    // Design §4.4: both start with 9ff9 (full: 9ff9b1dd... vs 9ff9e001...), so 4 chars collide and 8 do not.
    const a = phraseHash('항목 15입니다.');
    const b = phraseHash('항목 167입니다.');
    assert.equal(a.slice(0, 4), '9ff9');
    assert.equal(b.slice(0, 4), '9ff9');
    assert.equal(a, '9ff9b1dd');
    assert.equal(b, '9ff9e001');
    assert.notEqual(a, b);
    const [ia, ib] = [phraseIdsForSentence('s01', ['항목 15입니다.'])[0], phraseIdsForSentence('s01', ['항목 167입니다.'])[0]];
    assert.notEqual(ia, ib);
  });
});
