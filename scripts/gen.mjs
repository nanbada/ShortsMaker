// Generates schemas/v2/scenes.schema.json from the base schema and templates/<type>/props.schema.json.
// Usage: node scripts/gen.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function sceneTypes(root = ROOT) {
  const dir = join(root, 'templates');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'props.schema.json')))
    .map((d) => d.name)
    .sort();
}

export function buildScenesSchema(root = ROOT) {
  const schema = JSON.parse(readFileSync(join(root, 'schemas/v2/scenes.base.schema.json'), 'utf8'));
  delete schema.$comment;
  const types = sceneTypes(root);
  const scene = schema.$defs.scene;
  scene.properties.type.enum = types;
  scene.allOf = types.map((t) => ({
    if: { properties: { type: { const: t } }, required: ['type'] },
    then: { properties: { props: JSON.parse(readFileSync(join(root, 'templates', t, 'props.schema.json'), 'utf8')) } },
  }));
  return `${JSON.stringify(schema, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(ROOT, 'schemas/v2/scenes.schema.json');
  const text = buildScenesSchema();
  if (process.argv.includes('--check')) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (current !== text) {
      console.error('schemas/v2/scenes.schema.json is stale; run node scripts/gen.mjs');
      process.exit(1);
    }
  } else {
    writeFileSync(out, text);
  }
}
