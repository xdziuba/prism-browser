#!/usr/bin/env node
// Verifies that a normal chrome://extensions install survives a browser restart.
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

const fixture = resolve(repository, 'tests', 'fixtures', 'persistence-extension');
const profile = mkdtempSync(join(tmpdir(), 'prism-extension-ui-'));
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
async function getExtension(id) {
  const page = context.pages()[0] ?? await context.newPage();
  if (page.url() !== 'chrome://extensions/') await page.goto('chrome://extensions/');
  await page.locator('extensions-manager').waitFor();
  const result = await page.evaluate(async () => {
    const extensions = await chrome.developerPrivate.getExtensionsInfo();
    return extensions.find(info => info.name === 'Prism Phase 0 Persistence Probe');
  });
  if (id && result?.id !== id) throw new Error('Installed extension changed after restart');
  return {page, result};
}

try {
  context = await openBrowser();
  const {page} = await getExtension();
  const switchElement = page.getByRole('switch');
  if (await switchElement.getAttribute('aria-checked') === 'false') {
    await switchElement.click();
  }
  await page.locator('#loadUnpacked').click();
  await delay(500);
  execFileSync('python3', [
    join(scriptDir, 'x11_key_probe.py'), ':dialog',
    'Ctrl+L', 'sleep:200', `type:${fixture}`, 'sleep:1000',
    'click:dialog-open',
  ], {stdio: 'inherit'});
  let installed;
  for (let attempt = 0; attempt < 50; attempt++) {
    installed = (await getExtension()).result;
    if (installed?.state === 'ENABLED') break;
    await delay(200);
  }
  if (!installed || installed.state !== 'ENABLED') {
    console.error('Extensions:', await page.evaluate(() =>
      chrome.developerPrivate.getExtensionsInfo()));
    console.error('Visible dialogs:', await page.getByRole('dialog').allTextContents());
    console.error('Extension cards:', await page.locator('extensions-item').count());
    throw new Error('Unpacked extension did not install through chrome://extensions');
  }
  const first = await context.newPage();
  await first.goto(`chrome-extension://${installed.id}/popup.html`);
  await first.locator('#value').filter({hasText: 'No probe saved yet.'}).waitFor();
  await first.locator('#save').click();
  await first.waitForFunction(() => /^[0-9a-f-]{36}$/i.test(
    document.querySelector('#value')?.textContent ?? ''));
  const saved = await first.locator('#value').textContent();
  await context.close();
  context = await openBrowser();
  const {result: restored} = await getExtension(installed.id);
  if (restored?.state !== 'ENABLED') {
    throw new Error('Normally installed extension did not survive restart');
  }
  const second = await context.newPage();
  await second.goto(`chrome-extension://${installed.id}/popup.html`);
  await second.locator('#value').filter({hasText: saved}).waitFor();
  console.log(`PASS: chrome://extensions installed ${installed.id}; its storage survived restart`);
} finally {
  await context?.close();
  rmSync(profile, {recursive: true, force: true});
}
