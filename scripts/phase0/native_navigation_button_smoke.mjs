import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display) {
  console.error('Usage: DISPLAY=:N node scripts/phase0/native_navigation_button_smoke.mjs <source-built chrome>');
  process.exit(2);
}

// Playwright's page mouse is confined to web content. XTest clicks the
// browser-owned controls at their checked 1280 px X11 coordinates.
function clickNative(x, y) {
  const result = spawnSync('python3', ['-c', `
import ctypes, sys, time
x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
d = x11.XOpenDisplay(sys.argv[1].encode())
if not d: raise SystemExit('XOpenDisplay failed')
if not xtst.XTestFakeMotionEvent(d, 0, int(sys.argv[2]), int(sys.argv[3]), 0):
    raise SystemExit('XTest motion failed')
x11.XSync(d, 0)
time.sleep(0.08)
if not xtst.XTestFakeButtonEvent(d, 1, 1, 0):
    raise SystemExit('XTest press failed')
x11.XSync(d, 0)
time.sleep(0.08)
if not xtst.XTestFakeButtonEvent(d, 1, 0, 0):
    raise SystemExit('XTest release failed')
x11.XSync(d, 0)
x11.XCloseDisplay(d)
`, display, String(x), String(y)], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `XTest failed: ${result.status}`);
  }
}

function pressNativeAltLeft() {
  const result = spawnSync('python3', ['-c', `
import ctypes, sys
x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_uint
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
d = x11.XOpenDisplay(sys.argv[1].encode())
if not d: raise SystemExit('XOpenDisplay failed')
alt = x11.XKeysymToKeycode(d, x11.XStringToKeysym(b'Alt_L'))
left = x11.XKeysymToKeycode(d, x11.XStringToKeysym(b'Left'))
if not alt or not left: raise SystemExit('key mapping failed')
for key, pressed in [(alt, 1), (left, 1), (left, 0), (alt, 0)]:
    if not xtst.XTestFakeKeyEvent(d, key, pressed, 0):
        raise SystemExit('XTest key failed')
x11.XSync(d, 0)
`, display], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `XTest key failed: ${result.status}`);
  }
}

const server = createServer((request, response) => {
  const second = request.url === '/second';
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<title>${second ? 'Second' : 'First'}</title><main>${second ? 'Second' : 'First'}</main>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'prism-nav-smoke-'));
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
  await page.goto(`${origin}/first`);
  await page.goto(`${origin}/second`);
  if (await page.title() !== 'Second') throw new Error('Initial navigation failed');
  await page.bringToFront();
  await page.mouse.click(300, 300);
  clickNative(22, 63);
  await page.waitForFunction(() => document.title === 'First');
  await page.mouse.click(300, 300);
  clickNative(59, 63);
  await page.waitForFunction(() => document.title === 'Second');
  await page.mouse.click(300, 300);
  pressNativeAltLeft();
  await page.waitForFunction(() => document.title === 'First');
  console.log('PASS: native Prism back/forward click and keyboard navigation');
} finally {
  if (browser) await browser.close();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
