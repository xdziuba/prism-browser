import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_avatar_button_smoke.mjs <source-built chrome>');
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
  const result = spawnSync('import', ['-display', display, '-window', 'root', path], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || `Capture failed: ${result.status}`);
}
function changedPixels(before, after) {
  const script = `from PIL import Image, ImageChops
import sys
a = Image.open(sys.argv[1]).convert('RGB').crop((780, 145, 1270, 680))
b = Image.open(sys.argv[2]).convert('RGB').crop((780, 145, 1270, 680))
d = ImageChops.difference(a, b)
print(sum(1 for pixel in d.getdata() if max(pixel) > 25))`;
  const result = spawnSync('python3', ['-c', script, before, after], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return Number(result.stdout.trim());
}

const profile = await mkdtemp(join(tmpdir(), 'prism-avatar-smoke-'));
const captures = await mkdtemp(join(tmpdir(), 'prism-avatar-captures-'));
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
  await page.goto('data:text/html,<title>Prism profile smoke</title>');
  await page.mouse.click(400, 300);
  const before = join(captures, 'before.png');
  const opened = process.env.PRISM_AVATAR_SCREENSHOT ?? join(captures, 'opened.png');
  const closed = join(captures, 'closed.png');
  capture(before);
  native('click:1221,63');
  await page.waitForTimeout(400);
  capture(opened);
  const openChange = changedPixels(before, opened);
  if (openChange < 10000) throw new Error(`Profile menu did not visibly open (${openChange} px)`);
  native('Escape');
  await page.waitForTimeout(400);
  capture(closed);
  const closeChange = changedPixels(before, closed);
  if (closeChange > 1000) throw new Error(`Escape did not close profile menu (${closeChange} px)`);
  console.log(`PASS: native Prism profile menu opened (${openChange} px) and closed with Escape (${closeChange} px)`);
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
  await rm(captures, { recursive: true, force: true });
}
