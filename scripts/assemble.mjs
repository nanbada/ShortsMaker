// timeline.json + templates → HyperFrames project (design §5). The only template edits are
// __ID__ substitution and the props JSON literal; captions and the root are filled from timeline.json.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS, framesToSecondsAttrs } from './lib/frames.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTANCE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

// A JS string literal holding the JSON, for `JSON.parse(<literal>)` inside an inline <script>.
// HyperFrames re-executes every <script> in a sub-composition as JavaScript (type is not kept),
// so data cannot travel in <script type="application/json">. The literal escapes <, >, &,
// U+2028 and U+2029, so text such as "</script>" cannot close the element.
export const scriptJson = (v) => JSON.stringify(JSON.stringify(v))
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Seconds string for the root duration: floor to µs, no end correction (it is a length, not a window).
const totalSeconds = (frames) => {
  const us = Math.floor((frames * 1e6) / FPS);
  return `${Math.floor(us / 1e6)}.${String(us % 1e6).padStart(6, '0')}`;
};

function fill(template, values) {
  return template.replace(/__([A-Z_]+)__/g, (m, k) => {
    if (!(k in values)) throw new Error(`template placeholder ${m} has no value`);
    return values[k];
  });
}

// timeline: resolve() output. langAlias: 'ko' | 'en'. audioPath: 24 kHz mono WAV. outDir: project dir.
export function assemble(timeline, { langAlias, audioPath, outDir, root = ROOT }) {
  const tpl = (p) => readFileSync(join(root, 'templates', p), 'utf8');
  mkdirSync(join(outDir, 'compositions'), { recursive: true });
  mkdirSync(join(outDir, 'assets/fonts'), { recursive: true });
  mkdirSync(join(outDir, 'vendor'), { recursive: true });

  const hosts = [];
  const crossfades = [];
  timeline.scenes.forEach((s, i) => {
    const id = `scene-${s.id}`;
    if (!INSTANCE_ID.test(id)) throw new Error(`bad instance id ${id}`);
    const html = fill(tpl(`${s.type}/scene.html`), { ID: id, PROPS: scriptJson(s.props) });
    writeFileSync(join(outDir, 'compositions', `${id}.html`), html);
    const t = framesToSecondsAttrs(s.clipStart, s.clipEnd);
    hosts.push(`      <div id="${id}-host" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" `
      + `data-start="${t.start}" data-duration="${t.duration}" data-track-index="${i + 1}" data-width="1080" data-height="1920" `
      + `style="z-index: ${i + 1}"></div>`);
    if (s.transitionIn.id === 'crossfade') {
      crossfades.push({ hostId: `${id}-host`, startFrame: s.clipStart, durationFrames: s.transitionIn.durationFrames });
    }
  });

  if (timeline.captions.enabled) {
    const items = timeline.captions.items.map((c, i) => {
      const t = framesToSecondsAttrs(c.startFrame, c.endFrame);
      return `    <div id="captions-${i}" class="clip t-cap" data-start="${t.start}" data-duration="${t.duration}" data-track-index="0">`
        + `<div class="t-cap-text">${escapeHtml(c.text)}</div></div>`;
    }).join('\n');
    writeFileSync(join(outDir, 'compositions', 'captions.html'), fill(tpl('_base/captions.html'), { ID: 'captions', ITEMS: items }));
    const t = framesToSecondsAttrs(0, timeline.totalFrames);
    hosts.push(`      <div id="captions-host" class="clip" data-track-kind="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" `
      + `data-start="${t.start}" data-duration="${t.duration}" data-track-index="${timeline.scenes.length + 1}" `
      + `data-width="1080" data-height="1920" style="z-index: ${timeline.scenes.length + 1}"></div>`);
  }

  writeFileSync(join(outDir, 'index.html'), fill(tpl('_base/root.html'), {
    LANG: timeline.lang,
    LANG_ALIAS: langAlias,
    ACCENT: timeline.theme.accent,
    DURATION: totalSeconds(timeline.totalFrames),
    HOSTS: hosts.join('\n'),
    ROOT_DATA: scriptJson({ fps: FPS, crossfades }),
  }));
  copyFileSync(audioPath, join(outDir, 'assets/narration.wav'));
  for (const f of ['noto-sans-kr.woff2', 'inter.woff2']) copyFileSync(join(root, 'templates/fonts', f), join(outDir, 'assets/fonts', f));
  copyFileSync(join(root, 'templates/_base/vendor/gsap.min.js'), join(outDir, 'vendor/gsap.min.js'));
}
