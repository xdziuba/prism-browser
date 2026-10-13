import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from 'playwright';

const browserPath = process.argv[2];
if (!browserPath) {
  throw new Error('Pass the source-built Chromium executable as argument');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
                          '../..');
const temp = await mkdtemp(path.join(tmpdir(), 'prism-media-smoke-'));
let browser;
let server;

try {
  const videoPath = path.join(temp, 'video.webm');
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc=size=32x32:rate=10:duration=3', '-c:v', 'libvpx',
    '-g', '1', '-b:v', '100k', '-an', '-y', videoPath,
  ], {timeout: 30000});

  const resources = new Map([
    ['/video.webm', [videoPath, 'video/webm']],
    ['/prism/media/playback_controller.mjs',
      [path.join(root, 'prism/media/playback_controller.mjs'),
       'text/javascript']],
    ['/prism/media/segment_policy.mjs',
      [path.join(root, 'prism/media/segment_policy.mjs'),
       'text/javascript']],
    ['/prism/media/youtube_site_adapter.mjs',
      [path.join(root, 'prism/media/youtube_site_adapter.mjs'),
       'text/javascript']],
  ]);
  server = createServer(async (request, response) => {
    if (request.url === '/') {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end('<div id="movie_player"><video class="html5-main-video" id="video" src="/video.webm" preload="auto"></video></div>');
      return;
    }
    const resource = resources.get(request.url);
    if (!resource) {
      response.writeHead(404);
      response.end();
      return;
    }
    const [file, contentType] = resource;
    const bytes = await readFile(file);
    if (request.url === '/video.webm' && request.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      const start = match ? Number(match[1]) : NaN;
      const end = match && match[2] ? Number(match[2]) : bytes.length - 1;
      if (!Number.isSafeInteger(start) || start >= bytes.length ||
          end < start) {
        response.writeHead(416, {'Content-Range': `bytes */${bytes.length}`});
        response.end();
        return;
      }
      response.writeHead(206, {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${Math.min(end, bytes.length - 1)}/${bytes.length}`,
      });
      response.end(bytes.subarray(start, end + 1));
      return;
    }
    response.writeHead(200, {'Content-Type': contentType,
                             'Accept-Ranges': 'bytes'});
    response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  browser = await chromium.launch({executablePath: browserPath,
                                   headless: true, args: ['--no-sandbox']});
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin);
  await page.locator('video').evaluate(video => new Promise((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    video.addEventListener('loadedmetadata', resolve, {once: true});
    video.addEventListener('error', reject, {once: true});
  }));

  const duration = await page.locator('video').evaluate(async video => {
    const {createPlaybackController} = await import(
        '/prism/media/playback_controller.mjs');
    const {inspectYouTubeWatchPage} = await import(
        '/prism/media/youtube_site_adapter.mjs');
    const watchURL = 'https://www.youtube.com/watch?v=AbCdEfGhI12';
    const player = document.querySelector('#movie_player');
    if (inspectYouTubeWatchPage(
        'https://youtube.com.evil.test/watch?v=AbCdEfGhI12', document)) {
      throw new Error('A lookalike origin was accepted');
    }
    player.classList.add('ad-showing');
    const adSite = inspectYouTubeWatchPage(watchURL, document);
    if (adSite?.allowPlayback !== false) {
      throw new Error('Ad playback was not withheld');
    }
    const segmentContext = {
      segments: [{uuid: 'smoke', category: 'sponsor', start: 0.1, end: 2.5}],
      settings: {enabled: true},
      incognito: false,
    };
    const controller = createPlaybackController(video);
    controller.setContext({
      ...segmentContext,
      videoId: adSite.videoId,
      allowPlayback: adSite.allowPlayback,
    });
    const seeked = new Promise(resolve =>
      video.addEventListener('seeked', resolve, {once: true}));
    video.currentTime = 0.5;
    await seeked;
    controller.start();
    if (video.currentTime > 0.7) {
      throw new Error('Playback skipped during an advertisement');
    }
    player.classList.remove('ad-showing');
    const site = inspectYouTubeWatchPage(watchURL, document);
    if (site?.media !== video || !site.allowPlayback) {
      throw new Error('Main video was not selected');
    }
    controller.setPlaybackAllowed(site.allowPlayback);
    window.prismSmokeController = controller;
    return video.duration;
  });
  assert.ok(duration >= 2.5);
  try {
    await page.waitForFunction(() =>
      document.querySelector('video').currentTime > 2.4 &&
      !document.querySelector('video').seeking,
    null, {timeout: 5000});
  } catch (error) {
    const state = await page.locator('video').evaluate(video => ({
      currentTime: video.currentTime,
      duration: video.duration,
      seeking: video.seeking,
      readyState: video.readyState,
      error: video.error?.message,
    }));
    throw new Error(`Video seek failed: ${JSON.stringify(state)}; page errors: ${pageErrors.join('; ')}`, {cause: error});
  }
  const result = await page.locator('video').evaluate(async video => {
    const undone = window.prismSmokeController.undo();
    await new Promise(resolve => video.addEventListener('seeked', resolve,
                                                        {once: true}));
    const player = document.querySelector('#movie_player');
    player.classList.add('ad-showing');
    window.prismSmokeController.setPlaybackAllowed(false);
    video.dispatchEvent(new Event('timeupdate'));
    player.classList.remove('ad-showing');
    window.prismSmokeController.setPlaybackAllowed(true);
    const afterUndo = video.currentTime;
    window.prismSmokeController.stop();
    return {undone, afterUndo};
  });
  assert.equal(result.undone, true);
  assert.ok(Math.abs(result.afterUndo - 0.5) < 0.2,
            JSON.stringify(result));
  assert.deepEqual(pageErrors, []);
  await page.locator('video').evaluate(async video => {
    const {createYouTubeWatchObserver} = await import(
        '/prism/media/youtube_site_adapter.mjs');
    const events = new EventTarget();
    let route = 'https://www.youtube.com/watch?v=AbCdEfGhI12';
    const states = [];
    const observe = createYouTubeWatchObserver({
      root: document,
      events,
      readURL: () => route,
      onChange: state => states.push(state && {
        videoId: state.videoId, allowed: state.allowPlayback,
      }),
    });
    const latest = () => states.at(-1);
    observe.start();
    if (!latest()?.allowed) {
      throw new Error('Initial media was not available');
    }
    events.dispatchEvent(new Event('yt-navigate-start'));
    if (latest()?.allowed) {
      throw new Error('Navigation did not suspend playback');
    }
    route = 'https://www.youtube.com/watch?v=zYxWvUtSrQ9';
    events.dispatchEvent(new Event('yt-navigate-finish'));
    if (latest()?.videoId !== 'zYxWvUtSrQ9' || latest().allowed) {
      throw new Error('Reused media was enabled before new metadata');
    }
    video.dispatchEvent(new Event('loadedmetadata'));
    if (!latest()?.allowed) {
      throw new Error('New metadata did not enable playback');
    }
    const player = document.querySelector('#movie_player');
    player.classList.add('ad-showing');
    await new Promise(resolve => setTimeout(resolve, 100));
    if (latest()?.allowed) {
      throw new Error('Advertisement class did not suspend playback');
    }
    player.classList.remove('ad-showing');
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!latest()?.allowed) {
      throw new Error('Main video did not resume after advertisement');
    }
    events.dispatchEvent(new Event('yt-navigate-start'));
    route = 'https://www.youtube.com/watch?v=QwErTyUiOp1';
    const replacement = document.createElement('video');
    replacement.className = 'html5-main-video';
    replacement.src = '/video.webm';
    replacement.preload = 'auto';
    player.replaceChildren(replacement);
    events.dispatchEvent(new Event('yt-navigate-finish'));
    if (replacement.readyState < 1) {
      await new Promise(resolve =>
        replacement.addEventListener('loadedmetadata', resolve, {once: true}));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (latest()?.videoId !== 'QwErTyUiOp1' || !latest().allowed) {
      throw new Error('Ready replacement media remained suspended');
    }
    observe.stop();
    if (latest() !== null) {
      throw new Error('Observer did not clear state on stop');
    }
  });
  console.log(`PASS: media seek, undo, ad suspension, and synthetic navigation (duration ${duration}s)`);
} finally {
  if (browser) {
    await browser.close();
  }
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await rm(temp, {recursive: true, force: true});
}
