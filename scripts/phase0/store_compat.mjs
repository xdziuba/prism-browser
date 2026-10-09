#!/usr/bin/env node
// Installs two public MV3 extensions through the Chrome Web Store UI.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display, not the user desktop');
}
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) {
  throw new Error('The binary must be in the full Chromium source checkout');
}
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);

const candidates = [
  {id: 'ddkjiahejlhfcafbddmgiahcphecmpfh', name: 'uBlock Origin Lite',
    url: 'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh?hl=en'},
  {id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader',
    url: 'https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh?hl=en'},
];
const profile = mkdtempSync(join(tmpdir(), 'prism-store-'));
const browserEnv = {
  ...process.env,
  XDG_CURRENT_DESKTOP: '',
  XDG_SESSION_TYPE: 'x11',
  WAYLAND_DISPLAY: '',
  GTK_USE_PORTAL: '0',
  DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/prism-no-session-bus',
};
let context;
async function openBrowser() {
  return chromium.launchPersistentContext(profile, {
    executablePath: binary,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--ozone-platform=x11', '--no-first-run'],
    env: browserEnv,
  });
}
async function extensions() {
  const page = await context.newPage();
  try {
    await page.goto('chrome://extensions/');
    return await page.evaluate(() => chrome.developerPrivate.getExtensionsInfo());
  } finally {
    await page.close();
  }
}
async function darkReaderStyle() {
  const page = await context.newPage();
  try {
    await page.goto('https://example.com/', {waitUntil: 'domcontentloaded'});
    await delay(1500);
    return await page.evaluate(() => ({
      background: getComputedStyle(document.documentElement).backgroundColor,
      styles: document.querySelectorAll('[class*="darkreader"], [id*="darkreader"]').length,
    }));
  } finally {
    await page.close();
  }
}
async function enabledRulesets() {
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${candidates[0].id}/popup.html`);
    return await page.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
  } finally {
    await page.close();
  }
}

try {
  context = await openBrowser();
  const baseline = await darkReaderStyle();
  const storePage = context.pages()[0] ?? await context.newPage();
  for (const candidate of candidates) {
    await storePage.bringToFront();
    await storePage.goto(candidate.url, {waitUntil: 'domcontentloaded', timeout: 30000});
    if (storePage.url().startsWith('https://consent.google.com/')) {
      await storePage.getByRole('button', {name: 'Reject all'}).click();
      await storePage.waitForURL(/chromewebstore\.google\.com/, {timeout: 30000});
    }
    const noThanks = storePage.getByRole('button', {name: 'No thanks'});
    if (await noThanks.count()) await noThanks.click();
    await storePage.getByRole('button', {name: 'Add to Chrome'}).click();
    await delay(1200);
    execFileSync('python3', [
      join(scriptDir, 'x11_key_probe.py'), ':main', 'Tab', 'Return',
    ]);
    let installed;
    for (let attempt = 0; attempt < 30; attempt++) {
      installed = (await extensions()).find(info => info.id === candidate.id);
      if (installed?.state === 'ENABLED' && installed.location === 'FROM_STORE') break;
      await delay(300);
    }
    if (installed?.state !== 'ENABLED' || installed.location !== 'FROM_STORE') {
      throw new Error(`${candidate.name} was not installed from the Store`);
    }
    console.log(`Store installed ${installed.name} ${installed.version} (${installed.id})`);
  }

  const styled = await darkReaderStyle();
  if (baseline.background === styled.background || styled.styles === 0) {
    throw new Error(`Dark Reader did not change example.com: ${JSON.stringify({baseline, styled})}`);
  }
  const rulesets = await enabledRulesets();
  if (!rulesets.includes('easylist') || !rulesets.includes('easyprivacy')) {
    throw new Error(`uBlock Origin Lite rulesets were not enabled: ${rulesets}`);
  }
  const beforeRestart = await extensions();
  await context.close();
  context = await openBrowser();
  const afterRestart = await extensions();
  for (const candidate of candidates) {
    const before = beforeRestart.find(info => info.id === candidate.id);
    const after = afterRestart.find(info => info.id === candidate.id);
    if (after?.state !== 'ENABLED' || after.location !== 'FROM_STORE' ||
        after.version !== before?.version) {
      throw new Error(`${candidate.name} changed or disappeared after restart`);
    }
  }
  const restoredStyle = await darkReaderStyle();
  if (restoredStyle.styles === 0 || restoredStyle.background !== styled.background) {
    throw new Error('Dark Reader styling did not survive restart');
  }
  console.log('PASS: both Store installs survived restart; Dark Reader styled the page; uBlock rulesets enabled');
  console.log('uBlock request filtering and a real version update require separate checks.');
} finally {
  await context?.close();
  rmSync(profile, {recursive: true, force: true});
}
