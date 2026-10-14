#!/usr/bin/env node
// Run only after linking the native component into the pinned Prism binary.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) {
  throw new TypeError('Usage: native_component_smoke.mjs <built-chrome>');
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '../..');
const expected = JSON.parse(readFileSync(join(repo, 'chromium.lock.json'),
  'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'],
  {encoding: 'utf8'}).trim();
if (actual !== expected) {
  throw new Error(`Chromium source is ${actual}, expected ${expected}`);
}

const componentId = 'fblecelimojmepieoalinhoeakdfffld';
const optionsUrl = `chrome-extension://${componentId}/settings/media_controls.html`;
const profile = mkdtempSync(join(tmpdir(), 'prism-native-component-'));

async function openBrowser() {
  return chromium.launchPersistentContext(profile, {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-proxy-server'],
  });
}

async function openOptions(context) {
  const page = await context.newPage();
  await page.goto('chrome://version/');
  await page.goto(optionsUrl);
  await page.locator('#form-status').getByText('Ready').waitFor();
  const runtimeId = await page.evaluate(() => chrome.runtime.id);
  if (runtimeId !== componentId) {
    throw new Error(`Native component identity changed: ${runtimeId}`);
  }
  await page.locator('#segment-status').getByText(
    'No segment provider is configured in this build. Enabling will not skip videos.').waitFor();
  return page;
}

try {
  let context = await openBrowser();
  try {
    const options = await openOptions(context);
    if (await options.locator('#segments-enabled').isChecked() ||
        await options.locator('#adblock-enabled').isChecked()) {
      throw new Error('Native component did not default to off');
    }
    await options.locator('#segments-enabled').check();
    await options.locator('#adblock-enabled').check();
    await options.locator('#save-settings').click();
    await options.locator('#form-status').getByText(/Saved/).waitFor();
    await options.locator('#form-status').getByText(
      /Segment lookup unavailable in this build/).waitFor();
    await options.locator('#rule-status').getByText(
      'No verified rule package is available.').waitFor();
    const rules = await options.evaluate(() =>
      chrome.declarativeNetRequest.getDynamicRules());
    if (rules.length) throw new Error('Provider-free component installed rules');
  } finally {
    await context.close();
  }

  context = await openBrowser();
  try {
    const options = await openOptions(context);
    if (!await options.locator('#segments-enabled').isChecked() ||
        !await options.locator('#adblock-enabled').isChecked()) {
      throw new Error('Native component settings did not survive restart');
    }
    const rules = await options.evaluate(() =>
      chrome.declarativeNetRequest.getDynamicRules());
    if (rules.length) throw new Error('Rules appeared after restart');
  } finally {
    await context.close();
  }
  console.log('PASS: native component identity, defaults, inert providers and restart');
} finally {
  rmSync(profile, {recursive: true, force: true});
}
