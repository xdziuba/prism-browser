import { chromium } from 'playwright';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
const mode = process.env.PRISM_CLEAR_MODE ?? 'dark';
const width = Number(process.env.PRISM_CLEAR_WIDTH ?? 1280);
if (!executablePath || !display || display === ':0' ||
    !['dark', 'light', 'forced-contrast'].includes(mode) ||
    !Number.isInteger(width) || width < 700 || width > 1280) {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_omnibox_clear_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
function native(...actions) {
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', ...actions], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function nativeClick(...actions) {
  const result = spawnSync('python3', [
    join(scriptDir, 'x11_key_probe.py'), '--preserve-focus', ':main', ...actions,
  ], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function capture(path) {
  const result = spawnSync('import', ['-display', display, '-window', 'root', path], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || `Capture failed: ${result.status}`);
}

function findClearGlyph(path, windowWidth, center) {
  const script = `from PIL import Image
import sys
image = Image.open(sys.argv[1]).convert('L')
width = int(sys.argv[2])
center = None if sys.argv[3] == 'any' else int(sys.argv[3])
def pixel(x, y):
    return image.getpixel((x, y))
scores = []
start, stop = ((width - 230, width - 75) if center is None
               else (center - 2, center + 3))
for x in range(start, stop):
    background = pixel(x, 48)
    diagonal = sum(abs(pixel(x + dx, 62 + dy) - background)
        for dx, dy in [(-4,-4),(-3,-3),(-2,-2),(2,2),(3,3),(4,4),
                       (-4,4),(-3,3),(-2,2),(2,-2),(3,-3),(4,-4)])
    axis = sum(abs(pixel(x + dx, 62 + dy) - background)
        for dx, dy in [(-5,0),(-4,0),(-3,0),(3,0),(4,0),(5,0),
                       (0,-5),(0,-4),(0,-3),(0,3),(0,4),(0,5)])
    scores.append((diagonal - axis, x))
print(*max(scores))`;
  const result = spawnSync('python3', [
    '-c', script, path, String(windowWidth), center === undefined ? 'any' : String(center),
  ], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  const [score, x] = result.stdout.trim().split(' ').map(Number);
  return { score, x };
}

const profile = await mkdtemp(join(tmpdir(), 'prism-omnibox-clear-'));
let browser;
try {
  await mkdir(join(profile, 'Default'));
  await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({
    extensions: { theme: { system_theme: 0 } },
    browser: { theme: { color_scheme2: mode === 'dark' ? 2 : 1 } },
  }));
  browser = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: [
      '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      `--window-size=${width},900`, '--window-position=0,0',
      '--no-first-run', '--no-default-browser-check',
      ...(mode === 'forced-contrast' ? ['--force-high-contrast'] : []),
    ],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('data:text/html,<title>Prism omnibox clear smoke</title>');
  const originalUrl = page.url();
  native('Ctrl+L', 'type:prism-clear-probe-20261018');
  // Chromium may add the AI page action shortly after the input changes,
  // moving Clear all. Let that layout settle before locating the glyph.
  await page.waitForTimeout(1800);
  const before = process.env.PRISM_CLEAR_BEFORE_SCREENSHOT ?? join(profile, 'before.png');
  capture(before);
  const glyph = findClearGlyph(before, width);
  if (glyph.score < 900) {
    throw new Error(`Clear all glyph was not visible (${glyph.score} visual score)`);
  }

  // The clear action shifts when a trailing AI/page action is present.
  nativeClick(`click:${glyph.x},62`, 'move:800,450');
  await page.waitForTimeout(350);
  const after = process.env.PRISM_CLEAR_AFTER_SCREENSHOT ?? join(profile, 'after.png');
  capture(after);
  if (findClearGlyph(after, width, glyph.x).score >= 900) {
    throw new Error('Clear all glyph remained visible after its click');
  }
  native('Return');
  await page.waitForTimeout(500);
  if (page.url() !== originalUrl) {
    throw new Error(`Clear action left navigable text in the omnibox: ${page.url()}`);
  }
  console.log(`PASS: native omnibox Clear all at x=${glyph.x} disappeared; Enter kept the original page`);
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
