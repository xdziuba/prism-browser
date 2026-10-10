#!/usr/bin/env node
// Exercises the browser-owned Phase 1 command palette, without a live AI key.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display, not the user desktop');
}
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);
const profile = mkdtempSync(join(tmpdir(), 'prism-commands-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: binary, headless: false,
  args: ['--ozone-platform=x11', '--no-first-run'],
  env: {
    ...process.env, XDG_CURRENT_DESKTOP: '', XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: '',
    GTK_USE_PORTAL: '0', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/prism-no-session-bus',
  },
});
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.setViewportSize({width: 1100, height: 800});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('chrome://version/');
  await page.goto('chrome://prism-ai/');
  await page.locator('#setup-title').waitFor();
  await page.locator('#open-commands').click();
  await page.locator('#command-palette').waitFor({state: 'visible'});
  if (await page.evaluate(() => document.activeElement.id) !== 'command-search') {
    throw new Error('Search input did not receive focus');
  }
  if (!await page.locator('[data-command="stop"]').isDisabled()) {
    throw new Error('Stop command should be unavailable before a session starts');
  }
  await page.locator('#command-search').fill('settings');
  if (await page.locator('[data-command="assistant"]').isVisible() ||
      !await page.locator('[data-command="settings"]').isVisible()) {
    throw new Error('Command filtering did not select Settings');
  }
  await page.keyboard.press('ArrowDown');
  if (await page.evaluate(() => document.activeElement.dataset.command) !== 'settings') {
    throw new Error('ArrowDown did not focus the visible command');
  }
  await page.keyboard.press('Enter');
  await page.locator('#settings-view').waitFor({state: 'visible'});
  if (!page.url().endsWith('#settings')) throw new Error('Settings command did not navigate');

  await page.locator('#open-commands').click();
  await page.locator('#command-search').fill('nothing matches');
  await page.locator('#command-empty').waitFor({state: 'visible'});
  await page.keyboard.press('Escape');
  if (await page.locator('#command-palette').isVisible() ||
      await page.evaluate(() => document.activeElement.id) !== 'open-commands') {
    throw new Error('Escape did not close the palette and return focus');
  }
  await page.setViewportSize({width: 420, height: 800});
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  await page.locator('#open-commands').click();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
    throw new Error('Command palette overflows a narrow side-panel width');
  }
  if (process.env.PRISM_COMMAND_PALETTE_SCREENSHOT) {
    await page.screenshot({path: process.env.PRISM_COMMAND_PALETTE_SCREENSHOT});
  }
  await page.locator('#close-commands').click();
  await page.locator('#nav-assistant').click();
  await page.locator('#model').fill('prism-test-model');
  await page.locator('#api-key').fill('prism-test-key-not-real');
  await page.locator('#start-form button[type="submit"]').click();
  await page.locator('#workspace').waitFor({state: 'visible', timeout: 5000});
  if (await page.locator('#api-key').inputValue()) {
    throw new Error('Session key was not cleared from the renderer input');
  }
  await page.locator('#open-commands').click();
  if (await page.locator('[data-command="stop"]').isDisabled()) {
    throw new Error('Stop command is unavailable during an active session');
  }
  await page.locator('[data-command="stop"]').click();
  await page.locator('#setup').waitFor({state: 'visible'});
  if (await page.locator('#stop').isEnabled()) throw new Error('Stop did not end the session');
  if (errors.length) throw new Error(`WebUI errors: ${errors.join(', ')}`);
  console.log('PASS: command palette filter, keyboard, Stop integration, narrow layout');
} finally {
  await context.close();
  rmSync(profile, {recursive: true, force: true});
}
