import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_reload_button_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
function clickReload() {
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', 'click:95,63'], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `X11 reload click failed: ${result.status}`);
  }
}

let reloadCount = 0;
let resolveSlowRequest;
const slowRequest = new Promise(resolve => { resolveSlowRequest = resolve; });
const server = createServer((request, response) => {
  if (request.url === '/slow') {
    resolveSlowRequest();
    const timer = setTimeout(() => {
      if (!response.destroyed) {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<title>Slow</title>');
      }
    }, 8000);
    response.on('close', () => clearTimeout(timer));
    return;
  }
  if (request.url !== '/counter') {
    response.writeHead(404);
    response.end();
    return;
  }
  reloadCount += 1;
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(`<title>Reload ${reloadCount}</title><main>Reload ${reloadCount}</main>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'prism-reload-smoke-'));
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: [
      '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      '--window-size=1280,900', '--window-position=0,0',
      '--no-first-run', '--no-default-browser-check',
    ],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto(`${origin}/counter`);
  if (await page.title() !== 'Reload 1') throw new Error('Initial page failed');
  await page.bringToFront();
  await page.mouse.click(300, 300);
  clickReload();
  await page.waitForFunction(() => document.title === 'Reload 2');

  const pendingNavigation = page.goto(`${origin}/slow`, { timeout: 20000 })
    .then(() => 'completed', () => 'aborted');
  await slowRequest;
  await page.waitForTimeout(300);
  if (process.env.PRISM_RELOAD_STOP_SCREENSHOT) {
    const capture = spawnSync('import', ['-display', display, '-window', 'root',
      process.env.PRISM_RELOAD_STOP_SCREENSHOT], { encoding: 'utf8' });
    if (capture.status !== 0) throw new Error(capture.stderr);
  }
  clickReload();
  const outcome = await Promise.race([
    pendingNavigation,
    new Promise(resolve => setTimeout(() => resolve('timeout'), 3000)),
  ]);
  if (outcome !== 'aborted' || await page.title() !== 'Reload 2') {
    throw new Error(`Stop did not cancel slow navigation: ${outcome}`);
  }
  console.log('PASS: native Prism reload and stop canceled slow navigation');
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
