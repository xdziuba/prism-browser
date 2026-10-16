import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_new_tab_button_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
function clickNewTab() {
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', 'click:292,20'], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `X11 New Tab click failed: ${result.status}`);
  }
}

function capture(path) {
  if (!path) return;
  const result = spawnSync('import', ['-display', display, '-window', 'root', path], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || `Capture failed: ${result.status}`);
}

const profile = await mkdtemp(join(tmpdir(), 'prism-new-tab-smoke-'));
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
  await page.goto('data:text/html,<title>Prism new tab native smoke</title>');
  await page.bringToFront();
  await page.mouse.click(300, 300);
  capture(process.env.PRISM_NEW_TAB_SCREENSHOT);

  const opened = browser.waitForEvent('page', { timeout: 10000 });
  clickNewTab();
  const newPage = await opened;
  await newPage.waitForLoadState('domcontentloaded');
  if (browser.pages().length !== 2 || !newPage.url().startsWith('chrome://new-tab-page')) {
    throw new Error(`Native New Tab result was ${browser.pages().length} pages, ${newPage.url()}`);
  }
  console.log('PASS: native Prism New Tab button opened a browser tab');
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
