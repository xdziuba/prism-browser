#!/usr/bin/env node
// Runs the staged product resources in the pinned source-built Chromium.
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) {
  throw new Error('The browser must come from the full Chromium checkout');
}
const expected = JSON.parse(readFileSync(join(repo, 'chromium.lock.json'),
  'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'],
  {encoding: 'utf8'}).trim();
if (actual !== expected) {
  throw new Error(`Chromium source is ${actual}, expected ${expected}`);
}

const videoId = 'abcdefghijk';
const root = mkdtempSync(join(tmpdir(), 'prism-bundled-component-'));
const videoPath = join(root, 'synthetic.webm');
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
  '-i', 'testsrc=size=32x32:rate=10:duration=3', '-c:v', 'libvpx',
  '-g', '1', '-b:v', '100k', '-an', '-y', videoPath,
], {timeout: 30000});
const videoData = readFileSync(videoPath).toString('base64');

function stage(name, synthetic) {
  const fixture = join(root, name);
  mkdirSync(fixture);
  for (const directory of ['component', 'settings', 'blocking', 'media']) {
    cpSync(join(repo, 'prism', directory), join(fixture, directory),
      {recursive: true});
  }
  cpSync(join(repo, 'prism/component/manifest.json'),
    join(fixture, 'manifest.json'));
  if (synthetic) {
    writeFileSync(join(fixture, 'component/worker.mjs'),
      `import {registerBundledComponentWorker} from './worker_runtime.mjs';
       registerBundledComponentWorker({runtime: chrome.runtime,
         storageArea: chrome.storage.local,
         dnrApi: chrome.declarativeNetRequest,
         incognito: chrome.extension.inIncognitoContext,
         fetchPrefix: async () => [{videoID: ${JSON.stringify(videoId)},
           segments: [{segment: [0.5, 2.5], category: 'sponsor',
             UUID: 'synthetic-1', actionType: 'skip'}]}]});`);
  }
  return fixture;
}

async function run(fixture, name, synthetic) {
  const context = await chromium.launchPersistentContext(
    join(root, `${name}-profile`), {
      executablePath: binary,
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--disable-extensions-except=${fixture}`,
        `--load-extension=${fixture}`, '--no-proxy-server',
        '--host-resolver-rules=MAP www.youtube.com 127.0.0.1'],
    });
  try {
    await context.route('https://www.youtube.com/**', route =>
      route.fulfill({status: 200, contentType: 'text/html',
        body: `<!doctype html><title>Synthetic watch page</title>
          <div id="movie_player"><video class="html5-main-video"
          src="data:video/webm;base64,${videoData}" preload="auto"></video></div>`,
      }));
    const worker = context.serviceWorkers()[0] ??
      await context.waitForEvent('serviceworker', {timeout: 10000});
    const extensionId = new URL(worker.url()).hostname;
    const options = await context.newPage();
    await options.goto(
      `chrome-extension://${extensionId}/settings/media_controls.html`);
    await options.locator('#form-status').getByText('Ready').waitFor();
    await options.locator('#rule-status')
      .getByText('Off · no rules installed.').waitFor();
    if (await options.locator('#segments-enabled').isChecked() ||
        await options.locator('#adblock-enabled').isChecked()) {
      throw new Error('The staged component did not default to off');
    }
    await options.locator('#segments-enabled').check();
    if (!synthetic) await options.locator('#adblock-enabled').check();
    await options.locator('#save-settings').click();
    await options.locator('#form-status').getByText(/Saved/).waitFor();
    if (!synthetic) {
      await options.locator('#rule-status')
        .getByText('No verified rule package is available.').waitFor();
      const rules = await options.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules());
      if (rules.length !== 0) throw new Error('Untrusted DNR rules activated');
    }

    const page = await context.newPage();
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
    await page.waitForFunction(() =>
      document.querySelector('video')?.readyState >= 1);
    if (synthetic) {
      let visible = false;
      for (let attempt = 0; attempt < 20 && !visible; ++attempt) {
        await page.locator('video').evaluate(video => {
          video.currentTime = 0.7;
          video.dispatchEvent(new Event('timeupdate'));
        });
        visible = await page.getByRole('button', {name: 'Undo skip'})
          .isVisible();
        if (!visible) await page.waitForTimeout(100);
      }
      if (!visible) throw new Error('Product content script did not skip');
      const skipped = await page.locator('video').evaluate(video =>
        video.currentTime);
      if (skipped < 2.4) throw new Error('Synthetic segment did not seek');
      await page.getByRole('button', {name: 'Undo skip'}).click();
      await page.waitForFunction(() =>
        document.querySelector('video').currentTime < 1);
    } else {
      await page.locator('video').evaluate(video => {
        video.currentTime = 0.7;
        video.dispatchEvent(new Event('timeupdate'));
      });
      await page.waitForTimeout(350);
      if (await page.locator('[data-prism-media-control]').count()) {
        throw new Error('A provider-free product worker showed a control');
      }
    }
  } finally {
    await context.close();
  }
}

try {
  await run(stage('production', false), 'production', false);
  await run(stage('synthetic', true), 'synthetic', true);
  console.log('PASS: staged manifest, inert product worker, synthetic content skip and Undo');
} finally {
  rmSync(root, {recursive: true, force: true});
}
