#!/usr/bin/env node
// Proves a normal packed CRX update with a local update feed and one profile restart.
import {createHash, createPublicKey} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display, not the user desktop');
}
if (!existsSync('/usr/bin/nautilus')) throw new Error('Nautilus is needed for real OS drag and drop');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);

const root = mkdtempSync(join(tmpdir(), 'prism-update-'));
const v1 = join(root, 'v1');
const v2 = join(root, 'v2');
const installFolder = join(root, `install-${basename(root)}`);
const profile = join(root, 'profile');
mkdirSync(v1);
mkdirSync(v2);
mkdirSync(installFolder);
const browserEnv = {
  ...process.env,
  XDG_CURRENT_DESKTOP: '', XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: '',
  GTK_USE_PORTAL: '0', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/prism-no-session-bus',
};
const hits = [];
let crx;
let id;
const server = createServer((request, response) => {
  hits.push(request.url);
  if (request.url?.startsWith('/updates.xml')) {
    response.writeHead(200, {'Content-Type': 'application/xml'});
    response.end(`<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">` +
      `<app appid="${id}"><updatecheck codebase="http://127.0.0.1:${server.address().port}/v2.crx" version="1.0.1"/></app></gupdate>`);
  } else if (request.url === '/v2.crx') {
    response.writeHead(200, {'Content-Type': 'application/x-chrome-extension'});
    response.end(crx);
  } else {
    response.writeHead(404);
    response.end();
  }
});
let context;
let nautilus;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const updateUrl = `http://127.0.0.1:${server.address().port}/updates.xml`;
  for (const [directory, version] of [[v1, '1.0.0'], [v2, '1.0.1']]) {
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({
      manifest_version: 3, name: 'Prism Phase 0 Update Probe', version,
      update_url: updateUrl, permissions: ['storage'],
      action: {default_popup: 'popup.html'},
    }));
    writeFileSync(join(directory, 'popup.html'), `<!doctype html><title>Version ${version}</title>`);
  }
  execFileSync(binary, ['--no-sandbox', `--pack-extension=${v1}`], {env: browserEnv});
  const key = join(root, 'v1.pem');
  execFileSync(binary, ['--no-sandbox', `--pack-extension=${v2}`, `--pack-extension-key=${key}`], {env: browserEnv});
  const publicKey = createPublicKey(readFileSync(key)).export({type: 'spki', format: 'der'});
  const digest = createHash('sha256').update(publicKey).digest().subarray(0, 16);
  id = [...digest].flatMap(byte => [byte >> 4, byte & 15]).map(n => String.fromCharCode(97 + n)).join('');
  crx = readFileSync(join(root, 'v2.crx'));
  cpSync(join(root, 'v1.crx'), join(installFolder, 'v1.crx'));
  nautilus = spawn('/usr/bin/nautilus', ['--new-window', installFolder], {
    env: {...browserEnv, XDG_CURRENT_DESKTOP: 'GNOME'}, stdio: 'ignore',
  });
  await delay(1200);

  async function openBrowser() {
    return chromium.launchPersistentContext(profile, {
      executablePath: binary, headless: false,
      ignoreDefaultArgs: ['--disable-extensions', '--disable-background-networking'],
      args: ['--ozone-platform=x11', '--no-first-run', '--window-size=1288,840', '--window-position=10,10'],
      env: browserEnv,
    });
  }
  async function extensionInfo(page) {
    return page.evaluate(extensionId => chrome.developerPrivate.getExtensionsInfo().then(
      extensions => extensions.find(extension => extension.id === extensionId)), id);
  }
  context = await openBrowser();
  let page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://extensions/');
  await page.locator('extensions-manager').waitFor();
  await page.getByRole('switch').click();
  execFileSync('python3', [join(scriptDir, 'x11_drag_crx.py'), basename(installFolder)], {
    env: browserEnv, stdio: 'inherit',
  });
  let installed;
  for (let attempt = 0; attempt < 50; attempt++) {
    installed = await extensionInfo(page);
    if (installed?.version === '1.0.0' && installed.state === 'ENABLED') break;
    await delay(200);
  }
  if (installed?.version !== '1.0.0' || installed.state !== 'ENABLED' ||
      installed.location === 'UNPACKED') {
    throw new Error(`Packed v1 did not install normally: ${JSON.stringify(installed)}`);
  }
  const marker = createHash('sha256').update(root).digest('hex');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.evaluate(value => chrome.storage.local.set({prismUpdateMarker: value}), marker);
  await popup.close();

  await page.locator('#updateNow').click();
  let updated;
  for (let attempt = 0; attempt < 100; attempt++) {
    updated = await extensionInfo(page);
    if (updated?.version === '1.0.1' && updated.state === 'ENABLED') break;
    await delay(300);
  }
  if (updated?.version !== '1.0.1' || updated.state !== 'ENABLED') {
    throw new Error(`Extension did not update: ${JSON.stringify(updated)}; feed requests: ${hits}`);
  }
  if (!hits.some(hit => hit?.startsWith('/updates.xml')) || !hits.includes('/v2.crx')) {
    throw new Error(`Update feed and CRX were not both fetched: ${hits}`);
  }
  if (process.env.PRISM_EXTENSION_UPDATE_SCREENSHOT) {
    await page.screenshot({path: process.env.PRISM_EXTENSION_UPDATE_SCREENSHOT});
  }
  await context.close();
  context = await openBrowser();
  page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://extensions/');
  const restored = await extensionInfo(page);
  if (restored?.version !== '1.0.1' || restored.state !== 'ENABLED') {
    throw new Error(`Updated extension did not survive restart: ${JSON.stringify(restored)}`);
  }
  const secondPopup = await context.newPage();
  await secondPopup.goto(`chrome-extension://${id}/popup.html`);
  const saved = await secondPopup.evaluate(() => chrome.storage.local.get('prismUpdateMarker'));
  if (saved.prismUpdateMarker !== marker) throw new Error('Extension storage did not survive update');
  console.log(`PASS: packed CRX ${id} updated 1.0.0 -> 1.0.1; feed, storage, and restart verified`);
} finally {
  await context?.close();
  nautilus?.kill();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
