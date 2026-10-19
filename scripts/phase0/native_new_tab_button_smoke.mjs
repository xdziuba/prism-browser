import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
const activation = process.env.PRISM_NEW_TAB_ACTIVATION ?? 'click';
if (!executablePath || !display || display === ':0' ||
    !['click', 'context-menu'].includes(activation)) {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_new_tab_button_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
function native(...actions) {
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', ...actions], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function capture(path) {
  if (!path) return;
  const result = spawnSync('import', ['-display', display, '-window', 'root', path], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || `Capture failed: ${result.status}`);
}

function menuChangedPixels(before, after) {
  const script = `from PIL import Image, ImageChops
import sys
a = Image.open(sys.argv[1]).convert('RGB').crop((292, 85, 711, 190))
b = Image.open(sys.argv[2]).convert('RGB').crop((292, 85, 711, 190))
d = ImageChops.difference(a, b)
print(sum(1 for pixel in d.getdata() if max(pixel) > 25))`;
  const result = spawnSync('python3', ['-c', script, before, after], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return Number(result.stdout.trim());
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
  await page.waitForTimeout(800);
  capture(process.env.PRISM_NEW_TAB_SCREENSHOT);

  if (activation === 'context-menu') {
    const before = process.env.PRISM_NEW_TAB_MENU_BEFORE_SCREENSHOT ?? join(profile, 'menu-before.png');
    const opened = process.env.PRISM_NEW_TAB_MENU_SCREENSHOT ?? join(profile, 'menu-open.png');
    const closed = process.env.PRISM_NEW_TAB_MENU_CLOSED_SCREENSHOT ?? join(profile, 'menu-closed.png');
    capture(before);
    native('right-click:292,20', 'move:800,500');
    await page.waitForTimeout(400);
    capture(opened);
    const openedPixels = menuChangedPixels(before, opened);
    if (openedPixels < 10000) {
      throw new Error(`New Tab context menu did not visibly open (${openedPixels} pixels)`);
    }
    native('Escape');
    await page.waitForTimeout(250);
    capture(closed);
    const closedPixels = menuChangedPixels(before, closed);
    if (closedPixels > 1000) {
      throw new Error(`Escape did not close New Tab context menu (${closedPixels} pixels; open ${openedPixels})`);
    }
    if (browser.pages().length !== 1 || page.url() !== 'data:text/html,<title>Prism new tab native smoke</title>') {
      throw new Error('New Tab context menu unexpectedly changed the active page');
    }
    console.log(`PASS: native Prism New Tab context menu opened (${openedPixels} px), Escape closed it (${closedPixels} px), page unchanged`);
  } else {

    const opened = browser.waitForEvent('page', { timeout: 10000 });
    native('click:292,20');
    const newPage = await opened;
    await newPage.waitForLoadState('domcontentloaded');
    if (browser.pages().length !== 2 || !newPage.url().startsWith('chrome://new-tab-page')) {
      throw new Error(`Native New Tab result was ${browser.pages().length} pages, ${newPage.url()}`);
    }
    console.log('PASS: native Prism New Tab button opened a browser tab');
  }
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
