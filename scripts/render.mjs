// HyperFrames CLI wrapper and output checks (design §9).
import { spawnSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HF = join(ROOT, 'node_modules/.bin/hyperframes');

// No API keys reach HyperFrames: `snapshot` calls Gemini vision whenever GEMINI_API_KEY is set.
function childEnv() {
  const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
  for (const k of Object.keys(env)) if (/API_KEY|TOKEN|SECRET/i.test(k)) delete env[k];
  return env;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: childEnv(), maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  return r;
}

const parseJson = (r, what) => {
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(`${what}: no JSON output (exit ${r.status})\n${r.stderr.slice(-2000)}`);
  }
};

export const hfVersion = () => run(HF, ['--version']).stdout.trim();

export function lint(projectDir) {
  return parseJson(run(HF, ['lint', '--json'], { cwd: projectDir }), 'lint');
}

export function check(projectDir) {
  return parseJson(run(HF, ['check', '--json', '--at-transitions', '--no-browser-gpu'], { cwd: projectDir }), 'check');
}

// times: seconds. Writes PNGs into outDir.
export function snapshot(projectDir, times, outDir) {
  const r = run(HF, ['snapshot', '--at', times.join(','), '--no-end', '--describe', 'false', '--no-browser-gpu', '-o', outDir],
    { cwd: projectDir });
  if (r.status !== 0) throw new Error(`snapshot failed (exit ${r.status})\n${r.stderr.slice(-2000)}`);
  return r.stdout;
}

// quality: 'draft' | 'high'. Writes <outFile> via a .partial file and rename.
export function render(projectDir, quality, outFile) {
  const partial = outFile.replace(/\.mp4$/, '.partial.mp4');
  const r = run(HF, ['render', '-q', quality, '-f', '30', '--strict', '--no-browser-gpu', '--quiet', '-o', partial], { cwd: projectDir });
  if (r.status !== 0) throw new Error(`render failed (exit ${r.status})\n${(r.stderr || r.stdout).slice(-3000)}`);
  renameSync(partial, outFile);
}

// Returns a list of failed checks (empty = pass).
export function checkOutput(file, { totalFrames, narrationMs, codec = 'h264' }) {
  const p = parseJson(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', file]), 'ffprobe');
  const v = p.streams.filter((s) => s.codec_type === 'video');
  const a = p.streams.filter((s) => s.codec_type === 'audio');
  const fails = [];
  const want = (ok, msg) => { if (!ok) fails.push(msg); };
  want(v.length === 1, `video streams ${v.length}`);
  want(a.length === 1, `audio streams ${a.length}`);
  if (v[0]) {
    want(v[0].width === 1080 && v[0].height === 1920, `size ${v[0].width}x${v[0].height}`);
    want(v[0].r_frame_rate === '30/1', `fps ${v[0].r_frame_rate}`);
    want(Number(v[0].nb_read_frames) === totalFrames, `frames ${v[0].nb_read_frames} != ${totalFrames}`);
    want(v[0].pix_fmt === 'yuv420p', `pix_fmt ${v[0].pix_fmt}`);
    want(v[0].codec_name === codec, `codec ${v[0].codec_name}`);
  }
  if (a[0]) {
    want(Number(a[0].duration) * 1000 >= narrationMs - 50, `audio ${a[0].duration}s < narration ${narrationMs}ms`);
    const vd = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-']);
    const m = /max_volume: (-?[\d.]+) dB/.exec(vd.stderr);
    want(m && Number(m[1]) > -50, `max_volume ${m?.[1]}`);
  }
  return fails;
}
