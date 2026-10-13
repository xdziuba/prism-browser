#!/usr/bin/env node
// Tests startup reconciliation with synthetic signed DNR rules after restart.
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

const root = mkdtempSync(join(tmpdir(), 'prism-rule-startup-'));
const fixture = join(root, 'fixture');
for (const path of [fixture, join(fixture, 'blocking'),
  join(fixture, 'settings'), join(fixture, 'media')]) {
  mkdirSync(path);
}
for (const file of ['rule_compiler.mjs', 'rule_activation.mjs',
  'signed_rule_update.mjs', 'startup_reconciliation.mjs',
  'signed_package_store.mjs']) {
  cpSync(join(repo, 'prism/blocking', file), join(fixture, 'blocking', file));
}
cpSync(join(repo, 'prism/settings/media_controls_store.mjs'),
  join(fixture, 'settings/media_controls_store.mjs'));
cpSync(join(repo, 'prism/media/segment_policy.mjs'),
  join(fixture, 'media/segment_policy.mjs'));

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
  name: 'Prism Startup Reconciliation Smoke',
  version: '0.1.0',
  permissions: ['storage', 'declarativeNetRequest'],
  background: {service_worker: 'worker.js'},
}));
writeFileSync(join(fixture, 'worker.js'),
  'chrome.runtime.onInstalled.addListener(() => {});');
writeFileSync(join(fixture, 'control.html'),
  '<!doctype html><script type="module" src="control.mjs"></script>');
writeFileSync(join(fixture, 'control.mjs'),
  `import {createMediaSettingsStore, defaultMediaSettings} from
     './settings/media_controls_store.mjs';
   import {reconcileAdblockStartup} from
     './blocking/startup_reconciliation.mjs';
   import {createSignedPackageStore, SIGNED_PACKAGE_KEY} from
     './blocking/signed_package_store.mjs';
   import {envelope, publicKey} from './signed_data.mjs';
   const store = createMediaSettingsStore({storageArea: chrome.storage.local,
     incognito: chrome.extension.inIncognitoContext});
   window.prismDefaults = defaultMediaSettings;
   window.prismStore = store;
   window.prismRules = () => chrome.declarativeNetRequest.getDynamicRules();
   window.prismPackageStore = createSignedPackageStore({
     storageArea: chrome.storage.local,
     trustedKeys: new Map([['test-key',
       {sourceId: 'prism.synthetic', publicKey}]]),
     incognito: chrome.extension.inIncognitoContext,
   });
   window.prismSavePackage = () => window.prismPackageStore.save(envelope);
   window.prismTamperPackage = () => chrome.storage.local.set({
     [SIGNED_PACKAGE_KEY]: {version: 1,
       envelope: {...envelope, signature: 'AA'}},
   });
   window.prismRestorePackage = async () => {
     await chrome.storage.local.remove(SIGNED_PACKAGE_KEY);
     return window.prismSavePackage();
   };
   window.prismReconcile = () => reconcileAdblockStartup({
     settingsStore: store,
     loadSignedEnvelope: async () =>
       (await window.prismPackageStore.load()).envelope,
     trustedKeys: new Map([['test-key',
       {sourceId: 'prism.synthetic', publicKey}]]),
     dnrApi: chrome.declarativeNetRequest,
     incognito: chrome.extension.inIncognitoContext,
   });`);

const server = createServer((request, response) => {
  if (request.url === '/probe.js') {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end('window.prismStartupProbeLoaded = true;');
  } else {
    response.writeHead(200, {'content-type': 'text/html'});
    response.end('<!doctype html><title>Prism rule startup probe</title>');
  }
});
let context;

async function openBrowser() {
  context = await chromium.launchPersistentContext(join(root, 'profile'), {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-proxy-server',
      '--host-resolver-rules=MAP ads.prism.test 127.0.0.1,' +
      'MAP blocked.prism.test 127.0.0.1,' +
      'MAP allowed.prism.test 127.0.0.1',
      `--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`],
  });
  const worker = context.serviceWorkers()[0] ??
    await context.waitForEvent('serviceworker', {timeout: 10000});
  const extensionId = new URL(worker.url()).hostname;
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/control.html`);
  await control.waitForFunction(() => !!window.prismReconcile);
  return control;
}

async function probe(host) {
  const page = await context.newPage();
  try {
    await page.goto(`http://${host}:${server.address().port}/`);
    try {
      await page.addScriptTag({url: `http://ads.prism.test:${server.address().port}/probe.js`});
    } catch {
      // A blocked script is expected on one test site.
    }
    return await page.evaluate(() => !!window.prismStartupProbeLoaded);
  } finally {
    await page.close();
  }
}

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const control = await openBrowser();
  const first = await control.evaluate(async () => {
    const settings = window.prismDefaults();
    settings.adblock.enabled = true;
    settings.adblock.disabledSites = ['allowed.prism.test'];
    const saved = await window.prismStore.save(settings);
    const cached = saved.ok ? await window.prismSavePackage() : saved;
    return cached.ok ? window.prismReconcile() : cached;
  });
  const blocked = await probe('blocked.prism.test');
  const excluded = await probe('allowed.prism.test');
  if (!first.ok || blocked || !excluded) {
    throw new Error(`Initial DNR state: ${JSON.stringify({first, blocked, excluded})}`);
  }
  await context.close();
  context = null;

  const restarted = await openBrowser();
  const before = await restarted.evaluate(async () => ({
    settings: await window.prismStore.load(),
    package: await window.prismPackageStore.load(),
    rules: await window.prismRules(),
  }));
  const reverified = await restarted.evaluate(() => window.prismReconcile());
  if (before.settings.error || !before.settings.settings.adblock.enabled ||
      before.package.error ||
      before.package.candidate?.provenance.version !== '1.0.0' ||
      before.rules.length !== 1 || !reverified.ok ||
      await probe('blocked.prism.test')) {
    throw new Error(`Restart DNR state: ${JSON.stringify({before, reverified})}`);
  }
  const tampered = await restarted.evaluate(async () => {
    await window.prismTamperPackage();
    const result = await window.prismReconcile();
    return {result, cache: await window.prismPackageStore.load()};
  });
  const afterTamper = await restarted.evaluate(() => window.prismRules());
  if (tampered.result.error !== 'package_unavailable' ||
      tampered.cache.error !== 'invalid_package' || afterTamper.length ||
      !await probe('blocked.prism.test')) {
    throw new Error(`Tampered package was not cleared: ${JSON.stringify({
      tampered, afterTamper,
    })}`);
  }
  const restored = await restarted.evaluate(async () => {
    const saved = await window.prismRestorePackage();
    return saved.ok ? window.prismReconcile() : saved;
  });
  if (!restored.ok || await probe('blocked.prism.test')) {
    throw new Error(`Valid package did not restore rules: ${JSON.stringify(restored)}`);
  }
  const disabled = await restarted.evaluate(async () => {
    const settings = (await window.prismStore.load()).settings;
    settings.adblock.enabled = false;
    const saved = await window.prismStore.save(settings);
    return saved.ok ? window.prismReconcile() : saved;
  });
  const cleared = await restarted.evaluate(() => window.prismRules());
  if (!disabled.ok || disabled.state !== 'disabled' || cleared.length ||
      !await probe('blocked.prism.test')) {
    throw new Error(`Disable did not clear DNR: ${JSON.stringify({
      disabled, cleared,
    })}`);
  }
  console.log('PASS: signed package cache, DNR restart, tamper and disable clear');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
