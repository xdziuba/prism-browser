import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const executablePath = process.argv[2];
const screenshotPath = process.argv[3];
if (!executablePath) {
  console.error('Usage: node scripts/phase0/branding_smoke.mjs <chrome binary>');
  process.exit(2);
}

const profile = await mkdtemp(join(tmpdir(), 'prism-branding-smoke-'));
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check'],
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('chrome://version/');
  const applicationName = await page.locator('#inner tr:first-child .label')
    .innerText();
  assert.equal(applicationName.trim(), 'Prism Browser');
  if (screenshotPath) {
    await page.locator('#inner tr:first-child').screenshot({
      path: screenshotPath,
    });
  }
  console.log('PASS: chrome://version identifies the application as Prism Browser');
} finally {
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
}
