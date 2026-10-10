#!/usr/bin/env node
// Verifies the Phase 1 AI settings view in the pinned, source-built browser.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display, not the user desktop');
}
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);
const profile = mkdtempSync(join(tmpdir(), 'prism-settings-'));
const browserEnv = {
  ...process.env, XDG_CURRENT_DESKTOP: '', XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: '',
  GTK_USE_PORTAL: '0', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/prism-no-session-bus',
};
let context;
async function openBrowser() {
  return chromium.launchPersistentContext(profile, {
    executablePath: binary, headless: false,
    args: ['--ozone-platform=x11', '--no-first-run'], env: browserEnv,
    viewport: {width: 1100, height: 820},
  });
}
async function openSettings() {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://version/');
  await page.goto('chrome://prism-ai/');
  await page.evaluate(() => { location.hash = 'settings'; });
  await page.locator('#settings-view').waitFor({state: 'visible'});
  return page;
}
try {
  context = await openBrowser();
  let page = await openSettings();
  if (await page.locator('#setup').isVisible()) throw new Error('Assistant setup leaked into Settings');
  await page.locator('#default-model').fill('prism-test-model');
  await page.locator('#settings-form button').click();
  await page.locator('#settings-status').filter({hasText: 'saved'}).waitFor();
  await page.locator('#nav-assistant').click();
  await page.locator('#setup').waitFor({state: 'visible'});
  if (await page.locator('#model').inputValue() !== 'prism-test-model') {
    throw new Error('Saved default was not copied to session setup');
  }
  await page.locator('#nav-settings').click();
  await page.locator('#settings-view').waitFor({state: 'visible'});
  const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  if (Object.keys(stored).length !== 1 || stored['prism.defaultModel'] !== 'prism-test-model') {
    throw new Error(`Only the model ID should be stored in WebUI localStorage: ${JSON.stringify(stored)}`);
  }
  if (process.env.PRISM_SETTINGS_SCREENSHOT) {
    await page.screenshot({path: process.env.PRISM_SETTINGS_SCREENSHOT});
  }
  await page.setViewportSize({width: 420, height: 800});
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error('Settings layout overflows a narrow side-panel width');
  if (process.env.PRISM_SETTINGS_NARROW_SCREENSHOT) {
    await page.screenshot({path: process.env.PRISM_SETTINGS_NARROW_SCREENSHOT});
  }
  await context.close();

  context = await openBrowser();
  page = await openSettings();
  if (await page.locator('#default-model').inputValue() !== 'prism-test-model') {
    throw new Error('Default model did not survive browser restart');
  }
  await page.locator('#nav-assistant').click();
  if (await page.locator('#model').inputValue() !== 'prism-test-model') {
    throw new Error('Restored model was not present in session setup');
  }
  console.log('PASS: Settings view, profile model persistence, no key storage, dark/narrow layout');
} finally {
  await context?.close();
  rmSync(profile, {recursive: true, force: true});
}
