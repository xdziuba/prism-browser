import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [executablePath, beforePath, afterPath, mode = 'dark', clickX] =
  process.argv.slice(2);
if (!executablePath || !beforePath || !process.env.DISPLAY ||
    process.env.DISPLAY === ':0' ||
    !['dark', 'light', 'forced-contrast'].includes(mode)) {
  console.error('Usage: DISPLAY=:N node scripts/phase0/native_tab_audio_smoke.mjs <chrome> <before.png> [after.png] [dark|light|forced-contrast] [click-x]');
  process.exit(2);
}

function capture(path) {
  const result = spawnSync('import', [
    '-display', process.env.DISPLAY, '-window', 'root', path,
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

function clickNative(x) {
  const probe = join(dirname(fileURLToPath(import.meta.url)), 'x11_key_probe.py');
  const result = spawnSync('python3', [probe, ':main', `click:${x},20`], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout ||
                    `X11 click failed: ${result.status ?? result.signal}`);
  }
}

const profile = await mkdtemp(join(tmpdir(), 'prism-tab-audio-'));
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
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      '--no-first-run', '--no-default-browser-check',
      ...(process.env.PRISM_TEST_DEFAULT_MUTE_POLICY === '1'
        ? [] : ['--enable-features=EnableTabMuting']),
      '--window-size=1280,900', '--window-position=0,0',
      ...(mode === 'forced-contrast' ? ['--force-high-contrast'] : []),
    ],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('data:text/html,<title>Prism audio test</title><button id="start">Start audio</button><script>document.querySelector("button").onclick=()=>{window.context=new AudioContext();window.oscillator=context.createOscillator();window.gain=context.createGain();gain.gain.value=0.001;oscillator.frequency.value=220;oscillator.connect(gain);gain.connect(context.destination);oscillator.start()}</script>');
  await page.locator('#start').click();
  await page.waitForFunction(() => window.context?.state === 'running');
  await page.waitForTimeout(1700);
  capture(beforePath);
  if (clickX !== undefined) {
    const x = Number(clickX);
    if (!Number.isInteger(x) || x < 0 || x >= 1280 || !afterPath) {
      throw new Error('A valid tab-icon X and after.png are required for native click');
    }
    clickNative(x);
    await page.waitForTimeout(700);
    capture(afterPath);
  }
  console.log(clickX === undefined
      ? 'PASS: Web Audio played in a headed Prism tab; captured native indicator'
      : 'PASS: Web Audio played and native indicator received an X11 click; inspect before/after captures for mute state');
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
