import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const executablePath = process.argv[2];
const display = process.env.DISPLAY;
if (!executablePath || !display || display === ':0') {
  console.error('Usage: DISPLAY=:isolated node scripts/phase0/native_home_button_smoke.mjs <source-built chrome>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'prism-home-smoke-'));
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
      '--window-size=1280,900', '--window-position=0,0',
      '--no-first-run', '--no-default-browser-check',
    ],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('data:text/html,<title>Before Home</title>');
  await page.mouse.click(400, 300);
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', 'click:130,63'], {
    encoding: 'utf8', env: process.env,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  await page.waitForURL(url => url.href.startsWith('chrome://new-tab-page/') || url.href.startsWith('chrome://newtab/'), {
    timeout: 10000,
  });
  console.log(`PASS: native Prism Home button navigated to ${page.url()}`);
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
