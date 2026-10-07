// Command entry point (design §8). S1: voice (manual audio + timings), build, draft.
// Usage:
//   node scripts/run.mjs voice --job <id> --lang ko --audio-file x.wav --timings t.json
//   node scripts/run.mjs build --job <id> --lang ko
//   node scripts/run.mjs draft --run <run-dir>
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, openSync, fsyncSync, closeSync, rmSync,
} from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { sha256Hex, canonicalJson, hashJson } from './lib/canon.mjs';
import { buildPhrasing, mergeDicts } from './lib/phrasing.mjs';
import { MIN_PHRASE_MS, FPS } from './lib/frames.mjs';
import { loadContext, validateJob, normalizeStrings } from './validate.mjs';
import { resolve } from './resolve.mjs';
import { assemble } from './assemble.mjs';
import * as hf from './render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fileSha = (p) => sha256Hex(readFileSync(p));

function writeAtomic(path, text) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  const fd = openSync(tmp, 'r');
  fsyncSync(fd);
  closeSync(fd);
  renameSync(tmp, path);
}
const writeJson = (path, v) => writeAtomic(path, `${JSON.stringify(v, null, 2)}\n`);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// RIFF/WAVE header → format and duration.
export function wavInfo(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${path} is not a WAV file`);
  let off = 12;
  let fmt;
  let dataBytes;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(off + 8), channels: b.readUInt16LE(off + 10), sampleRate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') dataBytes = Math.min(size, b.length - off - 8);
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataBytes === undefined) throw new Error(`${path}: missing fmt or data chunk`);
  const bytesPerMs = (fmt.sampleRate * fmt.channels * (fmt.bits / 8)) / 1000;
  return { ...fmt, dataBytes, durationMs: Math.round(dataBytes / bytesPerMs) };
}

function jobPaths(job, lang) {
  const dir = join(ROOT, 'jobs', job, lang);
  return {
    dir,
    script: join(dir, 'script.json'),
    pronounce: join(dir, 'pronounce.json'),
    timings: join(dir, 'timings.json'),
    scenes: join(dir, 'scenes.json'),
    voice: join(dir, 'voice.json'),
    commonPronounce: join(ROOT, 'config/pronounce', `${lang}.json`),
  };
}

function loadDicts(p) {
  return [p.commonPronounce, p.pronounce].filter(existsSync).map((f) => normalizeStrings(readJson(f)));
}

function currentPhrasing(ctx, p, alias) {
  const script = normalizeStrings(readJson(p.script));
  const dicts = loadDicts(p);
  const errs = [];
  if (!ctx.check.script(script)) errs.push(...ctx.check.script.errors.map((e) => `script${e.instancePath} ${e.message}`));
  dicts.forEach((d) => { if (!ctx.check.pronounce(d)) errs.push(...ctx.check.pronounce.errors.map((e) => `pronounce${e.instancePath} ${e.message}`)); });
  const lang = ctx.languages[alias];
  if (!lang) errs.push(`unknown language ${alias}`);
  else if (script.lang !== lang.tag) errs.push(`script.lang ${script.lang} does not match folder ${alias}`);
  if (errs.length) fail(errs.join('\n'));
  const phrasing = buildPhrasing(script, dicts, lang, alias);
  for (const w of phrasing.warnings) console.warn(`warning ${w.sentenceId} ${w.code}: ${w.message}`);
  if (phrasing.errors.length) fail(phrasing.errors.map((e) => `${e.sentenceId} ${e.code}: ${e.message}`).join('\n'));
  return { script, dicts, phrasing };
}

const PHRASE_KEYS = ['id', 'sentenceId', 'display', 'spoken', 'displayRange', 'spokenRange'];

function cmdVoice({ job, lang, 'audio-file': audioFile, timings: timingsFile }) {
  if (!audioFile || !timingsFile) fail('S1 supports only: voice --audio-file <wav> --timings <json>');
  const ctx = loadContext();
  const p = jobPaths(job, lang);
  const { script, phrasing } = currentPhrasing(ctx, p, lang);

  // Audio → 24 kHz mono 16-bit, content-addressed.
  const dir = join(ROOT, 'cache/manual');
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `tmp-${process.pid}.wav`);
  const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', resolvePath(audioFile), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le',
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', tmp], { encoding: 'utf8' });
  if (ff.status !== 0) fail(`ffmpeg failed: ${ff.stderr}`);
  const audioSha256 = fileSha(tmp);
  const audioPath = join(dir, `${audioSha256}.wav`);
  if (existsSync(audioPath)) rmSync(tmp);
  else renameSync(tmp, audioPath);
  const info = wavInfo(audioPath);

  // Manual timings: must match the current phrasing exactly; times are checked, never filled in.
  const imported = normalizeStrings(readJson(timingsFile));
  if (!ctx.check.timings(imported)) fail(ctx.check.timings.errors.map((e) => `timings${e.instancePath} ${e.message}`).join('\n'));
  const errs = [];
  if (imported.phrases.length !== phrasing.phrases.length) errs.push(`phrase count ${imported.phrases.length} != ${phrasing.phrases.length}`);
  phrasing.phrases.forEach((ph, i) => {
    const got = imported.phrases[i];
    if (!got) return;
    for (const k of PHRASE_KEYS) {
      if (canonicalJson(got[k]) !== canonicalJson(ph[k])) errs.push(`phrase ${i} ${k}: ${canonicalJson(got[k])} != ${canonicalJson(ph[k])}`);
    }
    const prev = imported.phrases[i - 1];
    if (got.endMs - got.startMs < MIN_PHRASE_MS) errs.push(`phrase ${i} shorter than ${MIN_PHRASE_MS} ms`);
    if (prev && prev.endMs > got.startMs) errs.push(`phrase ${i} overlaps the previous phrase`);
    if (got.endMs > info.durationMs) errs.push(`phrase ${i} ends after the audio (${info.durationMs} ms)`);
  });
  if (errs.length) fail(errs.join('\n'));

  const timings = {
    schemaVersion: '2.0.0',
    lang: script.lang,
    audio: { sha256: audioSha256, durationMs: info.durationMs, sampleRate: info.sampleRate, channels: info.channels },
    source: { spokenSha256: phrasing.spokenSha256, phrasingSha256: phrasing.phrasingSha256, aligner: null },
    status: 'ok',
    phrases: phrasing.phrases.map((ph, i) => ({
      ...ph,
      startMs: imported.phrases[i].startMs,
      endMs: imported.phrases[i].endMs,
      maxWordLoss: null,
      timingSource: 'manual',
      review: 'reviewed',
      issues: [],
    })),
  };
  if (!ctx.check.timings(timings)) fail(ctx.check.timings.errors.map((e) => `timings${e.instancePath} ${e.message}`).join('\n'));
  const text = `${JSON.stringify(timings, null, 2)}\n`;
  if (existsSync(p.timings)) {
    const old = readFileSync(p.timings, 'utf8');
    if (old !== text) renameSync(p.timings, join(p.dir, `timings.prev-${sha256Hex(old).slice(0, 8)}.json`));
  }
  writeAtomic(p.timings, text);
  writeJson(p.voice, {
    provider: 'manual', planTier: null, ttsKey: null, audioSha256, spokenSha256: phrasing.spokenSha256, durationMs: info.durationMs,
  });
  console.log(`voice ok ${job}/${lang}: ${info.durationMs} ms, ${timings.phrases.length} phrases, audio ${audioSha256.slice(0, 12)}`);
}

function runId() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}-${randomBytes(2).toString('hex')}`;
}

function step(state, statePath, name, fn) {
  state.steps[name] = { status: 'running', startedAt: new Date().toISOString() };
  writeJson(statePath, state);
  try {
    const result = fn();
    Object.assign(state.steps[name], { status: 'done', endedAt: new Date().toISOString() }, result ?? {});
    writeJson(statePath, state);
  } catch (e) {
    Object.assign(state.steps[name], { status: 'failed', endedAt: new Date().toISOString(), error: String(e.message).slice(0, 4000) });
    writeJson(statePath, state);
    fail(`${name} failed: ${e.message}`);
  }
}

// Snapshot instants: per scene first+1, middle, last-1 nominal frame; seconds at exact frame times.
const snapshotFrames = (tl) => [...new Set(tl.scenes.flatMap((s) => [
  s.nominalStart + 1, Math.floor((s.nominalStart + s.nominalEnd) / 2), s.nominalEnd - 1,
]))].sort((a, b) => a - b);

function cmdBuild({ job, lang }) {
  const ctx = loadContext();
  const p = jobPaths(job, lang);
  const { phrasing } = currentPhrasing(ctx, p, lang);
  const voice = readJson(p.voice);
  const timings = readJson(p.timings);
  if (voice.provider !== 'manual') fail('S1 build supports only manual audio');
  const audioPath = join(ROOT, 'cache/manual', `${voice.audioSha256}.wav`);
  const stale = [];
  if (!existsSync(audioPath) || fileSha(audioPath) !== voice.audioSha256) stale.push('audio file does not match voice.json');
  if (voice.spokenSha256 !== phrasing.spokenSha256) stale.push('spoken text changed since voice');
  if (timings.audio.sha256 !== voice.audioSha256) stale.push('timings audio differs from voice.json');
  if (timings.source.spokenSha256 !== phrasing.spokenSha256) stale.push('timings spoken text is stale');
  if (timings.source.phrasingSha256 !== phrasing.phrasingSha256) stale.push('timings phrasing is stale');
  // The recorded hash alone does not prove the phrase list was left intact (e.g. a phrase deleted by hand).
  const listed = timings.phrases.map((ph) => Object.fromEntries(PHRASE_KEYS.map((k) => [k, ph[k]])));
  if (hashJson(normalizeStrings(listed)) !== phrasing.phrasingSha256) stale.push('timings phrases differ from the current phrasing');
  if (stale.length) fail(`${stale.join('\n')}\nrun: node scripts/run.mjs voice --job ${job} --lang ${lang} ...`);

  const jobFiles = {
    script: readJson(p.script),
    timings,
    scenes: readJson(p.scenes),
    pronounce: [p.commonPronounce, p.pronounce].filter(existsSync).map(readJson),
  };
  const errors = validateJob(jobFiles, ctx, { jobId: job, alias: lang });
  if (errors.length) fail(errors.map((e) => `${e.file}${e.path} ${e.code}: ${e.message}`).join('\n'));

  let id = runId();
  while (existsSync(join(ROOT, 'out', job, lang, id))) id = runId();
  const runDir = join(ROOT, 'out', job, lang, id);
  const inputs = join(runDir, 'inputs');
  mkdirSync(inputs, { recursive: true });
  writeJson(join(inputs, 'script.json'), jobFiles.script);
  writeJson(join(inputs, 'pronounce.json'), { schemaVersion: '2.0.0', lang: jobFiles.script.lang, entries: mergeDicts(loadDicts(p)) });
  writeJson(join(inputs, 'timings.json'), timings);
  writeJson(join(inputs, 'scenes.json'), jobFiles.scenes);
  copyFileSync(audioPath, join(inputs, 'narration.wav'));

  const statePath = join(runDir, 'state.json');
  const state = { runId: id, job, lang, steps: {} };
  let timeline;
  step(state, statePath, 'resolve', () => {
    timeline = resolve(normalizeStrings(jobFiles.scenes), normalizeStrings(timings));
    writeJson(join(runDir, 'timeline.json'), timeline);
  });
  const project = join(runDir, 'project');
  step(state, statePath, 'assemble', () => assemble(timeline, { langAlias: lang, audioPath: join(inputs, 'narration.wav'), outDir: project }));
  step(state, statePath, 'lint', () => {
    const r = hf.lint(project);
    writeJson(join(runDir, 'lint.json'), r);
    if (r.errorCount > 0) throw new Error(`${r.errorCount} lint error(s), see lint.json`);
    return { warnings: r.warningCount };
  });
  step(state, statePath, 'check', () => {
    const r = hf.check(project);
    writeJson(join(runDir, 'check.json'), r);
    if (!r.ok) throw new Error('check reported errors, see check.json');
  });
  step(state, statePath, 'snapshot', () => {
    const frames = snapshotFrames(timeline);
    hf.snapshot(project, frames.map((f) => (f / FPS).toFixed(6)), join(runDir, 'snapshots'));
    return { frames };
  });
  console.log(`build ok: ${runDir}`);
}

function cmdDraft({ run }) {
  const runDir = resolvePath(run);
  const statePath = join(runDir, 'state.json');
  const state = readJson(statePath);
  if (state.steps.snapshot?.status !== 'done') fail('build has not finished for this run');
  if (existsSync(join(runDir, 'draft.mp4'))) {
    console.log(`draft exists: ${join(runDir, 'draft.mp4')} ${fileSha(join(runDir, 'draft.mp4'))}`);
    return;
  }
  const timeline = readJson(join(runDir, 'timeline.json'));
  step(state, statePath, 'draft', () => {
    const out = join(runDir, 'draft.mp4');
    hf.render(join(runDir, 'project'), 'draft', out);
    const fails = hf.checkOutput(out, { totalFrames: timeline.totalFrames, narrationMs: timeline.narration.durationMs });
    if (fails.length) throw new Error(`output check: ${fails.join('; ')}`);
    return { sha256: fileSha(out) };
  });
  console.log(`draft ok: ${join(runDir, 'draft.mp4')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      job: { type: 'string' }, lang: { type: 'string' }, run: { type: 'string' },
      'audio-file': { type: 'string' }, timings: { type: 'string' },
    },
  });
  const commands = { voice: cmdVoice, build: cmdBuild, draft: cmdDraft };
  if (!commands[cmd]) fail(`unknown command ${cmd}; use voice | build | draft`);
  commands[cmd](values);
}
