// Engine contract checks that need Chrome (design §9, §11 S1). Run on the render machine.
//   node scripts/engine-check.mjs boundaries            synthetic project: clip boundaries, nested clips, crossfade
//   node scripts/engine-check.mjs determinism --run <dir>  same frames seeked forward, reverse, shuffled
//   node scripts/engine-check.mjs serialization --run <dir> </script>, quotes, &, U+2028 in props and captions
import { writeFileSync, mkdirSync, readdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { sha256Hex } from './lib/canon.mjs';
import { FPS, framesToSecondsAttrs } from './lib/frames.mjs';
import * as hf from './render.mjs';
import { assemble } from './assemble.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');

// Scene segments [start, end) cover frame%3 = 0/1/2 boundaries, odd and even lengths, and a 1-frame clip.
const SEGMENTS = [[0, 10], [10, 21], [21, 35], [35, 36], [36, 50], [50, 61], [61, 90]];
const COLORS = ['ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff', 'ffffff'];
// Nested clips inside one sub-composition (like captions): sampled at the top-left box.
const NESTED = [[3, 8], [8, 20], [33, 34], [40, 61]];
// Crossfade over [70, 82): the last scene fades in above a black host that ends at 82.
const XF = { start: 70, end: 82 };
const TOTAL = 90;

function boundaryProject(dir) {
  mkdirSync(join(dir, 'compositions'), { recursive: true });
  mkdirSync(join(dir, 'vendor'), { recursive: true });
  copyFileSync(join(ROOT, 'templates/_base/vendor/gsap.min.js'), join(dir, 'vendor/gsap.min.js'));
  const sub = (id, body) => `<template><style>#${id}{position:absolute;inset:0}</style>
<div id="${id}" data-composition-id="${id}" data-width="1080" data-height="1920">${body}</div>
<script>window.__timelines["${id}"] = gsap.timeline({ paused: true });</script></template>\n`;
  const hosts = [];
  const host = (id, s, e, z) => {
    const t = framesToSecondsAttrs(s, e);
    hosts.push(`<div id="${id}-host" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${t.start}" data-duration="${t.duration}" data-width="1080" data-height="1920" style="z-index:${z}"></div>`);
  };
  // Black base under the crossfade: [61, 82).
  writeFileSync(join(dir, 'compositions/base.html'), sub('base', '<div style="position:absolute;inset:0;background:#000"></div>'));
  host('base', 61, XF.end, 1);
  SEGMENTS.forEach(([s, e], i) => {
    const id = `seg${i}`;
    writeFileSync(join(dir, `compositions/${id}.html`), sub(id, `<div style="position:absolute;inset:0;background:#${COLORS[i]}"></div>`));
    const last = i === SEGMENTS.length - 1;
    host(id, last ? XF.start : s, e, i + 2);
  });
  const nested = NESTED.map(([s, e], i) => {
    const t = framesToSecondsAttrs(s, e);
    return `<div id="n${i}" class="clip" data-start="${t.start}" data-duration="${t.duration}" style="position:absolute;left:0;top:0;width:200px;height:200px;background:#${i % 2 ? 'ff8000' : '8000ff'}"></div>`;
  }).join('');
  writeFileSync(join(dir, 'compositions/nested.html'), sub('nested', nested));
  host('nested', 0, TOTAL, 50);
  const xf = framesToSecondsAttrs(XF.start, XF.end);
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><script src="vendor/gsap.min.js"></script>
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}#root{position:relative;width:100%;height:100%;overflow:hidden}</style></head>
<body><div id="root" data-composition-id="root" data-width="1080" data-height="1920" data-duration="${(TOTAL / FPS).toFixed(6)}" data-fps="30">
${hosts.join('\n')}
</div><script>const tl = gsap.timeline({ paused: true });
tl.fromTo("#seg6-host", { opacity: 0 }, { opacity: 1, duration: ${XF.end - XF.start} / 30, ease: "none" }, ${xf.start});
window.__timelines["root"] = tl;</script></body></html>\n`);
}

// Pixel at (x, y) of every frame of a PNG sequence, in frame order.
function pixels(seqDir, x, y) {
  const files = readdirSync(seqDir).filter((f) => f.endsWith('.png')).sort();
  return files.map((f) => {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', join(seqDir, f), '-vf', `crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1024 });
    return r.stdout.toString('hex');
  });
}

function cmdBoundaries() {
  const dir = join(ROOT, 'out/engine-check', `boundaries-${stamp()}`);
  const project = join(dir, 'project');
  boundaryProject(project);
  const seq = join(dir, 'frames');
  const r = spawnSync(join(ROOT, 'node_modules/.bin/hyperframes'), ['render', '--format', 'png-sequence', '-f', '30', '--no-browser-gpu', '--quiet', '-o', seq],
    { cwd: project, encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', GEMINI_API_KEY: '' } });
  if (r.status !== 0) throw new Error(`render failed\n${r.stderr.slice(-2000)}`);
  const center = pixels(seq, 540, 960);
  const corner = pixels(seq, 10, 10);
  const fails = [];
  if (center.length !== TOTAL) fails.push(`frame count ${center.length} != ${TOTAL}`);
  // Frames before the last segment show the segment colours; from 61 the black base until the fade starts.
  for (let f = 0; f < Math.min(center.length, XF.start); f++) {
    const i = SEGMENTS.findIndex(([s, e]) => s <= f && f < e);
    const want = i === SEGMENTS.length - 1 ? '000000' : COLORS[i];
    if (center[f] !== want) fails.push(`frame ${f}: center ${center[f]} expected ${want}`);
  }
  for (let f = 0; f < corner.length; f++) {
    const i = NESTED.findIndex(([s, e]) => s <= f && f < e);
    if (i >= 0 && corner[f] !== (i % 2 ? 'ff8000' : '8000ff')) fails.push(`frame ${f}: nested ${corner[f]} expected clip ${i}`);
    if (i < 0 && ['ff8000', '8000ff'].includes(corner[f])) fails.push(`frame ${f}: nested clip visible outside its window`);
  }
  // Crossfade: first frame fully the outgoing (black) base, last frames fully white, monotone in between.
  const gray = (h) => parseInt(h.slice(0, 2), 16);
  if (center[XF.start] !== '000000') fails.push(`crossfade start ${center[XF.start]} != 000000`);
  if (center[XF.end] !== 'ffffff') fails.push(`crossfade end ${center[XF.end]} != ffffff`);
  for (let f = XF.start + 1; f <= XF.end; f++) if (gray(center[f]) < gray(center[f - 1])) fails.push(`crossfade not monotone at ${f}`);
  const report = { project, frames: center.length, segments: SEGMENTS, nested: NESTED, crossfade: XF, fails };
  writeFileSync(join(dir, 'report.json'), `${JSON.stringify({ ...report, center, corner }, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (fails.length) process.exit(1);
}

const rgb = (png) => spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64 * 1024 * 1024 }).stdout;
function maxChannelDelta(a, b) {
  if (a.length !== b.length) return 255;
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

// Seeded shuffle (LCG) so the "random" order is reproducible.
function shuffled(xs, seed = 12345) {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cmdDeterminism({ run }) {
  const runDir = resolvePath(run);
  const tl = JSON.parse(readFileSync(join(runDir, 'timeline.json'), 'utf8'));
  const set = new Set([0, tl.totalFrames - 1]);
  for (const s of tl.scenes) for (const f of [s.clipStart - 1, s.clipStart, s.nominalStart - 1, s.nominalStart, s.nominalStart + 1, s.clipEnd - 1, s.clipEnd]) set.add(f);
  for (const c of tl.captions.items) for (const f of [c.startFrame - 1, c.startFrame, c.endFrame - 1, c.endFrame]) set.add(f);
  const frames = [...set].filter((f) => f >= 0 && f < tl.totalFrames).sort((a, b) => a - b);
  const orders = { forward: frames, reverse: [...frames].reverse(), shuffled: shuffled(frames) };
  const hashes = {};
  for (const [name, order] of Object.entries(orders)) {
    const out = join(runDir, 'determinism', name);
    hf.snapshot(join(runDir, 'project'), order.map((f) => (f / FPS).toFixed(6)), out);
    const files = readdirSync(out).filter((f) => /^frame-\d+-at-.*\.png$/.test(f)).sort();
    if (files.length !== order.length) throw new Error(`${name}: ${files.length} PNGs for ${order.length} frames`);
    // Files are numbered in the order given.
    hashes[name] = Object.fromEntries(files.map((f, i) => [order[i], sha256Hex(readFileSync(join(out, f)))]));
  }
  // Chrome's compositor can differ by 1 LSB around regions whose layers changed on the previous
  // seek (seen next to caption boundaries). A frame passes when every channel differs by <= 2.
  const files = Object.fromEntries(Object.keys(orders).map((name) => {
    const out = join(runDir, 'determinism', name);
    const list = readdirSync(out).filter((f) => /^frame-\d+-at-.*\.png$/.test(f)).sort();
    return [name, Object.fromEntries(list.map((f, i) => [orders[name][i], join(out, f)]))];
  }));
  const hashDiffs = frames.filter((f) => hashes.forward[f] !== hashes.reverse[f] || hashes.forward[f] !== hashes.shuffled[f]);
  const maxDelta = {};
  for (const f of hashDiffs) {
    const a = rgb(files.forward[f]);
    maxDelta[f] = Math.max(maxChannelDelta(a, rgb(files.reverse[f])), maxChannelDelta(a, rgb(files.shuffled[f])));
  }
  const fails = hashDiffs.filter((f) => maxDelta[f] > 2);
  const report = { frames: frames.length, hashDiffs: hashDiffs.length, maxDelta: Math.max(0, ...Object.values(maxDelta)), fails };
  writeFileSync(join(runDir, 'determinism', 'report.json'), `${JSON.stringify({ ...report, frameList: frames, hashes, deltas: maxDelta }, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (fails.length) process.exit(1);
}

// Text that could break the props literal or the captions HTML, assembled and checked in a copy.
const NASTY = '</script><b>"\'&\u2028x';
function cmdSerialization({ run }) {
  const runDir = resolvePath(run);
  const tl = JSON.parse(readFileSync(join(runDir, 'timeline.json'), 'utf8'));
  const sc = tl.scenes.find((s) => s.type === 'keyword');
  sc.props.text = NASTY;
  tl.captions.items[0].text = NASTY;
  const dir = join(ROOT, 'out/engine-check', `serialization-${stamp()}`);
  const lang = Object.entries(JSON.parse(readFileSync(join(ROOT, 'schemas/v2/languages.json'), 'utf8')).languages)
    .find(([, v]) => v.tag === tl.lang)[0];
  assemble(tl, { langAlias: lang, audioPath: join(runDir, 'inputs/narration.wav'), outDir: join(dir, 'project') });
  const lintR = hf.lint(join(dir, 'project'));
  const checkR = hf.check(join(dir, 'project'));
  const mid = Math.floor((sc.nominalStart + sc.nominalEnd) / 2);
  const cap = tl.captions.items[0];
  hf.snapshot(join(dir, 'project'), [mid, cap.startFrame].map((f) => (f / FPS).toFixed(6)), join(dir, 'snapshots'));
  hf.render(join(dir, 'project'), 'draft', join(dir, 'draft.mp4'));
  const fails = hf.checkOutput(join(dir, 'draft.mp4'), { totalFrames: tl.totalFrames, narrationMs: tl.narration.durationMs });
  const report = { dir, lintErrors: lintR.errorCount, checkOk: checkR.ok, runtimeErrors: checkR.runtime.errorCount, outputFails: fails };
  writeFileSync(join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (lintR.errorCount || !checkR.ok || fails.length) process.exit(1);
}

const [cmd, ...rest] = process.argv.slice(2);
const { values } = parseArgs({ args: rest, options: { run: { type: 'string' } } });
if (cmd === 'boundaries') cmdBoundaries();
else if (cmd === 'determinism') cmdDeterminism(values);
else if (cmd === 'serialization') cmdSerialization(values);
else {
  console.error('use: boundaries | determinism --run <dir> | serialization --run <dir>');
  process.exit(1);
}
