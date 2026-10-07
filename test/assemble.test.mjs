// timeline -> HyperFrames project (design §5.1, §5.3). Writes into a temp dir.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assemble, scriptJson } from '../scripts/assemble.mjs';
import { framesToSecondsAttrs } from '../scripts/lib/frames.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'sm-assemble-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

// 44-byte PCM WAV header, 24 kHz mono 16-bit, no samples.
function fakeWav() {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(0, 40);
  return b;
}
const WAV = fakeWav();
const audioPath = join(tmp, 'in.wav');
writeFileSync(audioPath, WAV);

let n = 0;
const dir = () => join(tmp, `out-${n++}`);
const read = (d, p) => readFileSync(join(d, p), 'utf8');

const scene = (id, type, clipStart, clipEnd, transitionIn, props = {}) => ({ id, type, clipStart, clipEnd, transitionIn, props, motion: null });
const timeline = (over = {}) => ({
  schemaVersion: '2.0.0', jobId: 'job', lang: 'ko-KR', fps: 30, totalFrames: 136,
  theme: { id: 'base', accent: 'blue' },
  captions: {
    enabled: true, style: 'phrase-bottom',
    items: [
      { id: 'c1', text: '첫 자막', startFrame: 0, endFrame: 38 },
      { id: 'c2', text: '둘째 자막', startFrame: 38, endFrame: 100 },
    ],
  },
  scenes: [
    scene('hook', 'hook', 0, 38, { id: 'cut' }, { headline: 'H', sub: 'S' }),
    scene('price', 'keyword', 26, 67, { id: 'crossfade', durationFrames: 12 }, { text: '1,200원' }),
    scene('how', 'steps', 54, 100, { id: 'cut' }, { title: 'T', items: [{ text: 'a', atFrame: 0 }] }),
    scene('outro', 'hook', 94, 136, { id: 'crossfade', durationFrames: 13 }, { headline: 'bye' }),
  ],
  ...over,
});

const build = (tl = timeline(), langAlias = 'ko') => {
  const outDir = dir();
  assemble(tl, { langAlias, audioPath, outDir });
  return outDir;
};

// The JS string literal passed to JSON.parse(...) in generated HTML.
const LITERAL = /JSON\.parse\(("(?:[^"\\]|\\.)*")\)/g;
const literals = (html) => [...html.matchAll(LITERAL)].map((m) => m[1]);
const evalLiteral = (lit) => JSON.parse(vm.runInNewContext(lit));

describe('files', () => {
  const out = build();

  test('index.html, one composition per scene, captions, assets, vendor', () => {
    for (const p of [
      'index.html',
      'compositions/scene-hook.html', 'compositions/scene-price.html',
      'compositions/scene-how.html', 'compositions/scene-outro.html',
      'compositions/captions.html',
      'assets/narration.wav',
      'assets/fonts/noto-sans-kr.woff2', 'assets/fonts/inter.woff2',
      'vendor/gsap.min.js',
    ]) assert.ok(existsSync(join(out, p)), p);
  });

  test('narration, fonts and gsap are byte copies', () => {
    assert.deepEqual(readFileSync(join(out, 'assets/narration.wav')), WAV);
    for (const f of ['noto-sans-kr.woff2', 'inter.woff2']) {
      assert.deepEqual(readFileSync(join(out, 'assets/fonts', f)), readFileSync(join(ROOT, 'templates/fonts', f)));
    }
    assert.deepEqual(readFileSync(join(out, 'vendor/gsap.min.js')), readFileSync(join(ROOT, 'templates/_base/vendor/gsap.min.js')));
  });

  test('each scene file comes from its type template with the instance id applied', () => {
    const h = read(out, 'compositions/scene-hook.html');
    assert.ok(h.includes('data-composition-id="scene-hook"'));
    assert.ok(h.includes('id="scene-hook-headline"'));
    const s = read(out, 'compositions/scene-how.html');
    assert.ok(s.includes('data-composition-id="scene-how"'));
    assert.ok(s.includes('t-steps'));
    assert.ok(read(out, 'compositions/scene-price.html').includes('t-keyword'));
  });

  test('no __PLACEHOLDER__ tokens remain in any written HTML', () => {
    for (const p of ['index.html', 'compositions/scene-hook.html', 'compositions/scene-price.html',
      'compositions/scene-how.html', 'compositions/scene-outro.html', 'compositions/captions.html']) {
      const html = read(out, p);
      assert.deepEqual(html.match(/__[A-Z_]+__/g), null, p);
      for (const tok of ['__ID__', '__PROPS__', '__ITEMS__', '__HOSTS__', '__ROOT_DATA__', '__LANG__', '__LANG_ALIAS__', '__ACCENT__', '__DURATION__']) {
        assert.ok(!html.includes(tok), `${p} still has ${tok}`);
      }
    }
  });

  test('root carries lang, accent and the narration element', () => {
    const html = read(out, 'index.html');
    assert.ok(html.includes('<html lang="ko-KR">'));
    assert.ok(html.includes('class="lang-ko accent-blue"'));
    assert.ok(html.includes('<audio id="narration" src="assets/narration.wav"'));
  });

  test('en alias', () => {
    const o = build(timeline({ lang: 'en-US' }), 'en');
    const html = read(o, 'index.html');
    assert.ok(html.includes('lang="en-US"'));
    assert.ok(html.includes('lang-en'));
  });
});

describe('timing attributes', () => {
  const tl = timeline();
  const out = build(tl);
  const html = read(out, 'index.html');
  const host = (id) => {
    const m = html.match(new RegExp(`<div id="${id}"[^>]*?data-start="([^"]+)" data-duration="([^"]+)"`));
    assert.ok(m, `host ${id}`);
    return { start: m[1], duration: m[2] };
  };

  test('host data-start / data-duration equal framesToSecondsAttrs(clipStart, clipEnd)', () => {
    for (const s of tl.scenes) {
      assert.deepEqual(host(`scene-${s.id}-host`), framesToSecondsAttrs(s.clipStart, s.clipEnd), s.id);
    }
  });

  test('one host per scene in order with track index and z-index, plus the captions host', () => {
    const ids = [...html.matchAll(/<div id="([a-z-]+-host)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, ['scene-hook-host', 'scene-price-host', 'scene-how-host', 'scene-outro-host', 'captions-host']);
    assert.ok(html.includes('data-composition-src="compositions/scene-price.html"'));
    assert.match(html, /id="scene-how-host"[^>]*data-track-index="3"[^>]*style="z-index: 3"/);
    assert.match(html, /id="captions-host"[^>]*data-track-index="5"[^>]*style="z-index: 5"/);
    assert.deepEqual(host('captions-host'), framesToSecondsAttrs(0, tl.totalFrames));
  });

  test('root data-duration is floor-µs of totalFrames / 30 with 6 decimals', () => {
    const expected = (frames) => {
      const us = (BigInt(frames) * 1000000n) / 30n;
      return `${us / 1000000n}.${(us % 1000000n).toString().padStart(6, '0')}`;
    };
    for (const frames of [136, 100, 30, 1, 31, 2700]) {
      const o = build(timeline({ totalFrames: frames }));
      const m = read(o, 'index.html').match(/data-composition-id="root"[\s\S]*?data-duration="([^"]+)"/);
      assert.equal(m[1], expected(frames), `${frames} frames`);
    }
    assert.equal(expected(136), '4.533333');
    const m = html.match(/data-composition-id="root"[\s\S]*?data-duration="([^"]+)"/);
    assert.equal(m[1], '4.533333');
  });
});

describe('crossfade list in the root literal', () => {
  test('contains { hostId, startFrame: clipStart, durationFrames } only for crossfade scenes', () => {
    const out = build();
    const lits = literals(read(out, 'index.html'));
    assert.equal(lits.length, 1);
    assert.deepEqual(evalLiteral(lits[0]), {
      fps: 30,
      crossfades: [
        { hostId: 'scene-price-host', startFrame: 26, durationFrames: 12 },
        { hostId: 'scene-outro-host', startFrame: 94, durationFrames: 13 },
      ],
    });
  });

  test('no crossfades -> empty list', () => {
    const tl = timeline();
    for (const s of tl.scenes) s.transitionIn = { id: 'cut' };
    const lits = literals(read(build(tl), 'index.html'));
    assert.deepEqual(evalLiteral(lits[0]), { fps: 30, crossfades: [] });
  });
});

describe('scriptJson round trip', () => {
  const nasty = {
    closer: '</script><script>alert(1)</script>',
    upper: '</SCRIPT >',
    comment: '<!-- x --> <![CDATA[ y ]]>',
    quotes: 'He said "hi" and \'yo\' and `tick`',
    amp: 'a & b &amp; &lt;',
    ls: 'before after',
    ps: 'before after',
    backslash: 'a\\b \\u003c \\"',
    newline: 'a\nb\r\nc\t',
    emoji: '😀 한글 é',
    nested: [{ t: '</script>' }, ['>', '<']],
    num: 3.5,
    nul: null,
    bool: false,
  };

  test('scriptJson output has no raw <, >, &, U+2028, U+2029 and evaluates back to the original', () => {
    const lit = scriptJson(nasty);
    for (const ch of ['<', '>', '&', ' ', ' ']) assert.ok(!lit.includes(ch), JSON.stringify(ch));
    assert.deepEqual(JSON.parse(vm.runInNewContext(lit)), nasty);
    assert.deepEqual(JSON.parse(eval(lit)), nasty); // eslint-disable-line no-eval
  });

  test('generated scene HTML: only real closing tags, props survive the round trip', () => {
    const tl = timeline({ scenes: [scene('evil', 'keyword', 0, 136, { id: 'cut' }, nasty)] });
    const out = build(tl);
    const html = read(out, 'compositions/scene-evil.html');
    const opens = (html.match(/<script\b/gi) ?? []).length;
    const closes = (html.match(/<\/script>/gi) ?? []).length;
    assert.ok(opens >= 1);
    assert.equal(closes, opens);
    assert.ok(!html.includes(' ') && !html.includes(' '));
    assert.ok(!html.includes('alert(1)</script>'));
    const lits = literals(html);
    assert.equal(lits.length, 1);
    assert.deepEqual(evalLiteral(lits[0]), nasty);
  });

  test('root HTML keeps balanced script tags too', () => {
    const html = read(build(), 'index.html');
    assert.equal((html.match(/<script\b/gi) ?? []).length, (html.match(/<\/script>/gi) ?? []).length);
  });

  test('placeholder-looking user text is inserted verbatim, not substituted', () => {
    const props = { text: '__ID__ __PROPS__ $& $1' };
    const tl = timeline({ scenes: [scene('lit', 'keyword', 0, 136, { id: 'cut' }, props)] });
    const html = read(build(tl), 'compositions/scene-lit.html');
    assert.deepEqual(evalLiteral(literals(html)[0]), props);
    const tl2 = timeline({ captions: { enabled: true, style: 'phrase-bottom', items: [{ id: 'c1', text: 'a $& __ID__ b', startFrame: 0, endFrame: 10 }] } });
    assert.ok(read(build(tl2), 'compositions/captions.html').includes('a $&amp; __ID__ b'));
  });
});

describe('captions', () => {
  test('caption text is HTML-escaped in captions.html', () => {
    const text = '<b>"A" & \'B\'</b> <img src=x onerror=alert(1)>';
    const tl = timeline({ captions: { enabled: true, style: 'phrase-bottom', items: [{ id: 'c1', text, startFrame: 0, endFrame: 30 }] } });
    const html = read(build(tl), 'compositions/captions.html');
    assert.ok(html.includes('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt; &lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<b>'));
    assert.ok(!html.includes('<img'));
  });

  test('items have ids, timing attributes and the caption class', () => {
    const tl = timeline();
    const html = read(build(tl), 'compositions/captions.html');
    for (const [i, c] of tl.captions.items.entries()) {
      const t = framesToSecondsAttrs(c.startFrame, c.endFrame);
      assert.ok(html.includes(`<div id="captions-${i}" class="clip t-cap" data-start="${t.start}" data-duration="${t.duration}" data-track-index="0">`), `item ${i}`);
      assert.ok(html.includes(`<div class="t-cap-text">${c.text}</div>`));
    }
    assert.ok(html.includes('data-composition-id="captions"'));
  });

  test('captions.enabled false -> no captions file and no captions host', () => {
    const out = build(timeline({ captions: { enabled: false, style: 'phrase-bottom', items: [] } }));
    assert.ok(!existsSync(join(out, 'compositions/captions.html')));
    assert.ok(!read(out, 'index.html').includes('captions-host'));
  });
});

describe('instance ids', () => {
  const withId = (id) => timeline({ scenes: [scene(id, 'keyword', 0, 136, { id: 'cut' })] });

  test('scene id producing an invalid instance id throws', () => {
    for (const id of ['Bad', 'a_b', 'a b', 'a.b', 'a/b', '../x', 'ü']) {
      assert.throws(() => build(withId(id)), /bad instance id/, JSON.stringify(id));
    }
  });

  test('instance id is limited to 48 chars including the "scene-" prefix', () => {
    assert.doesNotThrow(() => build(withId('x'.repeat(42))));
    assert.throws(() => build(withId('x'.repeat(43))), /bad instance id/);
  });

  test('digits, lowercase and hyphens are fine', () => {
    assert.doesNotThrow(() => build(withId('s03-steps')));
    assert.doesNotThrow(() => build(withId('0')));
  });

  test('a bad id writes no composition file for it', () => {
    const d = dir();
    assert.throws(() => assemble(withId('Bad'), { langAlias: 'ko', audioPath, outDir: d }));
    assert.ok(!existsSync(join(d, 'compositions/scene-Bad.html')));
    assert.ok(!existsSync(join(d, 'index.html')));
  });
});
