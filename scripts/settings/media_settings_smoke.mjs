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
for (const file of ['media_controls.html', 'media_controls.css',
  'media_controls_ui.mjs', 'media_controls_boot.mjs']) {
  cpSync(join(repo, 'prism/settings', file),
    join(fixture, 'settings', file));
}
cpSync(join(repo, 'prism/blocking/rule_compiler.mjs'),
  join(fixture, 'blocking/rule_compiler.mjs'));
cpSync(join(repo, 'prism/media/segment_policy.mjs'),
  join(fixture, 'media/segment_policy.mjs'));
writeFileSync(join(fixture, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Prism Media Settings Smoke',
  version: '0.1.0',
  permissions: ['storage'],
  options_page: 'settings/media_controls.html',
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
  const extensionId = new URL(control.url()).hostname;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${extensionId}/settings/media_controls.html`);
  await ui.getByRole('status').getByText('Ready').waitFor();
  if (await ui.locator('#segments-enabled').isChecked() ||
      await ui.locator('#adblock-enabled').isChecked()) {
    throw new Error('Media controls did not start disabled');
  }
  await ui.locator('#segments-enabled').check();
  await ui.locator('#category-intro').selectOption('manual');
  await ui.locator('#adblock-enabled').check();
  await ui.locator('#site-input').fill('https://invalid.prism.test/path');
  await ui.locator('#add-site').click();
  if (!await ui.getByRole('status').textContent().then(value =>
      value.includes('Enter a new domain')) ||
      await ui.locator('#site-list li').count()) {
    throw new Error('The options page accepted an invalid domain');
  }
  await ui.locator('#site-input').fill('News.Prism.Test');
  await ui.locator('#site-input').press('Enter');
  await ui.locator('#site-input').fill('news.prism.test');
  await ui.locator('#add-site').click();
  if (await ui.locator('#site-list li').count() !== 1) {
    throw new Error('The options page accepted a duplicate domain');
  }
  await ui.locator('#save-settings').click();
  await ui.getByRole('status').getByText(/Saved/).waitFor();
  await ui.close();
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
  const restartedId = new URL(restartedControl.url()).hostname;
  const reopened = await context.newPage();
  await reopened.setViewportSize({width: 420, height: 900});
  await reopened.emulateMedia({colorScheme: 'dark'});
  await reopened.goto(`chrome-extension://${restartedId}/settings/media_controls.html`);
  await reopened.getByRole('status').getByText('Ready').waitFor();
  const uiState = {
    segments: await reopened.locator('#segments-enabled').isChecked(),
    intro: await reopened.locator('#category-intro').inputValue(),
    adblock: await reopened.locator('#adblock-enabled').isChecked(),
    site: await reopened.locator('#site-list li span').allTextContents(),
    overflow: await reopened.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth),
  };
  if (!uiState.segments || uiState.intro !== 'manual' ||
      !uiState.adblock || uiState.site.join(',') !== 'news.prism.test' ||
      uiState.overflow) {
    throw new Error(`Options page did not restore: ${JSON.stringify(uiState)}`);
  }
  await reopened.screenshot({path: join(repo,
    'docs/evidence/media-controls-linux-20261013.png'), fullPage: true});
  await reopened.getByRole('button', {name: 'Remove news.prism.test'}).click();
  await reopened.locator('#save-settings').click();
  const removed = await restartedControl.evaluate(() => window.prismStore.load());
  if (removed.error || removed.settings.adblock.disabledSites.length !== 0) {
    throw new Error(`Excluded site removal failed: ${JSON.stringify(removed)}`);
  }
  await reopened.close();
  await restartedControl.evaluate(() => chrome.storage.local.set({
    prismMediaSettingsV1: {version: 2},
  }));
  const damaged = await context.newPage();
  await damaged.goto(`chrome-extension://${restartedId}/settings/media_controls.html`);
  await damaged.getByRole('status').getByText(/unavailable/).waitFor();
  if (!await damaged.locator('#save-settings').isDisabled()) {
    throw new Error('Damaged settings did not disable the options form');
  }
  await damaged.close();
  console.log('PASS: media controls UI, validation/removal, failed-load lock, trusted storage, restart and narrow dark view');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
