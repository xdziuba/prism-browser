import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_overflow_menu_navigation_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
function clickNative(x, y) {
  const result = spawnSync('python3', [
    join(scriptDir, 'x11_key_probe.py'), ':main', `click:${x},${y}`,
  ], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `X11 click failed: ${result.status}`);
  }
}

const server = createServer((request, response) => {
  const second = request.url === '/second';
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<title>${second ? 'Second' : 'First'}</title>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'prism-overflow-menu-smoke-'));
let browser;
try {
  await mkdir(join(profile, 'Default'));
  await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({
    browser: { show_home_button: true },
  }));
  browser = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: [
      '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      '--window-size=520,900', '--window-position=0,0',
      '--no-first-run', '--no-default-browser-check',
    ],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto(`${origin}/first`);
  await page.goto(`${origin}/second`);
  await page.goBack();
  if (await page.title() !== 'First') throw new Error('History setup failed');
  await page.bringToFront();
  await page.mouse.click(250, 300);

  // At 520 px both actions live in Chromium's real responsive menu.
  clickNative(460, 63);
  clickNative(380, 100);
  await page.waitForFunction(() => document.title === 'Second');

  clickNative(460, 63);
  clickNative(380, 132);
  await page.waitForURL(url => url.href.startsWith('chrome://new-tab-page/') ||
                              url.href.startsWith('chrome://newtab/'),
                        { timeout: 10000 });
  console.log('PASS: responsive Forward and Home menu actions navigated');
} finally {
  if (browser) await browser.close();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
