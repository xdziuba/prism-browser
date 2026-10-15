import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [executablePath, evidenceDir] = process.argv.slice(2);
if (!executablePath) {
  console.error('Usage: node scripts/phase0/version_logo_smoke.mjs <chrome binary> [evidence dir]');
  process.exit(2);
}

if (evidenceDir) await mkdir(evidenceDir, { recursive: true });
for (const mode of ['light', 'dark']) {
  const profile = await mkdtemp(join(tmpdir(), `prism-version-logo-${mode}-`));
  let browser;
  try {
    browser = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: true,
      colorScheme: mode,
      args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check'],
    });
    const page = browser.pages()[0] ?? await browser.newPage();
    await page.goto('chrome://version/');
    const logo = page.locator('img[src="chrome://theme/IDR_PRODUCT_LOGO"]');
    await logo.waitFor();
    const dimensions = await logo.evaluate((image) => ({
      width: image.naturalWidth,
      height: image.naturalHeight,
    }));
    assert.deepEqual(dimensions, { width: 128, height: 32 });
    const productName = await page.locator('#inner tr:first-child .label').innerText();
    assert.equal(productName.trim(), 'Prism Browser');
    if (evidenceDir) {
      await logo.screenshot({ path: join(evidenceDir, `version-logo-${mode}.png`) });
    }
    console.log(`PASS: ${mode} chrome://version shows the 128×32 Prism wordmark`);
  } finally {
    if (browser) await browser.close();
    await rm(profile, { recursive: true, force: true });
  }
}
