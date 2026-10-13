#!/usr/bin/env node
// Exercises the privileged content-script lookup boundary in pinned Chromium.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, realpathSync, existsSync,
  cpSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {hashVideoIdPrefix} from '../../prism/media/segment_policy.mjs';

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

const videoId = 'abcdefghijk';
const prefix = await hashVideoIdPrefix(videoId);
const root = mkdtempSync(join(tmpdir(), 'prism-segment-message-'));
const fixture = join(root, 'fixture');
for (const path of [fixture, join(fixture, 'media'),
  join(fixture, 'settings'), join(fixture, 'blocking')]) {
  mkdirSync(path);
}
for (const file of ['segment_message_bridge.mjs', 'segment_lookup.mjs',
  'segment_policy.mjs', 'youtube_site_adapter.mjs']) {
  cpSync(join(repo, 'prism/media', file), join(fixture, 'media', file));
}
cpSync(join(repo, 'prism/settings/media_controls_store.mjs'),
  join(fixture, 'settings/media_controls_store.mjs'));
cpSync(join(repo, 'prism/blocking/rule_compiler.mjs'),
  join(fixture, 'blocking/rule_compiler.mjs'));
writeFileSync(join(fixture, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Prism Segment Message Smoke',
  version: '0.1.0',
  permissions: ['storage'],
  host_permissions: ['https://www.youtube.com/*'],
  background: {service_worker: 'worker.mjs', type: 'module'},
  content_scripts: [{matches: ['https://www.youtube.com/*'],
    js: ['content.js'], run_at: 'document_idle'}],
}));
writeFileSync(join(fixture, 'worker.mjs'),
  `import {createMediaSettingsStore} from './settings/media_controls_store.mjs';
   import {createSegmentMessageHandler} from './media/segment_message_bridge.mjs';
   const handler = createSegmentMessageHandler({
     extensionId: chrome.runtime.id,
     incognito: chrome.extension.inIncognitoContext,
     settingsStore: createMediaSettingsStore({
       storageArea: chrome.storage.local,
       incognito: chrome.extension.inIncognitoContext,
     }),
     fetchPrefix: async prefix => {
       if (prefix !== ${JSON.stringify(prefix)}) throw new Error('bad prefix');
       return [{videoID: ${JSON.stringify(videoId)}, segments: [{
         segment: [10, 20], category: 'sponsor', UUID: 'synthetic-1',
         actionType: 'skip',
       }]}];
     },
   });
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     handler(message, sender).then(sendResponse).catch(() =>
       sendResponse({segments: [], rejected: 0, error: 'handler_error'}));
     return true;
   });`);
writeFileSync(join(fixture, 'content.js'),
  `chrome.runtime.sendMessage({type: 'prism.media.lookup', duration: 100})
    .then(result => document.documentElement.dataset.prismLookup =
      JSON.stringify(result))
    .catch(() => document.documentElement.dataset.prismLookup =
      JSON.stringify({error: 'message_failed'}));`);
writeFileSync(join(fixture, 'control.html'),
  '<!doctype html><script type="module" src="control.mjs"></script>');
writeFileSync(join(fixture, 'control.mjs'),
  `import {createMediaSettingsStore, defaultMediaSettings} from
     './settings/media_controls_store.mjs';
   window.prismStore = createMediaSettingsStore({
     storageArea: chrome.storage.local,
     incognito: chrome.extension.inIncognitoContext,
   });
   window.prismDefaults = defaultMediaSettings;`);
let context;

async function probe(path) {
  const page = await context.newPage();
  try {
    await page.goto(`https://www.youtube.com/${path}`);
    await page.waitForFunction(() => !!document.documentElement.dataset.prismLookup);
    return JSON.parse(await page.evaluate(() =>
      document.documentElement.dataset.prismLookup));
  } finally {
    await page.close();
  }
}

try {
  context = await chromium.launchPersistentContext(join(root, 'profile'), {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-proxy-server',
      '--host-resolver-rules=MAP www.youtube.com 127.0.0.1',
      `--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`],
  });
  await context.route('https://www.youtube.com/**', route =>
    route.fulfill({status: 200, contentType: 'text/html',
      body: '<!doctype html><title>Synthetic watch page</title>'}));
  const worker = context.serviceWorkers()[0] ??
    await context.waitForEvent('serviceworker', {timeout: 10000});
  const extensionId = new URL(worker.url()).hostname;
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/control.html`);
  await control.waitForFunction(() => !!window.prismStore);
  const saved = await control.evaluate(async () => {
    const settings = window.prismDefaults();
    settings.segments.enabled = true;
    return window.prismStore.save(settings);
  });
  const authorized = await probe(`watch?v=${videoId}`);
  const ambiguous = await probe(`watch?v=${videoId}&v=${videoId}`);
  const disabled = await control.evaluate(async () => {
    const settings = (await window.prismStore.load()).settings;
    settings.segments.enabled = false;
    return window.prismStore.save(settings);
  });
  const afterDisable = await probe(`watch?v=${videoId}`);
  if (!saved.ok || authorized.error !== null ||
      authorized.segments.length !== 1 ||
      authorized.segments[0].uuid !== 'synthetic-1' ||
      ambiguous.error !== 'unauthorized' || !disabled.ok ||
      afterDisable.error !== 'disabled') {
    throw new Error(`Unexpected message boundary: ${JSON.stringify({
      saved, authorized, ambiguous, disabled, afterDisable,
    })}`);
  }
  console.log('PASS: browser sender validation, synthetic lookup, disable');
} finally {
  await context?.close();
  rmSync(root, {recursive: true, force: true});
}
