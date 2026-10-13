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
  'segment_policy.mjs', 'youtube_site_adapter.mjs',
  'watch_playback_session.mjs', 'playback_controller.mjs',
  'playback_controls.mjs']) {
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
  web_accessible_resources: [{resources: ['media/*.mjs'],
    matches: ['https://www.youtube.com/*']}],
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
         segment: [0.5, 2.5], category: 'sponsor', UUID: 'synthetic-1',
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
  `if (new URL(location.href).searchParams.has('playback')) {
     Promise.all([
       import(chrome.runtime.getURL('media/watch_playback_session.mjs')),
       import(chrome.runtime.getURL('media/playback_controls.mjs')),
     ]).then(([{createWatchPlaybackSession}, {createPlaybackControls}]) => {
         let session;
         const controls = createPlaybackControls({document,
           onSkip: () => session?.skipManual(),
           onUndo: () => session?.undo(),
         });
         session = createWatchPlaybackSession({
           root: document, events: window, readURL: () => location.href,
           requestSegments: duration => chrome.runtime.sendMessage({
             type: 'prism.media.lookup', duration,
           }),
           onDecision: decision => {
             controls.show(decision);
             document.documentElement.dataset.prismDecision =
               JSON.stringify(decision);
           },
           incognito: chrome.extension.inIncognitoContext,
         });
         session.start();
         window.addEventListener('pagehide', () => {
           session.stop();
           controls.stop();
         }, {once: true});
         document.documentElement.dataset.prismSession = 'ready';
       }).catch(error => {
         document.documentElement.dataset.prismSession = error.message;
       });
   } else {
     chrome.runtime.sendMessage({type: 'prism.media.lookup', duration: 100})
       .then(result => document.documentElement.dataset.prismLookup =
         JSON.stringify(result))
       .catch(() => document.documentElement.dataset.prismLookup =
         JSON.stringify({error: 'message_failed'}));
   }`);
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
const videoPath = join(root, 'synthetic.webm');
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
  '-i', 'testsrc=size=32x32:rate=10:duration=3', '-c:v', 'libvpx',
  '-g', '1', '-b:v', '100k', '-an', '-y', videoPath,
], {timeout: 30000});
const videoData = readFileSync(videoPath).toString('base64');

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
      body: route.request().url().includes('playback=') ?
        `<!doctype html><title>Synthetic playback</title>
         <div id="movie_player"><video class="html5-main-video"
         src="data:video/webm;base64,${videoData}" preload="auto"></video></div>` :
        '<!doctype html><title>Synthetic watch page</title>'}));
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
  const enabledAgain = await control.evaluate(async () => {
    const settings = (await window.prismStore.load()).settings;
    settings.segments.enabled = true;
    return window.prismStore.save(settings);
  });
  if (!enabledAgain.ok) {
    throw new Error('Could not re-enable synthetic media settings');
  }
  const playback = await context.newPage();
  try {
    await playback.goto(`https://www.youtube.com/watch?v=${videoId}&playback=1`);
    await playback.waitForFunction(() =>
      document.documentElement.dataset.prismSession === 'ready',
    null, {timeout: 10000});
    await playback.waitForFunction(() =>
      document.querySelector('video')?.readyState >= 1);
    await playback.locator('video').evaluate(video => {
      video.currentTime = 0.7;
      video.dispatchEvent(new Event('timeupdate'));
    });
    await playback.waitForFunction(() =>
      document.querySelector('video').currentTime > 2.4,
    null, {timeout: 10000});
    const decision = await playback.evaluate(() =>
      JSON.parse(document.documentElement.dataset.prismDecision));
    if (decision?.kind !== 'auto' || decision.videoId !== videoId) {
      throw new Error(`Unexpected playback decision: ${JSON.stringify(decision)}`);
    }
    await playback.locator('[data-prism-media-control] button',
      {hasText: 'Undo skip'}).waitFor();
    await playback.locator('#movie_player').evaluate(player =>
      player.classList.add('ad-showing'));
    await playback.waitForTimeout(100);
    if (await playback.locator('[data-prism-media-control]').count()) {
      throw new Error('Playback control remained visible during an ad');
    }
    await playback.locator('video').evaluate(video => {
      video.currentTime = 0.7;
      video.dispatchEvent(new Event('timeupdate'));
    });
    await playback.waitForTimeout(100);
    const adTime = await playback.locator('video').evaluate(video =>
      video.currentTime);
    if (adTime > 0.9) {
      throw new Error(`Seek ran during synthetic ad state: ${adTime}`);
    }
    await playback.locator('#movie_player').evaluate(player =>
      player.classList.remove('ad-showing'));
    await playback.waitForFunction(() =>
      document.querySelector('video').currentTime > 2.4,
    null, {timeout: 10000});
    await playback.getByRole('button', {name: 'Undo skip'}).click();
    await playback.waitForFunction(() =>
      document.querySelector('video').currentTime < 1);
    await playback.waitForTimeout(100);
    if (await playback.locator('video').evaluate(video =>
        video.currentTime) > 1 ||
        await playback.locator('[data-prism-media-control]').count()) {
      throw new Error('Undo did not suppress immediate repeat or hide control');
    }
  } finally {
    await playback.close();
  }
  const manualEnabled = await control.evaluate(async () => {
    const settings = (await window.prismStore.load()).settings;
    settings.segments.categories.sponsor = 'manual';
    return window.prismStore.save(settings);
  });
  if (!manualEnabled.ok) throw new Error('Could not set manual category');
  const manualPage = await context.newPage();
  try {
    await manualPage.goto(
      `https://www.youtube.com/watch?v=${videoId}&playback=manual`);
    await manualPage.waitForFunction(() =>
      document.documentElement.dataset.prismSession === 'ready');
    await manualPage.waitForFunction(() =>
      document.querySelector('video')?.readyState >= 1);
    await manualPage.locator('video').evaluate(video => {
      video.currentTime = 0.7;
      video.dispatchEvent(new Event('timeupdate'));
    });
    await manualPage.getByRole('button',
      {name: 'Skip sponsor segment'}).click();
    await manualPage.waitForFunction(() =>
      document.querySelector('video').currentTime > 2.4);
    if (await manualPage.locator('[data-prism-media-control]').count()) {
      throw new Error('Manual skip control remained after activation');
    }
  } finally {
    await manualPage.close();
  }
  const disabledAgain = await control.evaluate(async () => {
    const settings = (await window.prismStore.load()).settings;
    settings.segments.enabled = false;
    return window.prismStore.save(settings);
  });
  if (!disabledAgain.ok) throw new Error('Could not disable controls');
  const disabledPage = await context.newPage();
  try {
    await disabledPage.goto(
      `https://www.youtube.com/watch?v=${videoId}&playback=disabled`);
    await disabledPage.waitForFunction(() =>
      document.documentElement.dataset.prismSession === 'ready');
    await disabledPage.waitForFunction(() =>
      document.querySelector('video')?.readyState >= 1);
    await disabledPage.locator('video').evaluate(video => {
      video.currentTime = 0.7;
      video.dispatchEvent(new Event('timeupdate'));
    });
    await disabledPage.waitForTimeout(150);
    if (await disabledPage.locator('[data-prism-media-control]').count()) {
      throw new Error('Disabled media controls rendered a button');
    }
  } finally {
    await disabledPage.close();
  }
  console.log('PASS: browser sender validation, synthetic lookup, auto/undo and manual controls, ad suspension');
} finally {
  await context?.close();
  rmSync(root, {recursive: true, force: true});
}
