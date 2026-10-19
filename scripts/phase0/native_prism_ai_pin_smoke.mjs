import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, realpathSync} from 'node:fs';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const [binaryArg, screenshot] = process.argv.slice(2);
if (!binaryArg || !screenshot || !process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Usage: DISPLAY=:isolated node native_prism_ai_pin_smoke.mjs <source-built chrome> <screenshot.png>');
}
const binary = realpathSync(binaryArg);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
const expected = JSON.parse(await readFile(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);

function native(...actions) {
  const result = spawnSync('python3', [join(scriptDir, 'x11_key_probe.py'), ':main', ...actions],
    {encoding: 'utf8', env: process.env});
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function capture(path) {
  const result = spawnSync('import', ['-display', process.env.DISPLAY, '-window', 'root', path],
    {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr || 'Native capture failed');
}

async function launch(profile) {
  return chromium.launchPersistentContext(profile, {
    executablePath: binary, headless: false, viewport: null,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      '--window-size=1280,900', '--window-position=0,0', '--no-first-run',
      '--no-default-browser-check', '--remote-debugging-port=0'],
  });
}

async function panelTarget(profile) {
  const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP targets returned ${response.status}`);
  return (await response.json()).some(target => target.type === 'browser_ui' &&
    target.url.startsWith('chrome://prism-ai-panel/'));
}

async function waitFor(check, page, description) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await check()) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

const profile = await mkdtemp(join(tmpdir(), 'prism-ai-pin-smoke-'));
let browser;
try {
  browser = await launch(profile);
  let page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('chrome://version/');
  await page.goto('chrome://prism-ai/');
  await page.locator('#open-side-panel').click();
  await waitFor(() => panelTarget(profile), page, 'native Prism AI panel');
  await page.waitForTimeout(900);
  native('click:1227,106');
  await page.waitForTimeout(500);
  capture(screenshot);
  await browser.close();
  browser = undefined;

  const preferences = JSON.parse(await readFile(join(profile, 'Default', 'Preferences'), 'utf8'));
  if (!preferences.toolbar?.pinned_actions?.includes('kActionSidePanelShowPrismAi')) {
    throw new Error('Native panel pin button did not persist the Prism AI action');
  }

  browser = await launch(profile);
  page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('chrome://version/');
  await page.goto('data:text/html,<title>Prism AI pinned after restart</title>');
  native('click:1167,63');
  await waitFor(() => panelTarget(profile), page, 'pinned Prism AI panel after restart');
  await page.waitForTimeout(900);
  native('click:1227,106');
  await page.waitForTimeout(500);
  await browser.close();
  browser = undefined;
  const unpinned = JSON.parse(await readFile(join(profile, 'Default', 'Preferences'), 'utf8'));
  if (unpinned.toolbar?.pinned_actions?.includes('kActionSidePanelShowPrismAi')) {
    throw new Error('Native panel unpin button did not clear the Prism AI action');
  }
  console.log('PASS: native panel pin persisted across restart, toolbar action reopened Prism AI, and native unpin cleared it');
} finally {
  if (browser) await browser.close();
  await rm(profile, {recursive: true, force: true});
}
