#!/usr/bin/env node
// Tests storage isolation and restart persistence in the pinned source build.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) {
  throw new Error('The binary must be in the full Chromium source checkout');
}
const expected = JSON.parse(readFileSync(join(repo, 'chromium.lock.json'),
  'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'],
  {encoding: 'utf8'}).trim();
if (actual !== expected) {
  throw new Error(`Chromium source is ${actual}, expected ${expected}`);
}

const root = mkdtempSync(join(tmpdir(), 'prism-media-settings-'));
const fixture = join(root, 'fixture');
mkdirSync(fixture);
mkdirSync(join(fixture, 'settings'));
mkdirSync(join(fixture, 'blocking'));
mkdirSync(join(fixture, 'media'));
cpSync(join(repo, 'prism/settings/media_controls_store.mjs'),
  join(fixture, 'settings/media_controls_store.mjs'));
cpSync(join(repo, 'prism/blocking/rule_compiler.mjs'),
  join(fixture, 'blocking/rule_compiler.mjs'));
cpSync(join(repo, 'prism/media/segment_policy.mjs'),
  join(fixture, 'media/segment_policy.mjs'));
writeFileSync(join(fixture, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Prism Media Settings Smoke',
  version: '0.1.0',
  permissions: ['storage'],
  background: {service_worker: 'worker.js'},
  content_scripts: [{matches: ['http://settings.prism.test/*'],
    js: ['content.js'], run_at: 'document_idle'}],
}));
writeFileSync(join(fixture, 'worker.js'),
  'chrome.runtime.onInstalled.addListener(() => {});');
writeFileSync(join(fixture, 'control.html'),
  '<!doctype html><script type="module" src="control.mjs"></script>');
writeFileSync(join(fixture, 'control.mjs'),
  `import {createMediaSettingsStore, defaultMediaSettings} from
     './settings/media_controls_store.mjs';
   window.prismStore = createMediaSettingsStore({
     storageArea: chrome.storage.local, incognito: chrome.extension.inIncognitoContext,
   });
   window.prismDefaults = defaultMediaSettings;`);
writeFileSync(join(fixture, 'content.js'),
  `Promise.resolve().then(() => chrome.storage.local.get('prismMediaSettingsV1'))
    .then(() => document.documentElement.dataset.prismStorageAccess = 'allowed')
    .catch(() => document.documentElement.dataset.prismStorageAccess = 'denied');`);

const server = createServer((_request, response) => {
  response.writeHead(200, {'content-type': 'text/html'});
  response.end('<!doctype html><title>Settings isolation probe</title>');
});
let context;

async function openBrowser() {
  context = await chromium.launchPersistentContext(join(root, 'profile'), {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-proxy-server',
      '--host-resolver-rules=MAP settings.prism.test 127.0.0.1',
      `--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`],
  });
  const worker = context.serviceWorkers()[0] ??
    await context.waitForEvent('serviceworker', {timeout: 10000});
  const extensionId = new URL(worker.url()).hostname;
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/control.html`);
  await control.waitForFunction(() => !!window.prismStore);
  return control;
}

async function probeContentScript() {
  const probe = await context.newPage();
  try {
    await probe.goto(`http://settings.prism.test:${server.address().port}/`);
    await probe.waitForFunction(() =>
      !!document.documentElement.dataset.prismStorageAccess);
    return await probe.evaluate(() =>
      document.documentElement.dataset.prismStorageAccess);
  } finally {
    await probe.close();
  }
}

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const control = await openBrowser();
  const saved = await control.evaluate(async () => {
    const settings = window.prismDefaults();
    settings.segments.enabled = true;
    settings.segments.categories.intro = 'manual';
    settings.adblock.enabled = true;
    settings.adblock.disabledSites = ['news.prism.test'];
    return window.prismStore.save(settings);
  });
  if (!saved.ok) {
    throw new Error(`Settings save failed: ${JSON.stringify(saved)}`);
  }
  const access = await probeContentScript();
  if (access !== 'denied') {
    throw new Error(`Content script storage access: ${access}`);
  }
  await context.close();
  context = null;

  const restartedControl = await openBrowser();
  const result = await restartedControl.evaluate(() => window.prismStore.load());
  if (result.error || !result.settings.segments.enabled ||
      result.settings.segments.categories.intro !== 'manual' ||
      !result.settings.adblock.enabled ||
      result.settings.adblock.disabledSites.join(',') !== 'news.prism.test') {
    throw new Error(`Settings did not survive restart: ${JSON.stringify(result)}`);
  }
  const restartedAccess = await probeContentScript();
  if (restartedAccess !== 'denied') {
    throw new Error(`Content script storage after restart: ${restartedAccess}`);
  }
  console.log('PASS: trusted storage, content-script denial, restart persistence');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
