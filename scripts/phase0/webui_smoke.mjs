#!/usr/bin/env node
// Opens Prism's WebUI after browser startup, then checks its real DOM and assets.
import {realpathSync} from 'node:fs';
import {chromium} from 'playwright';

const binary = realpathSync(process.argv[2]);
const browser = await chromium.launch({executablePath: binary, headless: true});
try {
  const page = await browser.newPage();
  const failures = [];
  const assets = new Map();
  page.on('requestfailed', request => failures.push(request.url()));
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith('chrome://prism-ai/')) {
      assets.set(response.url(), response.status());
    }
  });
  await page.goto('chrome://version/');
  await page.goto('chrome://prism-ai/');
  await page.locator('#setup-title').waitFor();
  if (page.url() !== 'chrome://prism-ai/' || await page.title() !== 'Prism AI') {
    throw new Error(`Unexpected WebUI destination: ${page.url()}`);
  }
  const background = await page.locator('body').evaluate(
    element => getComputedStyle(element).backgroundColor);
  for (const asset of ['app.css', 'app.js']) {
    if (assets.get(`chrome://prism-ai/${asset}`) !== 200) {
      failures.push(`${asset}: HTTP ${assets.get(`chrome://prism-ai/${asset}`) ?? 'missing'}`);
    }
  }
  if (background === 'rgba(0, 0, 0, 0)' || failures.length) {
    throw new Error(`WebUI asset or script failure: ${failures.join(', ')}`);
  }
  console.log('PASS: chrome://prism-ai loaded with assets and no page errors');
} finally {
  await browser.close();
}
