import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_bookmark_action_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>Prism bookmark smoke</title><h1>Bookmark test</h1>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/bookmark-test`;
const profile = await mkdtemp(join(tmpdir(), 'prism-bookmark-smoke-'));
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
  await page.goto(url);
  await page.mouse.click(400, 300);
  const click = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', 'click:1171,63'], {
    encoding: 'utf8', env: process.env,
  });
  if (click.status !== 0) throw new Error(click.stderr || click.stdout);
  await page.waitForTimeout(600);
  if (process.env.PRISM_BOOKMARK_SCREENSHOT) {
    const image = spawnSync('import', [
      '-display', display, '-window', 'root', process.env.PRISM_BOOKMARK_SCREENSHOT,
    ], { encoding: 'utf8' });
    if (image.status !== 0) throw new Error(image.stderr || `Capture failed: ${image.status}`);
  }
  const dismiss = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', 'Escape'], {
    encoding: 'utf8', env: process.env,
  });
  if (dismiss.status !== 0) throw new Error(dismiss.stderr || dismiss.stdout);
  await browser.close();
  browser = undefined;
  const bookmarks = JSON.parse(await readFile(join(profile, 'Default', 'Bookmarks'), 'utf8'));
  if (!JSON.stringify(bookmarks.roots).includes(url)) {
    throw new Error('Native bookmark action did not persist the local URL');
  }
  console.log(`PASS: native Prism bookmark action saved ${url} in the temporary profile`);
} finally {
  if (browser) await browser.close();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
