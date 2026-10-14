#!/usr/bin/env node
// Check that the native resource pack contains every staged component file.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

if (!process.argv[2]) {
  throw new TypeError('Usage: check_native_resources.mjs <chromium-src>');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const component = join(root, 'prism');
const chromiumSrc = resolve(process.argv[2]);
const resourceRoot = join(chromiumSrc, 'chrome/browser/resources');
const grd = readFileSync(join(resourceRoot,
  'component_extension_resources.grd'), 'utf8');
const gn = readFileSync(join(resourceRoot, 'BUILD.gn'), 'utf8');
const manifest = JSON.parse(readFileSync(join(component,
  'component/manifest.json'), 'utf8'));

function filesBelow(directory) {
  return readdirSync(join(component, directory), {withFileTypes: true})
    .filter(entry => entry.isFile())
    .map(entry => `${directory}/${entry.name}`);
}

const expected = new Set(['component/manifest.json',
  ...['blocking', 'component', 'media', 'settings'].flatMap(filesBelow)]);
const entries = [...grd.matchAll(/<include\b[^>]*\bname="([^"]+)"[^>]*\bfile="\.\.\/\.\.\/\.\.\/prism\/([^"]+)"[^>]*\bresource_path="prism_media\/([^"]+)"[^>]*\/>/g)];
const mapped = new Set();
const ids = new Set();
for (const [, id, source, resource] of entries) {
  assert.equal(resource, source === 'component/manifest.json' ?
    'manifest.json' : source, `Resource path differs: ${source}`);
  assert(!mapped.has(source), `Duplicate resource: ${source}`);
  assert(!ids.has(id), `Duplicate GRIT ID: ${id}`);
  mapped.add(source);
  ids.add(id);
}
assert.deepEqual([...mapped].sort(), [...expected].sort(),
  'GRIT resource list differs from staged component files');
assert(ids.has('IDR_PRISM_MEDIA_MANIFEST'), 'Missing manifest GRIT ID');

const target = gn.match(/grit\("component_extension_resources"\)\s*\{\s*source = "component_extension_resources\.grd"\s*inputs = \[([^\]]+)\]/);
assert(target, 'Missing component resource GN inputs');
const inputs = new Set([...target[1].matchAll(/"\.\.\/\.\.\/\.\.\/prism\/([^"]+)"/g)]
  .map(match => match[1]));
assert.deepEqual([...inputs].sort(), [...expected].sort(),
  'GN inputs differ from staged component files');

const referenced = [manifest.background?.service_worker,
  manifest.options_page,
  ...manifest.content_scripts.flatMap(item => item.js),
  ...manifest.web_accessible_resources.flatMap(item => item.resources)];
for (const path of referenced) {
  assert(expected.has(path), `Manifest refers to missing resource: ${path}`);
}

for (const source of expected) {
  if (!/\.m?js$/.test(source)) continue;
  const body = readFileSync(join(component, source), 'utf8');
  const imports = [
    ...body.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
    ...body.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
  ];
  for (const [, specifier] of imports) {
    if (!specifier.startsWith('.')) continue;
    const destination = relative(component,
      resolve(component, source, '..', specifier));
    assert(expected.has(destination),
      `Unpacked import ${specifier} from ${source}`);
  }
}

console.log(`PASS: ${expected.size} native component resources and manifest references`);
