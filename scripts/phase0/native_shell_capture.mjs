import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [executablePath, screenshotPath, mode = 'dark', widthArg = '1280'] =
  process.argv.slice(2);
const display = process.env.DISPLAY;
const width = Number(widthArg);
if (!executablePath || !screenshotPath || !display ||
    !['dark', 'light', 'forced-contrast'].includes(mode) ||
    !Number.isInteger(width) || width < 600 || width > 2000) {
  console.error('Usage: DISPLAY=:N node scripts/phase0/native_shell_capture.mjs <chrome binary> <output.png> [dark|light|forced-contrast] [width]');
  process.exit(2);
}

const profile = await mkdtemp(join(tmpdir(), 'prism-native-shell-'));
let browser;
try {
  await mkdir(join(profile, 'Default'));
  await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({
    extensions: { theme: { system_theme: 0 } },
    browser: {
      theme: { color_scheme2: mode === 'dark' ? 2 : 1 },
      ...(process.env.PRISM_NATIVE_HOME === '1' ? { show_home_button: true } : {}),
      ...(process.env.PRISM_NATIVE_HIDE_FORWARD === '1' ? { show_forward_button: false } : {}),
    },
  }));

  browser = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: [
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
    ],
    args: [
      '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      `--window-size=${width},900`, '--window-position=0,0',
      '--no-first-run', '--no-default-browser-check',
      ...(mode === 'forced-contrast' ? ['--force-high-contrast'] : []),
    ],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('data:text/html,<title>Prism UI preview</title><body style="margin:0;background:white;font:32px sans-serif;padding:80px">Prism browser UI</body>');
  if (process.env.PRISM_NATIVE_TAB_SET === '1') {
    const second = await browser.newPage();
    await second.goto('data:text/html,<title>Second page</title><body>Second page</body>');
    const third = await browser.newPage();
    await third.goto('data:text/html,<title>Third page</title><body>Third page</body>');
    await second.bringToFront();
    await second.keyboard.press('Control+Tab');
    await third.waitForFunction(() => document.visibilityState === 'visible');
    await second.bringToFront();
  }
  if (process.env.PRISM_NATIVE_TAB_SET !== '1' &&
      process.env.PRISM_NATIVE_FOCUS !== '1') {
    await page.mouse.click(350, 300);
  }
  if (process.env.PRISM_NATIVE_FOCUS === '1') {
    await page.keyboard.press('Control+L');
  }
  if (process.env.PRISM_NATIVE_HOVER_X) {
    const x = Number(process.env.PRISM_NATIVE_HOVER_X);
    if (!Number.isInteger(x) || x < 0 || x >= width) {
      throw new Error('PRISM_NATIVE_HOVER_X must be inside the browser window');
    }
    const motion = spawnSync('python3', ['-c', `
import ctypes, sys
x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
d = x11.XOpenDisplay(sys.argv[1].encode())
if not d: raise SystemExit('XOpenDisplay failed')
if not xtst.XTestFakeMotionEvent(d, 0, int(sys.argv[2]), 63, 0):
    raise SystemExit('XTest motion failed')
x11.XSync(d, 0)
x11.XCloseDisplay(d)
`, display, String(x)], { encoding: 'utf8' });
    if (motion.status !== 0) throw new Error(motion.stderr || 'XTest motion failed');
  }
  const captureWait = Number(process.env.PRISM_NATIVE_CAPTURE_WAIT_MS ?? 4000);
  if (!Number.isInteger(captureWait) || captureWait < 0 || captureWait > 15000) {
    throw new Error('PRISM_NATIVE_CAPTURE_WAIT_MS must be 0–15000');
  }
  await page.waitForTimeout(captureWait);
  const result = spawnSync('import', [
    '-display', display, '-window', 'root', screenshotPath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `import exited ${result.status}`);
  }
  console.log(`Captured ${mode} browser chrome at ${width}px: ${screenshotPath}`);
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
