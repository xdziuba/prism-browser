import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:https';

const executablePath = process.argv[2];
const screenshotPath = process.argv[3];
if (!executablePath || !process.env.DISPLAY) {
  console.error('Usage: DISPLAY=:N node scripts/phase0/native_dangerous_page_smoke.mjs <chrome binary>');
  process.exit(2);
}

const temp = await mkdtemp(join(tmpdir(), 'prism-dangerous-page-'));
const key = join(temp, 'key.pem');
const cert = join(temp, 'cert.pem');
let server;
let browser;
try {
  const generated = spawnSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', key, '-out', cert, '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ], { encoding: 'utf8' });
  if (generated.status !== 0) throw new Error(generated.stderr);

  server = createServer({
    key: await readFile(key), cert: await readFile(cert),
  }, (_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<title>Prism certificate test</title><h1>Local TLS fixture</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = `https://localhost:${address.port}/`;

  browser = await chromium.launchPersistentContext(join(temp, 'profile'), {
    executablePath,
    headless: false,
    ignoreHTTPSErrors: false,
    args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
      '--no-first-run', '--no-default-browser-check',
      '--window-size=1280,900', '--window-position=0,0'],
    viewport: null,
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  const session = await browser.newCDPSession(page);
  const states = [];
  session.on('Security.visibleSecurityStateChanged', (event) => {
    states.push(event.visibleSecurityState.securityState);
  });
  await session.send('Security.enable');

  await page.goto(url).catch((error) => {
    if (!String(error).includes('ERR_CERT_AUTHORITY_INVALID')) throw error;
  });
  await page.locator('#details-button').click();
  await page.locator('#proceed-link').click();
  await page.getByRole('heading', { name: 'Local TLS fixture' }).waitFor();
  await page.waitForTimeout(800);
  assert.equal(page.url(), url);
  assert.equal(states.at(-1), 'insecure-broken');
  if (screenshotPath) {
    const captured = spawnSync('import', [
      '-display', process.env.DISPLAY, '-window', 'root', screenshotPath,
    ], { encoding: 'utf8' });
    if (captured.status !== 0) throw new Error(captured.stderr);
  }

  console.log('PASS: local certificate override remains insecure-broken');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
