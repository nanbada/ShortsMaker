// Schema + semantic validation for one job/lang (design §4, §4.5).
// Usage: node scripts/validate.mjs --job <id> --lang <alias>
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import { nfc, graphemeCount, cpLength, cpSlice, phraseIdsForSentence } from './lib/canon.mjs';
import {
  FPS, MIN_SCENE_FRAMES, MIN_PHRASE_MS, MAX_TOTAL_FRAMES, totalFrames, sceneNominal,
} from './lib/frames.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Motion slots accept these effect kinds (motion doc §3).
const SLOT_KINDS = {
  in: ['text-in', 'element', 'number', 'emphasis'],
  out: ['text-out', 'element'],
};
const FRAME_SIZE = '1080x1920';

export function loadContext(root = ROOT, registryPath = join(root, 'motion/registry.json')) {
  const ajv = new Ajv2020({ allErrors: true, strictTuples: false });
  ajv.addKeyword({
    keyword: 'maxGraphemes',
    type: 'string',
    schemaType: 'number',
    validate: (max, data) => graphemeCount(data) <= max,
    error: { message: (cxt) => `must have at most ${cxt.schema} graphemes` },
  });
  const compile = (name) => ajv.compile(readJson(join(root, 'schemas/v2', name)));
  return {
    languages: readJson(join(root, 'schemas/v2/languages.json')).languages,
    registry: readJson(registryPath),
    check: {
      script: compile('script.schema.json'),
      pronounce: compile('pronounce.schema.json'),
      timings: compile('timings.schema.json'),
      scenes: compile('scenes.schema.json'),
    },
  };
}

// Recursively NFC-normalize every string (contracts are normalized on read).
export const normalizeStrings = (v) => {
  if (typeof v === 'string') return nfc(v);
  if (Array.isArray(v)) return v.map(normalizeStrings);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizeStrings(x)]));
  return v;
};

function schemaErrors(file, validate, data) {
  if (validate(data)) return [];
  return validate.errors.map((e) => ({
    file,
    code: `schema.${e.keyword}`,
    path: e.instancePath,
    message: e.message,
  }));
}

function collectAtPhrases(value, path, out) {
  if (Array.isArray(value)) value.forEach((v, i) => collectAtPhrases(v, `${path}/${i}`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'atPhrase' && typeof v === 'string') out.push({ id: v, path: `${path}/atPhrase` });
      else collectAtPhrases(v, `${path}/${k}`, out);
    }
  }
  return out;
}

function langAlias(languages, tag) {
  return Object.keys(languages).find((a) => languages[a].tag === tag);
}

// job: { script, timings, scenes, pronounce: [dict, ...] } (already parsed JSON).
// expected: { jobId, alias } from the jobs/<id>/<alias>/ path, when validating files on disk.
export function validateJob(job, ctx, expected) {
  const { languages, registry, check } = ctx;
  const script = normalizeStrings(job.script);
  const timings = normalizeStrings(job.timings);
  const scenes = normalizeStrings(job.scenes);
  const dicts = (job.pronounce ?? []).map(normalizeStrings);
  const errors = [];
  const err = (file, code, path, message) => errors.push({ file, code, path, message });

  errors.push(...schemaErrors('script', check.script, script));
  dicts.forEach((d, i) => errors.push(...schemaErrors(`pronounce[${i}]`, check.pronounce, d)));
  errors.push(...schemaErrors('timings', check.timings, timings));
  errors.push(...schemaErrors('scenes', check.scenes, scenes));
  if (errors.length) return errors;

  // Language
  const alias = langAlias(languages, script.lang);
  if (!alias) err('script', 'lang-unsupported', '/lang', `unknown language ${script.lang}`);
  else if (!languages[alias].enabled) err('script', 'lang-disabled', '/lang', `language ${alias} is not enabled`);
  for (const [file, doc] of [['timings', timings], ['scenes', scenes], ...dicts.map((d, i) => [`pronounce[${i}]`, d])]) {
    if (doc.lang !== script.lang) err(file, 'lang-mismatch', '/lang', `${doc.lang} != script ${script.lang}`);
  }
  if (scenes.jobId !== script.jobId) err('scenes', 'job-mismatch', '/jobId', `${scenes.jobId} != script ${script.jobId}`);
  if (expected && script.jobId !== expected.jobId) {
    err('script', 'path-mismatch', '/jobId', `${script.jobId} is stored under jobs/${expected.jobId}`);
  }
  if (expected && script.lang !== languages[expected.alias]?.tag) {
    err('script', 'path-mismatch', '/lang', `${script.lang} is stored under the ${expected.alias} folder`);
  }

  // Script
  const sentences = new Map();
  script.sentences.forEach((s, i) => {
    if (sentences.has(s.id)) err('script', 'sentence-id-duplicate', `/sentences/${i}/id`, s.id);
    sentences.set(s.id, s);
  });
  dicts.forEach((d, di) => {
    const seen = new Set();
    d.entries.forEach((e, i) => {
      if (seen.has(e.display)) err(`pronounce[${di}]`, 'pronounce-duplicate', `/entries/${i}/display`, e.display);
      seen.add(e.display);
    });
  });

  // Timings
  const phraseIndex = new Map();
  const bySentence = new Map();
  timings.phrases.forEach((p, i) => {
    if (phraseIndex.has(p.id)) err('timings', 'phrase-id-duplicate', `/phrases/${i}/id`, p.id);
    phraseIndex.set(p.id, i);
    const s = sentences.get(p.sentenceId);
    if (!s) {
      err('timings', 'phrase-sentence-unknown', `/phrases/${i}/sentenceId`, p.sentenceId);
      return;
    }
    if (!bySentence.has(p.sentenceId)) bySentence.set(p.sentenceId, []);
    bySentence.get(p.sentenceId).push(i);
    const [a, b] = p.displayRange;
    if (!(a < b && b <= cpLength(s.display)) || cpSlice(s.display, a, b) !== p.display) {
      err('timings', 'phrase-range', `/phrases/${i}/displayRange`, `range does not select "${p.display}"`);
    }
  });
  for (const [sid, idxs] of bySentence) {
    const expected = phraseIdsForSentence(sid, idxs.map((i) => timings.phrases[i].display));
    idxs.forEach((i, k) => {
      if (timings.phrases[i].id !== expected[k]) {
        err('timings', 'phrase-id-hash', `/phrases/${i}/id`, `expected ${expected[k]}`);
      }
    });
  }
  const flagged = timings.phrases.some((p) => p.review === 'flagged');
  if ((timings.status === 'ok') === flagged) {
    err('timings', 'status-mismatch', '/status', `status ${timings.status} with flagged=${flagged}`);
  }
  timings.phrases.forEach((p, i) => {
    if (p.review === 'flagged') return;
    const prev = timings.phrases[i - 1];
    if (p.endMs - p.startMs < MIN_PHRASE_MS || p.endMs > timings.audio.durationMs || (prev && prev.endMs > p.startMs)) {
      err('timings', 'phrase-time', `/phrases/${i}`, `invalid time [${p.startMs}, ${p.endMs})`);
    }
  });
  if (timings.status !== 'ok') err('scenes', 'timings-not-ok', '', `timings status is ${timings.status}`);

  // Scenes
  const sceneIds = new Set();
  const startIdx = [];
  scenes.scenes.forEach((sc, i) => {
    const p = `/scenes/${i}`;
    if (sceneIds.has(sc.id)) err('scenes', 'scene-id-duplicate', `${p}/id`, sc.id);
    sceneIds.add(sc.id);
    const idx = phraseIndex.get(sc.startPhrase);
    if (idx === undefined) err('scenes', 'phrase-unknown', `${p}/startPhrase`, sc.startPhrase);
    startIdx.push(idx);
    if (i === scenes.scenes.length - 1 && sc.transition) {
      err('scenes', 'last-scene-transition', `${p}/transition`, 'last scene cannot have a transition');
    }
  });
  if (startIdx[0] !== undefined && startIdx[0] !== 0) {
    err('scenes', 'first-scene-start', '/scenes/0/startPhrase', 'first scene must start at the first phrase');
  }
  startIdx.forEach((idx, i) => {
    if (i > 0 && idx !== undefined && startIdx[i - 1] !== undefined && idx <= startIdx[i - 1]) {
      err('scenes', 'start-phrase-order', `/scenes/${i}/startPhrase`, 'startPhrase must strictly increase');
    }
  });
  scenes.scenes.forEach((sc, i) => {
    const lo = startIdx[i];
    const hi = i + 1 < startIdx.length ? startIdx[i + 1] : timings.phrases.length;
    for (const ref of collectAtPhrases(sc.props, `/scenes/${i}/props`, [])) {
      const idx = phraseIndex.get(ref.id);
      if (idx === undefined) err('scenes', 'phrase-unknown', ref.path, ref.id);
      else if (lo !== undefined && hi !== undefined && (idx < lo || idx >= hi)) {
        err('scenes', 'at-phrase-out-of-scene', ref.path, `${ref.id} is outside the scene's phrases`);
      }
    }
  });

  // Motion
  const effects = new Map(registry.effects.map((e) => [e.id, e]));
  scenes.scenes.forEach((sc, i) => {
    for (const slot of ['in', 'out']) {
      const m = sc.motion?.[slot];
      if (!m) continue;
      const p = `/scenes/${i}/motion/${slot}`;
      const fx = effects.get(m.id);
      if (!fx) {
        err('scenes', 'motion-unknown-effect', `${p}/id`, m.id);
        continue;
      }
      if (!SLOT_KINDS[slot].includes(fx.kind)) err('scenes', 'motion-kind-slot', `${p}/id`, `${fx.kind} cannot be used as ${slot}`);
      for (const [k, v] of Object.entries(m.params ?? {})) {
        const spec = fx.params?.[k];
        const ok = spec && (spec.type === 'enum'
          ? spec.values.includes(v)
          : spec.type === 'string' && typeof v === 'string' && (spec.maxLength === undefined || graphemeCount(v) <= spec.maxLength));
        if (!ok) err('scenes', 'motion-param', `${p}/params/${k}`, `invalid param ${k} for ${fx.id}`);
      }
      const r = fx.durationFrames;
      if (m.durationFrames < r.min || m.durationFrames > r.max) {
        err('scenes', 'motion-duration-range', `${p}/durationFrames`, `must be within [${r.min}, ${r.max}]`);
      }
      const verified = alias && fx.verified.some((v) => v.lang === alias && v.font === languages[alias].font
        && v.size === FRAME_SIZE && v.revision === fx.source.revision);
      if (!verified) err('scenes', 'motion-unverified', `${p}/id`, `${fx.id} is not verified for ${alias ?? script.lang}`);
    }
  });
  if (errors.length) return errors;

  // After resolve: frame lengths (design §4.5, §4.6)
  const total = totalFrames(timings.audio.durationMs, scenes.tailFrames);
  const nominal = sceneNominal(startIdx.map((idx) => timings.phrases[idx].startMs), total);
  if (total > MAX_TOTAL_FRAMES) err('scenes', 'total-too-long', '', `${total} frames > ${MAX_TOTAL_FRAMES}`);
  nominal.forEach((n, i) => {
    const len = n.nominalEnd - n.nominalStart;
    const sc = scenes.scenes[i];
    const p = `/scenes/${i}`;
    if (len < MIN_SCENE_FRAMES) err('scenes', 'scene-too-short', p, `${len} frames < ${MIN_SCENE_FRAMES}`);
    const d = sc.transition?.durationFrames ?? 0;
    if (d > 0) {
      const next = nominal[i + 1];
      if (2 * d >= len || 2 * d >= next.nominalEnd - next.nominalStart) {
        err('scenes', 'transition-too-long', `${p}/transition/durationFrames`, `${d} frames is not shorter than half of both scenes`);
      }
    }
    const motionLen = (sc.motion?.in?.durationFrames ?? 0) + (sc.motion?.out?.durationFrames ?? 0);
    if (motionLen >= len) err('scenes', 'motion-too-long', `${p}/motion`, `${motionLen} frames >= scene ${len} frames`);
  });
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { job: { type: 'string' }, lang: { type: 'string' } } });
  const dir = join(ROOT, 'jobs', values.job, values.lang);
  const optional = (p) => (existsSync(p) ? [readJson(p)] : []);
  const job = {
    script: readJson(join(dir, 'script.json')),
    timings: readJson(join(dir, 'timings.json')),
    scenes: readJson(join(dir, 'scenes.json')),
    pronounce: [...optional(join(ROOT, 'config/pronounce', `${values.lang}.json`)), ...optional(join(dir, 'pronounce.json'))],
  };
  const errors = validateJob(job, loadContext(), { jobId: values.job, alias: values.lang });
  for (const e of errors) console.error(`${e.file}${e.path} ${e.code}: ${e.message}`);
  if (errors.length) process.exit(1);
  console.log(`ok ${values.job}/${values.lang} (${FPS} fps)`);
}
