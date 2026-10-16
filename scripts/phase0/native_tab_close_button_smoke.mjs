import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_tab_close_button_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
function moveNative(action) {
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', `${action}:255,20`], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `X11 tab close ${action} failed: ${result.status}`);
  }
}

function capture(path) {
  if (!path) return;
  const result = spawnSync('import', ['-display', display, '-window', 'root', path], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || `Capture failed: ${result.status}`);
}

const profile = await mkdtemp(join(tmpdir(), 'prism-tab-close-smoke-'));
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
  const first = browser.pages()[0] ?? await browser.newPage();
  await first.goto('data:text/html,<title>First tab</title>');
  const second = await browser.newPage();
  await second.goto('data:text/html,<title>Second tab</title>');
  await second.bringToFront();
  await second.mouse.click(300, 300);
  capture(process.env.PRISM_TAB_CLOSE_SCREENSHOT);

  moveNative('move');
  await second.waitForTimeout(200);
  capture(process.env.PRISM_TAB_CLOSE_HOVER_SCREENSHOT);

  const closed = first.waitForEvent('close', { timeout: 10000 });
  moveNative('click');
  await closed;
  if (browser.pages().length !== 1 || await second.title() !== 'Second tab') {
    throw new Error('Native close did not leave the second tab intact');
  }
  console.log('PASS: native Prism tab close button closed the first of two tabs');
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
