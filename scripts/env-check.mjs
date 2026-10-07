// Compares installed HyperFrames CLI and the global Claude Code plugin with config/tools.lock.json.
// Usage: node scripts/env-check.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lock = readJson(join(ROOT, 'config/tools.lock.json'));

const plugins = JSON.parse(execFileSync('claude', ['plugin', 'list', '--json'], { encoding: 'utf8' }));
const plugin = plugins.find((p) => p.id === lock.hyperframesPlugin.id);
const marketplaces = readJson(join(homedir(), '.claude/plugins/known_marketplaces.json'));
const mpName = lock.hyperframesPlugin.id.split('@')[1];
const mpDir = marketplaces[mpName]?.installLocation;

const actual = {
  hyperframesCli: readJson(join(ROOT, 'node_modules/hyperframes/package.json')).version,
  pluginVersion: plugin?.version ?? null,
  pluginEnabled: plugin?.enabled ?? false,
  marketplaceCommit: mpDir ? execFileSync('git', ['-C', mpDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() : null,
};
const expected = {
  hyperframesCli: lock.hyperframesCli,
  pluginVersion: lock.hyperframesPlugin.version,
  pluginEnabled: true,
  marketplaceCommit: lock.hyperframesPlugin.marketplaceCommit,
};
const diffs = Object.keys(expected).filter((k) => actual[k] !== expected[k]);
for (const k of diffs) console.error(`${k}: installed ${actual[k]} != lock ${expected[k]}`);
if (diffs.length) process.exit(1);
console.log('env ok', JSON.stringify(actual));
