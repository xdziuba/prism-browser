#!/usr/bin/env node
// Checks unpacked MV3 extension storage across restarts of the pinned browser.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
const binaryArgument = process.argv[2];
if (!binaryArgument) {
  console.error('Usage: npm run test:extension-persistence -- /path/to/src/out/PrismFeasibility/chrome');
  process.exit(2);
}
const binary = realpathSync(binaryArgument);
const source = resolve(dirname(binary), '..', '..');
if (dirname(dirname(binary)).split('/').at(-1) !== 'out' || !existsSync(join(source, '.git'))) {
  throw new Error('The binary must be in the pinned Chromium checkout out directory');
}
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) {
  throw new Error(`Chromium source is ${actual}, expected ${expected}`);
}

const fixture = resolve(repository, 'tests', 'fixtures', 'persistence-extension');
const profile = mkdtempSync(join(tmpdir(), 'prism-extension-'));
const args = [`--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`];
let context;
async function openBrowser() {
  return chromium.launchPersistentContext(profile, {
    executablePath: binary,
    headless: true,
    args,
  });
}

async function extensionId() {
  const preferences = join(profile, 'Default', 'Preferences');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (existsSync(preferences)) {
      try {
        const settings = JSON.parse(readFileSync(preferences, 'utf8')).extensions?.settings ?? {};
        const match = Object.entries(settings).find(([, info]) =>
          info.manifest?.name === 'Prism Phase 0 Persistence Probe');
        if (match) return match[0];
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    await delay(100);
  }
  throw new Error('Unpacked extension was not found in the temporary profile');
}

async function popupValue(id) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForFunction(() => {
    const value = document.querySelector('#value')?.textContent;
    return value && value !== 'Reading saved value…';
  });
  return page;
}

try {
  context = await openBrowser();
  const id = await extensionId();
  const first = await popupValue(id);
  const initial = await first.locator('#value').textContent();
  if (initial !== 'No probe saved yet.') {
    throw new Error(`Unexpected initial extension value: ${initial}`);
  }
  await first.locator('#save').click();
  await first.waitForFunction(() => /^[0-9a-f-]{36}$/i.test(
    document.querySelector('#value')?.textContent ?? ''));
  const saved = await first.locator('#value').textContent();
  await context.close();
  context = await openBrowser();
  const second = await popupValue(id);
  const restored = await second.locator('#value').textContent();
  if (restored !== saved) {
    throw new Error('Extension local storage did not survive browser restart');
  }
  console.log(`PASS: unpacked MV3 storage survived restart (extension ${id})`);
  console.log('Install persistence and Chrome Web Store behavior require separate tests.');
} finally {
  if (context) await context.close();
  rmSync(profile, {recursive: true, force: true});
}
