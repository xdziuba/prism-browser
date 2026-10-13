#!/usr/bin/env node
// Tests storage isolation and restart persistence in the pinned source build.
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
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
mkdirSync(join(fixture, 'component'));
cpSync(join(repo, 'prism/component/worker_runtime.mjs'),
  join(fixture, 'component/worker_runtime.mjs'));
cpSync(join(repo, 'prism/settings/media_controls_store.mjs'),
  join(fixture, 'settings/media_controls_store.mjs'));
cpSync(join(repo, 'prism/settings/settings_change_bridge.mjs'),
  join(fixture, 'settings/settings_change_bridge.mjs'));
cpSync(join(repo, 'prism/settings/settings_message.mjs'),
  join(fixture, 'settings/settings_message.mjs'));
for (const file of ['media_controls.html', 'media_controls.css',
  'media_controls_ui.mjs', 'media_controls_boot.mjs']) {
  cpSync(join(repo, 'prism/settings', file),
    join(fixture, 'settings', file));
}
for (const file of ['rule_compiler.mjs', 'rule_activation.mjs',
  'signed_rule_update.mjs', 'startup_reconciliation.mjs',
  'signed_package_store.mjs', 'signed_rule_coordinator.mjs',
  'adblock_rule_owner.mjs', 'rule_diagnostics.mjs']) {
  cpSync(join(repo, 'prism/blocking', file), join(fixture, 'blocking', file));
}
for (const file of ['segment_policy.mjs', 'segment_lookup.mjs',
  'segment_message_bridge.mjs', 'youtube_site_adapter.mjs']) {
  cpSync(join(repo, 'prism/media', file), join(fixture, 'media', file));
}
const pair = await webcrypto.subtle.generateKey('Ed25519', true,
  ['sign', 'verify']);
const publicKey = new Uint8Array(await webcrypto.subtle.exportKey('raw',
  pair.publicKey));
const payload = new TextEncoder().encode(JSON.stringify({
  sourceId: 'prism.synthetic', version: '1.0.0', rules: [{
    id: 1, destinationHost: 'ads.prism.test', resourceTypes: ['script'],
  }],
}));
const signature = new Uint8Array(await webcrypto.subtle.sign('Ed25519',
  pair.privateKey, payload));
const envelope = {keyId: 'test-key',
  payload: Buffer.from(payload).toString('base64url'),
  signature: Buffer.from(signature).toString('base64url')};
writeFileSync(join(fixture, 'signed_data.mjs'),
  `export const envelope = ${JSON.stringify(envelope)};\n` +
  `export const publicKey = new Uint8Array(${JSON.stringify([...publicKey])});\n`);
writeFileSync(join(fixture, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Prism Media Settings Smoke',
  version: '0.1.0',
  permissions: ['storage', 'declarativeNetRequest'],
  options_page: 'settings/media_controls.html',
  background: {service_worker: 'worker.mjs', type: 'module'},
  content_scripts: [{matches: ['http://settings.prism.test/*'],
    js: ['content.js'], run_at: 'document_idle'}],
}));
writeFileSync(join(fixture, 'worker.mjs'),
  `import {registerBundledComponentWorker} from
     './component/worker_runtime.mjs';
   import {publicKey} from './signed_data.mjs';
   const trustedKeys = new Map([['test-key',
     {sourceId: 'prism.synthetic', publicKey}]]);
   registerBundledComponentWorker({runtime: chrome.runtime,
     storageArea: chrome.storage.local, dnrApi: chrome.declarativeNetRequest,
     incognito: chrome.extension.inIncognitoContext, trustedKeys});`);
writeFileSync(join(fixture, 'control.html'),
  '<!doctype html><script type="module" src="control.mjs"></script>');
writeFileSync(join(fixture, 'control.mjs'),
  `import {createMediaSettingsStore, defaultMediaSettings} from
     './settings/media_controls_store.mjs';
   window.prismStore = createMediaSettingsStore({
     storageArea: chrome.storage.local, incognito: chrome.extension.inIncognitoContext,
   });
   window.prismDefaults = defaultMediaSettings;
   window.prismRules = () => chrome.declarativeNetRequest.getDynamicRules();
   import {createSignedPackageStore} from './blocking/signed_package_store.mjs';
   import {envelope, publicKey} from './signed_data.mjs';
   const packageStore = createSignedPackageStore({storageArea: chrome.storage.local,
     trustedKeys: new Map([['test-key',
       {sourceId: 'prism.synthetic', publicKey}]]), incognito: false});
   window.prismSavePackage = () => packageStore.save(envelope);`);
writeFileSync(join(fixture, 'content.js'),
  `Promise.resolve().then(() => chrome.storage.local.get('prismMediaSettingsV1'))
    .then(() => document.documentElement.dataset.prismStorageAccess = 'allowed')
    .catch(() => document.documentElement.dataset.prismStorageAccess = 'denied');
   chrome.runtime.sendMessage({type: 'prism.settings.apply'}).then(result =>
     document.documentElement.dataset.prismApplyAccess = result.error);`);

const server = createServer((request, response) => {
  if (request.url === '/probe.js') {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end('window.prismSettingsProbeLoaded = true;');
  } else {
    response.writeHead(200, {'content-type': 'text/html'});
    response.end('<!doctype html><title>Settings isolation probe</title>');
  }
});
let context;

async function openBrowser() {
  context = await chromium.launchPersistentContext(join(root, 'profile'), {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-proxy-server',
      '--host-resolver-rules=MAP settings.prism.test 127.0.0.1,' +
        'MAP ads.prism.test 127.0.0.1,MAP blocked.prism.test 127.0.0.1,' +
        'MAP news.prism.test 127.0.0.1',
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
    await probe.waitForFunction(() =>
      !!document.documentElement.dataset.prismApplyAccess);
    return await probe.evaluate(() => ({
      storage: document.documentElement.dataset.prismStorageAccess,
      apply: document.documentElement.dataset.prismApplyAccess,
    }));
  } finally {
    await probe.close();
  }
}

async function probeRule(host) {
  const page = await context.newPage();
  try {
    await page.goto(`http://${host}:${server.address().port}/`);
    try {
      await page.addScriptTag({url:
        `http://ads.prism.test:${server.address().port}/probe.js`});
    } catch {
      // DNR rejects this script on a blocked site.
    }
    return page.evaluate(() => !!window.prismSettingsProbeLoaded);
  } finally {
    await page.close();
  }
}

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const control = await openBrowser();
  const packageResult = await control.evaluate(() => window.prismSavePackage());
  if (!packageResult.ok) {
    throw new Error(`Synthetic package cache: ${JSON.stringify(packageResult)}`);
  }
  const extensionId = new URL(control.url()).hostname;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${extensionId}/settings/media_controls.html`);
  await ui.locator('#form-status').getByText('Ready').waitFor();
  await ui.locator('#rule-status').getByText('Off · no rules installed.').waitFor();
  if (await ui.locator('#segments-enabled').isChecked() ||
      await ui.locator('#adblock-enabled').isChecked()) {
    throw new Error('Media controls did not start disabled');
  }
  await ui.locator('#segments-enabled').check();
  await ui.locator('#category-intro').selectOption('manual');
  await ui.locator('#adblock-enabled').check();
  await ui.locator('#site-input').fill('https://invalid.prism.test/path');
  await ui.locator('#add-site').click();
  if (!await ui.locator('#form-status').textContent().then(value =>
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
  await ui.locator('#form-status').getByText(/Saved. Ad blocking updated/).waitFor();
  await ui.locator('#rule-status').getByText(
    'Active · 1 rule · prism.synthetic 1.0.0').waitFor();
  const activated = await control.evaluate(() => window.prismRules());
  if (activated.length !== 1 ||
      !activated[0].condition.excludedTopDomains.includes('news.prism.test')) {
    throw new Error(`Settings were not applied to DNR: ${JSON.stringify(activated)}`);
  }
  if (await probeRule('settings.prism.test') ||
      !await probeRule('news.prism.test')) {
    throw new Error('The excluded site did not bypass the active rule');
  }
  await ui.close();
  const access = await probeContentScript();
  if (access.storage !== 'denied' || access.apply !== 'unauthorized') {
    throw new Error(`Content script access: ${JSON.stringify(access)}`);
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
  if (restartedAccess.storage !== 'denied' ||
      restartedAccess.apply !== 'unauthorized') {
    throw new Error(`Content script access after restart: ${JSON.stringify(restartedAccess)}`);
  }
  const restartedId = new URL(restartedControl.url()).hostname;
  const reopened = await context.newPage();
  await reopened.setViewportSize({width: 420, height: 900});
  await reopened.emulateMedia({colorScheme: 'dark'});
  await reopened.goto(`chrome-extension://${restartedId}/settings/media_controls.html`);
  await reopened.locator('#form-status').getByText('Ready').waitFor();
  await reopened.locator('#rule-status').getByText(
    'Active · 1 rule · prism.synthetic 1.0.0').waitFor();
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
  await reopened.locator('#form-status').getByText(/Saved. Ad blocking updated/).waitFor();
  const removed = await restartedControl.evaluate(() => window.prismStore.load());
  const rulesAfterRemoval = await restartedControl.evaluate(() => window.prismRules());
  if (removed.error || removed.settings.adblock.disabledSites.length !== 0 ||
      rulesAfterRemoval.length !== 1 ||
      rulesAfterRemoval[0].condition.excludedTopDomains?.length) {
    throw new Error(`Excluded site removal failed: ${JSON.stringify(removed)}`);
  }
  if (await probeRule('news.prism.test')) {
    throw new Error('Removing the exclusion did not block the script');
  }
  await restartedControl.evaluate(() =>
    chrome.storage.local.remove('prismSignedRulesV1'));
  await reopened.locator('#save-settings').click();
  await reopened.locator('#form-status').getByText(
    'Saved, but ad blocking could not be applied.').waitFor();
  await reopened.locator('#rule-status').getByText(
    'No verified rule package is available.').waitFor();
  if (await restartedControl.evaluate(() => window.prismRules()).then(r => r.length)) {
    throw new Error('Missing signed package did not clear active DNR');
  }
  await reopened.locator('#adblock-enabled').uncheck();
  await reopened.locator('#save-settings').click();
  await reopened.locator('#form-status').getByText(/Saved. Ad blocking updated/).waitFor();
  await reopened.locator('#rule-status').getByText(
    'Off · no rules installed.').waitFor();
  if (await restartedControl.evaluate(() => window.prismRules()).then(r => r.length)) {
    throw new Error('Disabling ad blocking did not immediately clear DNR');
  }
  if (!await probeRule('settings.prism.test')) {
    throw new Error('Disabling ad blocking did not release the script');
  }
  await reopened.close();
  await restartedControl.evaluate(() => chrome.storage.local.set({
    prismMediaSettingsV1: {version: 2},
  }));
  const damaged = await context.newPage();
  await damaged.goto(`chrome-extension://${restartedId}/settings/media_controls.html`);
  await damaged.locator('#form-status').getByText(/unavailable/).waitFor();
  if (!await damaged.locator('#save-settings').isDisabled()) {
    throw new Error('Damaged settings did not disable the options form');
  }
  await damaged.close();
  console.log('PASS: media controls UI, authenticated immediate DNR apply, exclusion/removal/disable, storage isolation, restart and narrow dark view');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
