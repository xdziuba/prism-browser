import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, realpathSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const [binaryArg, screenshot, mode = 'dark', xArg = '1167'] = process.argv.slice(2);
if (!binaryArg || !screenshot || !process.env.DISPLAY || process.env.DISPLAY === ':0' ||
    !['dark', 'light', 'forced-contrast'].includes(mode)) {
  throw new Error('Usage: DISPLAY=:isolated node native_prism_ai_action_smoke.mjs <source-built chrome> <screenshot.png> [dark|light|forced-contrast] [action-x]');
}
const binary = realpathSync(binaryArg);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
const expected = JSON.parse(await readFile(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);
const x = Number(xArg);
if (!Number.isInteger(x) || x < 0 || x >= 1280) throw new Error('Invalid action x coordinate');

const profile = await mkdtemp(join(tmpdir(), 'prism-ai-action-smoke-'));
let browser;
try {
  await mkdir(join(profile, 'Default'));
  await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({
    extensions: {theme: {system_theme: 0}},
    browser: {theme: {color_scheme2: mode === 'dark' ? 2 : 1}},
    toolbar: {pinned_actions: ['kActionSidePanelShowPrismAi']},
  }));
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: binary, headless: false, viewport: null,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      '--window-size=1280,900', '--window-position=0,0', '--no-first-run',
      '--no-default-browser-check', '--remote-debugging-port=0',
      ...(mode === 'forced-contrast' ? ['--force-high-contrast'] : [])],
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('data:text/html,<title>Prism AI native action</title><body>Panel action smoke</body>');
  await page.waitForTimeout(700);
  const capture = spawnSync('import', ['-display', process.env.DISPLAY, '-window', 'root', screenshot],
    {encoding: 'utf8'});
  if (capture.status !== 0) throw new Error(capture.stderr || 'Native capture failed');
  if (process.env.PRISM_AI_ACTION_INSPECT === '1') {
    console.log(`Captured pinned Prism AI action for inspection: ${screenshot}`);
  } else {
    const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
    const panelOpen = async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(`CDP targets returned ${response.status}`);
      return (await response.json()).some(target => target.type === 'browser_ui' &&
        target.url.startsWith('chrome://prism-ai-panel/'));
    };
    const click = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', `click:${x},63`],
      {encoding: 'utf8', env: process.env});
    if (click.status !== 0) throw new Error(click.stderr || click.stdout);
    let opened = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await panelOpen()) { opened = true; break; }
      await page.waitForTimeout(200);
    }
    if (!opened) throw new Error(`Pinned Prism AI action at x=${x} did not open its native panel`);
    await page.waitForTimeout(900);
    if (process.env.PRISM_AI_PANEL_SCREENSHOT) {
      const panelCapture = spawnSync('import', [
        '-display', process.env.DISPLAY, '-window', 'root', process.env.PRISM_AI_PANEL_SCREENSHOT,
      ], {encoding: 'utf8'});
      if (panelCapture.status !== 0) {
        throw new Error(panelCapture.stderr || 'Native panel capture failed');
      }
    }
    const close = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', `click:${x},63`],
      {encoding: 'utf8', env: process.env});
    if (close.status !== 0) throw new Error(close.stderr || close.stdout);
    let closed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (!await panelOpen()) { closed = true; break; }
      await page.waitForTimeout(200);
    }
    if (!closed) throw new Error('Pinned Prism AI action did not close its native panel');
    console.log(`PASS: ${mode} pinned Prism AI action opened and closed the native panel`);
  }
} finally {
  if (browser) await browser.close();
  await rm(profile, {recursive: true, force: true});
}
