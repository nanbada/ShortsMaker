// Fixture-driven tests for scripts/validate.mjs (design §4.5, §11 S0).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext, validateJob } from '../scripts/validate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'schemas/v2/fixtures');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const fakeCtx = loadContext(ROOT, join(ROOT, 'test/fixtures/motion-registry.json'));
const realCtx = loadContext(ROOT);

const loadValid = (lang) => Object.fromEntries(
  ['script', 'timings', 'scenes'].map((f) => [f, readJson(join(FIXTURES, 'valid', lang, `${f}.json`))]),
);

// Minimal JSON Pointer patch: replace / add / remove.
function applyPatch(doc, { op, path, value }) {
  const parts = path.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  const last = parts.pop();
  let cur = doc;
  for (const p of parts) {
    assert.ok(cur !== undefined && cur !== null && p in cur, `patch path ${path} does not exist`);
    cur = cur[p];
  }
  if (op === 'remove') {
    assert.ok(last in cur, `remove target ${path} does not exist`);
    if (Array.isArray(cur)) cur.splice(Number(last), 1);
    else delete cur[last];
  } else if (op === 'add') {
    if (Array.isArray(cur)) cur.splice(last === '-' ? cur.length : Number(last), 0, value);
    else cur[last] = value;
  } else if (op === 'replace') {
    assert.ok(last in cur, `replace target ${path} does not exist`);
    cur[last] = value;
  } else {
    assert.fail(`unknown patch op ${op}`);
  }
}

const fmt = (errors) => errors.map((e) => `${e.file}${e.path} ${e.code}`).join('\n');

describe('valid fixtures', () => {
  for (const lang of ['ko', 'en']) {
    test(`${lang} fixture validates with the fake registry`, () => {
      const errors = validateJob(loadValid(lang), fakeCtx);
      assert.deepEqual(errors, [], fmt(errors));
    });
  }

  test('en fixture also validates with the empty real registry (uses no motion)', () => {
    const errors = validateJob(loadValid('en'), realCtx);
    assert.deepEqual(errors, [], fmt(errors));
  });

  test('ko fixture is rejected with motion-unknown-effect under the empty real registry', () => {
    const errors = validateJob(loadValid('ko'), realCtx);
    assert.ok(
      errors.some((e) => e.file === 'scenes' && e.code === 'motion-unknown-effect' && e.path === '/scenes/1/motion/in/id'),
      fmt(errors),
    );
  });

  test('fixtures use all three scene types, a crossfade, a cut, and an unterminated last scene', () => {
    for (const lang of ['ko', 'en']) {
      const { scenes } = loadValid(lang).scenes;
      assert.deepEqual([...new Set(scenes.map((s) => s.type))].sort(), ['hook', 'keyword', 'steps']);
      const ids = scenes.map((s) => s.transition?.id).filter(Boolean);
      assert.ok(ids.includes('crossfade') && ids.includes('cut'));
      assert.equal(scenes.at(-1).transition, undefined);
    }
  });
});

describe('invalid fixtures', () => {
  const dir = join(FIXTURES, 'invalid');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

  test('every required error code is covered by at least one case', () => {
    const covered = new Set(files.flatMap((f) => readJson(join(dir, f)).expect.map((e) => e.code)));
    const required = [
      'motion-unknown-effect', 'motion-param', 'motion-too-long', 'motion-duration-range', 'motion-kind-slot',
      'lang-unsupported', 'lang-disabled', 'motion-unverified', 'schema.enum', 'schema.additionalProperties',
      'phrase-unknown', 'start-phrase-order', 'at-phrase-out-of-scene', 'transition-too-long', 'schema.const',
      'scene-id-duplicate', 'first-scene-start', 'last-scene-transition', 'timings-not-ok', 'phrase-id-hash',
      'schema.maxGraphemes', 'job-mismatch', 'schema.pattern',
    ];
    assert.deepEqual(required.filter((c) => !covered.has(c)), []);
  });

  for (const file of files) {
    const c = readJson(join(dir, file));
    test(file.replace(/\.json$/, ''), () => {
      assert.ok(['ko', 'en'].includes(c.base), 'base must be ko or en');
      assert.ok(c.description && c.patch.length > 0 && c.expect.length > 0);
      const job = loadValid(c.base);
      for (const p of c.patch) applyPatch(job[p.file], p);
      const errors = validateJob(job, fakeCtx);
      assert.ok(errors.length > 0, 'expected validation errors, got none');
      for (const want of c.expect) {
        assert.ok(
          errors.some((e) => e.file === want.file && e.code === want.code && e.path === want.path),
          `missing ${want.file}${want.path} ${want.code}\ngot:\n${fmt(errors)}`,
        );
      }
    });
  }
});

describe('generated scenes schema', () => {
  test('node scripts/gen.mjs --check exits 0', () => {
    const r = spawnSync(process.execPath, ['scripts/gen.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
});

describe('review fixes (Codex J1–J4)', () => {
  const clone = (x) => structuredClone(x);
  const codes = (errs) => errs.map((e) => `${e.file}:${e.code}:${e.path}`);

  test('J1 path-mismatch when files sit under another job or language folder', () => {
    const job = loadValid('en');
    assert.deepEqual(validateJob(job, fakeCtx, { jobId: 'mm-calc', alias: 'en' }), []);
    assert.ok(codes(validateJob(job, fakeCtx, { jobId: 'other-job', alias: 'en' })).includes('script:path-mismatch:/jobId'));
    assert.ok(codes(validateJob(job, fakeCtx, { jobId: 'mm-calc', alias: 'ko' })).includes('script:path-mismatch:/lang'));
  });

  test('J2 displayRange end beyond the sentence is rejected', () => {
    const job = clone(loadValid('en'));
    const last = job.timings.phrases.length - 1;
    job.timings.phrases[last].displayRange[1] = 99999;
    assert.ok(codes(validateJob(job, fakeCtx)).includes(`timings:phrase-range:/phrases/${last}/displayRange`));
  });

  test('J3 phrase shorter than 200 ms is rejected, 200 ms passes', () => {
    const base = loadValid('en');
    const p0 = base.timings.phrases[0];
    const at = (len) => {
      const job = clone(base);
      job.timings.phrases[0].endMs = p0.startMs + len;
      return codes(validateJob(job, fakeCtx));
    };
    assert.ok(at(199).includes('timings:phrase-time:/phrases/0'));
    assert.ok(!at(200).includes('timings:phrase-time:/phrases/0'));
  });

  test('J4 text limits count graphemes, not code points', () => {
    const job = clone(loadValid('en'));
    job.script.title = '👨‍👩‍👧‍👦'.repeat(15);
    assert.deepEqual(validateJob(job, fakeCtx), []);
    job.script.title = '👨‍👩‍👧‍👦'.repeat(101);
    assert.ok(codes(validateJob(job, fakeCtx)).includes('script:schema.maxGraphemes:/title'));
  });
});
