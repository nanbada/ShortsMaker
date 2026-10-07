// Pronunciation substitution and caption phrase splitting (design §4.3, §4.4 phrase IDs, §7.1).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyPronounce, mergeDicts, splitSentence, buildPhrasing } from '../scripts/lib/phrasing.mjs';

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(repo(p), 'utf8'));
const LANGS = readJson('schemas/v2/languages.json').languages;
const sha = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

const split = (display, dict, max) => splitSentence(display, applyPronounce(display, dict).subs, max);
const cp = (s) => [...s];

describe('applyPronounce', () => {
  const MM = { display: 'M/M', spoken: '맨 먼스' };

  test('no entries: text unchanged, no substitutions', () => {
    assert.deepEqual(applyPronounce('안녕 M/M', []), { spoken: '안녕 M/M', subs: [] });
  });

  test('ranges are code points: an astral char before a substitution shifts by 1, not 2', () => {
    const r = applyPronounce('😀M/M', [MM]);
    assert.equal(r.spoken, '😀맨 먼스');
    // UTF-16 offsets would give display [2,5]
    assert.deepEqual(r.subs, [{ display: [1, 4], spoken: [1, 5] }]);
    assert.equal(cp('😀M/M').slice(1, 4).join(''), 'M/M');
    assert.equal(cp(r.spoken).slice(1, 5).join(''), '맨 먼스');
  });

  test('spoken ranges account for earlier length changes', () => {
    const r = applyPronounce('😀M/M x M', [MM, { display: 'M', spoken: '엠' }]);
    assert.equal(r.spoken, '😀맨 먼스 x 엠');
    assert.deepEqual(r.subs, [
      { display: [1, 4], spoken: [1, 5] },
      { display: [7, 8], spoken: [8, 9] },
    ]);
  });

  test('longest key wins at a position regardless of entry order', () => {
    const entries = [{ display: 'M', spoken: '엠' }, MM, { display: 'M/M/M', spoken: '삼엠' }];
    for (const list of [entries, [...entries].reverse()]) {
      const r = applyPronounce('M/M/M and M/M and M', list);
      assert.equal(r.spoken, '삼엠 and 맨 먼스 and 엠');
    }
  });

  test('left to right and non-overlapping: the leftmost match consumes the shared character', () => {
    const entries = [{ display: 'bc', spoken: 'X' }, { display: 'ab', spoken: 'Y' }];
    const r = applyPronounce('abc', entries);
    assert.equal(r.spoken, 'Yc');
    assert.deepEqual(r.subs, [{ display: [0, 2], spoken: [0, 1] }]);
  });

  test('case-sensitive exact match', () => {
    const r = applyPronounce('m/m M/m M/M', [MM]);
    assert.equal(r.spoken, 'm/m M/m 맨 먼스');
    assert.equal(r.subs.length, 1);
  });

  test('repeated occurrences are all replaced', () => {
    const r = applyPronounce('M/M M/M', [MM]);
    assert.equal(r.spoken, '맨 먼스 맨 먼스');
    assert.deepEqual(r.subs.map((s) => s.display), [[0, 3], [4, 7]]);
    assert.deepEqual(r.subs.map((s) => s.spoken), [[0, 4], [5, 9]]);
  });
});

describe('mergeDicts', () => {
  test('later dict wins for the same display key', () => {
    const common = { entries: [{ display: 'M/M', spoken: '공용' }, { display: 'KB', spoken: '킬로바이트' }] };
    const job = { entries: [{ display: 'M/M', spoken: '편별' }] };
    const merged = mergeDicts([common, job]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((e) => e.display === 'M/M').spoken, '편별');
    assert.equal(merged.find((e) => e.display === 'KB').spoken, '킬로바이트');
    assert.equal(mergeDicts([job, common]).find((e) => e.display === 'M/M').spoken, '공용');
  });

  test('empty input', () => {
    assert.deepEqual(mergeDicts([]), []);
    assert.deepEqual(mergeDicts([{ entries: [] }]), []);
  });
});

describe('splitSentence', () => {
  test('cuts after punctuation, runs of punctuation stay together ("다시?!")', () => {
    const d = '다시?! 정말요? 네.';
    const r = split(d, [], 14);
    assert.deepEqual(r.ranges, [[0, 4], [5, 9], [10, 12]]);
    assert.deepEqual(r.ranges.map(([a, b]) => cp(d).slice(a, b).join('')), ['다시?!', '정말요?', '네.']);
  });

  test('basic comma and period cuts', () => {
    assert.deepEqual(split('a, b. c', [], 32).ranges, [[0, 2], [3, 5], [6, 7]]);
  });

  test('no cut between digits: 1,200 and 3.14', () => {
    assert.deepEqual(split('1,200 3.14', [], 32).ranges, [[0, 10]]);
    assert.deepEqual(split('값은 1,200원, 3.14예요', [], 32).ranges, [[0, 10], [11, 17]]);
  });

  test('a punctuation mark after a digit but not before one still cuts', () => {
    assert.deepEqual(split('총 3, 4개', [], 32).ranges, [[0, 4], [5, 7]]);
  });

  test('no cut inside a substitution', () => {
    const dict = [{ display: 'Hi, Bob', spoken: '하이 밥' }];
    assert.deepEqual(split('Hi, Bob is here', [], 32).ranges, [[0, 3], [4, 15]]);
    assert.deepEqual(split('Hi, Bob is here', dict, 32).ranges, [[0, 15]]);
  });

  test('greedy whitespace fill when a punctuation piece is over max', () => {
    const r = split('aaa bbb ccc ddd eee', [], 7);
    assert.deepEqual(r.ranges, [[0, 7], [8, 15], [16, 19]]);
  });

  test('a piece at exactly max graphemes is kept whole', () => {
    assert.deepEqual(split('aaa bbb', [], 7).ranges, [[0, 7]]);
    assert.deepEqual(split('aaa bbb', [], 6).ranges, [[0, 3], [4, 7]]);
  });

  test('a substitution spanning a space is never split', () => {
    const d = 'watch YouTube Shorts today now';
    const dict = [{ display: 'YouTube Shorts', spoken: '유튜브 쇼츠' }];
    const r = split(d, dict, 14);
    assert.deepEqual(r.ranges, [[0, 5], [6, 20], [21, 30]]);
    // sanity: without the substitution the same input is cut inside "YouTube Shorts"
    assert.notDeepEqual(split(d, [], 10).ranges.find(([a, b]) => a >= 6 && b <= 20), undefined);
    for (const [a, b] of r.ranges) assert.ok(!(a > 6 && a < 20) && !(b > 6 && b < 20));
  });

  test('ranges are code points, so an emoji before a split point does not shift them', () => {
    assert.deepEqual(split('😀 aaa bbb', [], 5).ranges, [[0, 5], [6, 9]]);
  });

  test('unsplittable token returns { error } and no ranges', () => {
    const r = split('aaaaaaaaaaaaaaaaaaaa b', [], 10);
    assert.match(r.error, /exceeds 10 graphemes and cannot be split/);
    assert.ok(r.error.includes('aaaaaaaaaaaaaaaaaaaa'));
    assert.equal(r.ranges, undefined);
  });

  test('a substitution over max that cannot be split returns { error }', () => {
    const r = split('YouTube Shorts', [{ display: 'YouTube Shorts', spoken: '유튜브 쇼츠' }], 10);
    assert.match(r.error, /cannot be split/);
  });

  test('graphemes, not code units, are counted (combining sequences)', () => {
    // "e" + U+0301 is one grapheme; 3 graphemes fit in max 3
    assert.deepEqual(split('ééé', [], 3).ranges, [[0, 6]]);
  });
});

describe('buildPhrasing on jobs/mm-calc/ko', () => {
  const script = readJson('jobs/mm-calc/ko/script.json');
  const dict = readJson('jobs/mm-calc/ko/pronounce.json');
  const build = (s = script) => buildPhrasing(s, [dict], LANGS.ko, 'ko');
  const r = build();

  const SPOKEN = [
    '맨 먼스 계산법, 아직도 헷갈리나요?',
    '단가는 천이백 원입니다.',
    '세 명이 두 달 일하면 여섯 맨 먼스예요.',
    '생각보다 훨씬 간단합니다.',
    '먼저 투입 인원을 확인하세요.',
    '기간은 반드시 월 단위로 바꿔야 해요.',
    '예를 들어 열흘은 영 점 삼삼 개월입니다.',
    '유튜브 쇼츠와 인스타그램 릴스 모두 같은 방식이에요.',
    '숫자가 커져도 원리는 같습니다.',
    '오늘 내용, 저장해 두고 필요할 때 꺼내 보세요.',
  ];

  test('no errors or warnings, 20 phrases', () => {
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.phrases.length, 20);
  });

  test('pinned phrase IDs', () => {
    const ids = r.phrases.map((p) => p.id);
    for (const id of ['s01-8964f159', 's02-d69a5ce4', 's07-71932f42']) assert.ok(ids.includes(id), id);
    assert.equal(r.phrases[0].id, 's01-8964f159');
    assert.equal(r.phrases[2].id, 's02-d69a5ce4');
    assert.equal(r.phrases[11].id, 's07-71932f42');
    assert.equal(new Set(ids).size, 20);
    for (const p of r.phrases) assert.match(p.id, new RegExp(`^${p.sentenceId}-[0-9a-f]{8}$`));
  });

  test('every scene startPhrase / atPhrase in scenes.json exists', () => {
    const ids = new Set(r.phrases.map((p) => p.id));
    const refs = [];
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) { if (k === 'atPhrase') refs.push(x); else walk(x); }
      }
    };
    for (const s of readJson('jobs/mm-calc/ko/scenes.json').scenes) { refs.push(s.startPhrase); walk(s.props); }
    assert.ok(refs.length >= 9);
    for (const id of refs) assert.ok(ids.has(id), id);
  });

  test('spokenText equals the ten spoken lines', () => {
    assert.deepEqual(r.spokenLines, SPOKEN);
    assert.equal(r.spokenText, SPOKEN.join('\n'));
    assert.equal(r.spokenSha256, sha(SPOKEN.join('\n')));
  });

  test('spoken ranges map through substitutions (s01: [0,8] -> [0,9])', () => {
    const p = r.phrases[0];
    assert.equal(p.display, 'M/M 계산법,');
    assert.equal(p.spoken, '맨 먼스 계산법,');
    assert.deepEqual(p.displayRange, [0, 8]);
    assert.deepEqual(p.spokenRange, [0, 9]);
    const q = r.phrases[1];
    assert.equal(q.display, '아직도 헷갈리나요?');
    assert.deepEqual(q.displayRange, [9, 19]);
    assert.deepEqual(q.spokenRange, [10, 20]);
  });

  test('every phrase range slices the display/spoken line to the phrase text', () => {
    const lineOf = new Map(script.sentences.map((s, i) => [s.id, { display: s.display, spoken: SPOKEN[i] }]));
    for (const p of r.phrases) {
      const l = lineOf.get(p.sentenceId);
      assert.equal(cp(l.display).slice(...p.displayRange).join(''), p.display, p.id);
      assert.equal(cp(l.spoken).slice(...p.spokenRange).join(''), p.spoken, p.id);
    }
  });

  test('substituted phrases: s02 and s07', () => {
    const s02 = r.phrases.find((p) => p.id === 's02-d69a5ce4');
    assert.equal(s02.display, '단가는 1,200원입니다.');
    assert.equal(s02.spoken, '단가는 천이백 원입니다.');
    assert.deepEqual(s02.spokenRange, [0, 13]);
    const s07 = r.phrases.find((p) => p.id === 's07-71932f42');
    assert.equal(s07.display, '0.33개월입니다.');
    assert.equal(s07.spoken, '영 점 삼삼 개월입니다.');
    assert.deepEqual(s07.displayRange, [10, 20]);
    assert.deepEqual(s07.spokenRange, [10, 23]);
  });

  test('ttsText prefixes tags as "[tag] " and leaves other lines bare', () => {
    const lines = r.ttsText.split('\n');
    assert.equal(lines.length, 10);
    assert.equal(lines[0], `[curious, friendly] ${SPOKEN[0]}`);
    assert.equal(lines[3], `[excited] ${SPOKEN[3]}`);
    assert.equal(lines[8], `[calm] ${SPOKEN[8]}`);
    for (const i of [1, 2, 4, 5, 6, 7, 9]) assert.equal(lines[i], SPOKEN[i]);
  });

  test('phrasingSha256 is stable for equal input and changes when one display changes', () => {
    assert.equal(build(structuredClone(script)).phrasingSha256, r.phrasingSha256);
    assert.match(r.phrasingSha256, /^[0-9a-f]{64}$/);
    const edited = structuredClone(script);
    edited.sentences[3].display = '생각보다 훨씬 쉽습니다.';
    assert.notEqual(build(edited).phrasingSha256, r.phrasingSha256);
  });

  test('spokenSha256 ignores tags; ttsText does not', () => {
    const noTags = structuredClone(script);
    for (const s of noTags.sentences) delete s.tag;
    const b = build(noTags);
    assert.equal(b.spokenSha256, r.spokenSha256);
    assert.equal(b.phrasingSha256, r.phrasingSha256);
    assert.notEqual(b.ttsText, r.ttsText);
    assert.equal(b.ttsText, b.spokenText);
  });

  test('a display edit that leaves spoken unchanged moves phrasingSha256 only', () => {
    const base = { sentences: [{ id: 's01', display: '안녕하세요', spoken: '안녕하세요' }] };
    const edited = { sentences: [{ id: 's01', display: '안녕하세요!', spoken: '안녕하세요' }] };
    const a = buildPhrasing(base, [], LANGS.ko, 'ko');
    const b = buildPhrasing(edited, [], LANGS.ko, 'ko');
    assert.equal(a.spokenSha256, b.spokenSha256);
    assert.notEqual(a.phrasingSha256, b.phrasingSha256);
  });
});

describe('buildPhrasing: spoken override', () => {
  const run = (sentences, alias = 'ko', lang = LANGS.ko) => buildPhrasing({ sentences }, [], lang, alias);

  test('display over maxCaptionGraphemes with spoken override -> spoken-override-too-long', () => {
    const display = '이 문장은 열네 글자를 훌쩍 넘어갑니다';
    assert.ok([...display].length > LANGS.ko.maxCaptionGraphemes);
    const r = run([{ id: 's01', display, spoken: '짧게 읽기' }]);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].code, 'spoken-override-too-long');
    assert.equal(r.errors[0].sentenceId, 's01');
    assert.deepEqual(r.phrases, []);
  });

  test('exactly maxCaptionGraphemes still fits', () => {
    const display = '가'.repeat(LANGS.ko.maxCaptionGraphemes);
    const r = run([{ id: 's01', display, spoken: '가나다' }]);
    assert.deepEqual(r.errors, []);
    assert.equal(r.phrases.length, 1);
  });

  test('a fitting override yields one phrase with spokenRange [0, len(spoken)]', () => {
    const spoken = '짧은 문장이에요 😀';
    const r = run([{ id: 's01', display: '짧은 문장!', spoken }]);
    assert.deepEqual(r.errors, []);
    assert.equal(r.phrases.length, 1);
    const p = r.phrases[0];
    assert.equal(p.display, '짧은 문장!');
    assert.equal(p.spoken, spoken);
    assert.deepEqual(p.displayRange, [0, 6]);
    assert.deepEqual(p.spokenRange, [0, [...spoken].length]);
    assert.equal(r.spokenText, spoken);
  });

  test('override ignores the pronunciation dictionary', () => {
    const r = buildPhrasing({ sentences: [{ id: 's01', display: 'M/M', spoken: 'em em' }] },
      [{ entries: [{ display: 'M/M', spoken: '맨 먼스' }] }], LANGS.ko, 'ko');
    assert.equal(r.phrases[0].spoken, 'em em');
  });
});

describe('buildPhrasing: warnings and errors', () => {
  const run = (sentences, alias, lang) => buildPhrasing({ sentences }, [], lang, alias);

  test('digits left in Korean spoken text -> spoken-digits warning', () => {
    const r = run([{ id: 's01', display: '3명이 왔어요.' }], 'ko', LANGS.ko);
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].code, 'spoken-digits');
    assert.equal(r.warnings[0].sentenceId, 's01');
    assert.deepEqual(r.errors, []);
    assert.equal(r.phrases.length, 1);
  });

  test('digits in English spoken text -> no warning', () => {
    const r = run([{ id: 's01', display: 'We have 3 apples.' }], 'en', LANGS.en);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.errors, []);
  });

  test('digits consumed by a substitution do not warn', () => {
    const r = buildPhrasing({ sentences: [{ id: 's01', display: '3명이 왔어요.' }] },
      [{ entries: [{ display: '3명', spoken: '세 명' }] }], LANGS.ko, 'ko');
    assert.deepEqual(r.warnings, []);
  });

  test('unsplittable sentence -> error, and the sentence is dropped from the outputs', () => {
    const r = run([
      { id: 's01', display: '가'.repeat(30) },
      { id: 's02', display: '괜찮아요.' },
    ], 'ko', LANGS.ko);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].code, 'unsplittable');
    assert.equal(r.errors[0].sentenceId, 's01');
    assert.deepEqual(r.phrases.map((p) => p.sentenceId), ['s02']);
    assert.deepEqual(r.spokenLines, ['괜찮아요.']);
  });

  test('English uses its own maxCaptionGraphemes (32)', () => {
    const r = run([{ id: 's01', display: 'This sentence is definitely longer than thirty-two graphemes.' }], 'en', LANGS.en);
    assert.deepEqual(r.errors, []);
    assert.ok(r.phrases.length >= 2);
    for (const p of r.phrases) assert.ok([...p.display].length <= 32, p.display);
  });
});

describe('phrase IDs inside one sentence', () => {
  test('equal displays get -2, -3 and are not reported as a collision', () => {
    const r = buildPhrasing({ sentences: [{ id: 's01', display: '네! 네! 네!' }] }, [], LANGS.ko, 'ko');
    assert.deepEqual(r.errors, []);
    assert.equal(r.phrases.length, 3);
    const [a, b, c] = r.phrases.map((p) => p.id);
    assert.match(a, /^s01-[0-9a-f]{8}$/);
    assert.equal(b, `${a}-2`);
    assert.equal(c, `${a}-3`);
    assert.deepEqual(r.phrases.map((p) => p.display), ['네!', '네!', '네!']);
  });

  test('the same display in two different sentences keeps distinct IDs via the sentence prefix', () => {
    const r = buildPhrasing({ sentences: [{ id: 's01', display: '네!' }, { id: 's02', display: '네!' }] }, [], LANGS.ko, 'ko');
    assert.deepEqual(r.errors, []);
    const [a, b] = r.phrases.map((p) => p.id);
    assert.notEqual(a, b);
    assert.equal(a.slice(4), b.slice(4));
  });
});

describe('closing marks after a cut stay with their piece', () => {
  test('quotes and brackets', () => {
    assert.deepEqual(splitSentence('안녕. "네." 그래', [], 32).ranges, [[0, 3], [4, 8], [9, 11]]);
    assert.deepEqual(splitSentence('Hi (ok.) yes', [], 32).ranges, [[0, 8], [9, 12]]);
  });
});
