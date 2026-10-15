#!/usr/bin/env node
// Exercises native tab selection and the local multi-tab read path.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display');
}
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error('Chromium revision differs from the lock');

const root = mkdtempSync(join(tmpdir(), 'prism-selected-preview-'));
const profile = join(root, 'profile');
const extension = join(root, 'tab-selector');
mkdirSync(profile);
mkdirSync(extension);
writeFileSync(join(extension, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Prism tab-selection fixture', version: '0.1',
  permissions: ['tabs'], background: {service_worker: 'worker.js'},
}));
writeFileSync(join(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
const server = createServer((request, response) => {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  const body = request.url === '/a'
    ? '<h1>Alpha research</h1><p>First selected page.</p><p>api_key="synthetic-alpha-secret"</p><input value="private-alpha-value"><div aria-hidden="true">hidden-alpha-value</div>'
    : request.url === '/changed'
      ? '<h1>Changed beta</h1><p>Fresh selected page.</p>'
      : `<h1>Beta research</h1><p>Second selected page.</p>${Array.from({length: 3}, () => `<p>${'B'.repeat(3500)}</p>`).join('')}`;
  response.end(`<!doctype html><title>Selection fixture</title><main>${body}</main>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browserEnv = {
  ...process.env, XDG_CURRENT_DESKTOP: '', XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: '',
  GTK_USE_PORTAL: '0', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/prism-no-session-bus',
};
let context;
let socket;

async function waitFor(check, description) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(120);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function attachPanel(port) {
  let target;
  await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    target = (await response.json()).find(item =>
      item.type === 'browser_ui' && item.url.startsWith('chrome://prism-ai-panel/'));
    return Boolean(target?.webSocketDebuggerUrl);
  }, 'native Prism panel');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const packet = JSON.parse(event.data);
    if (!pending.has(packet.id)) return;
    const {resolve, reject} = pending.get(packet.id);
    pending.delete(packet.id);
    packet.error ? reject(new Error(packet.error.message)) : resolve(packet.result);
  });
  return async expression => {
    const id = ++nextId;
    const result = new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
    socket.send(JSON.stringify({id, method: 'Runtime.evaluate',
      params: {expression, returnByValue: true, awaitPromise: true}}));
    const packet = await result;
    if (packet.exceptionDetails) throw new Error(packet.exceptionDetails.text);
    return packet.result.value;
  };
}

try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: binary, headless: false,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: ['--ozone-platform=x11', '--no-first-run',
      `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      '--remote-debugging-port=0'],
    env: browserEnv, viewport: {width: 1100, height: 820},
  });
  const worker = context.serviceWorkers().find(candidate =>
    candidate.url().endsWith('/worker.js')) ?? await context.waitForEvent('serviceworker', {
    predicate: candidate => candidate.url().endsWith('/worker.js'), timeout: 10000,
  });
  if (!worker) throw new Error('Tab-selection fixture did not start');
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://prism-ai/');
  const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  await page.locator('#open-side-panel').click();
  const evaluate = await attachPanel(port);
  await page.goto(`${origin}/a`);
  const second = await context.newPage();
  await second.goto(`${origin}/b`);
  await waitFor(() => evaluate("!!document.querySelector('#preview-tabs')"), 'selected-tabs control');
  await evaluate("document.querySelector('#preview-tabs').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Select two or three')"), 'single-selection refusal');

  async function selectUrls(urls) {
    await worker.evaluate(async urls => {
      const tabs = await chrome.tabs.query({});
      const chosen = urls.map(url => tabs.find(tab => tab.url === url));
      if (chosen.some(tab => !tab)) throw new Error('Fixture tab missing');
      await chrome.tabs.highlight({windowId: chosen[0].windowId,
        tabs: chosen.map(tab => tab.index)});
    }, urls);
  }
  await selectUrls([`${origin}/a`, `${origin}/b`]);
  await evaluate("document.querySelector('#preview-tabs').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('2 selected tabs')"), 'two-tab preview');
  const text = await evaluate("document.querySelector('#page-preview-text').textContent");
  const status = await evaluate("document.querySelector('#page-preview-status').textContent");
  if (!text.includes('Alpha research') || !text.includes('Beta research') ||
      !text.includes('[redacted]') || text.includes('synthetic-alpha-secret') ||
      text.includes('private-alpha-value') || text.includes('hidden-alpha-value') ||
      !status.includes('Partial context') || text.length > 24 * 1024) {
    throw new Error(`Selected preview incorrect: ${JSON.stringify({length: text.length,
      alpha: text.includes('Alpha research'), beta: text.includes('Beta research'),
      redacted: text.includes('[redacted]'), status})}`);
  }
  const width = await evaluate('({viewport: innerWidth, scroll: document.documentElement.scrollWidth})');
  if (width.scroll > width.viewport) throw new Error('Selected preview caused panel overflow');
  if (process.env.PRISM_SELECTED_PREVIEW_SCREENSHOT) {
    execFileSync('import', ['-window', 'root', process.env.PRISM_SELECTED_PREVIEW_SCREENSHOT]);
  }
  await second.goto(`${origin}/changed`);
  await selectUrls([`${origin}/a`, `${origin}/changed`]);
  await evaluate("document.querySelector('#preview-tabs').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-text').textContent.includes('Changed beta')"), 'fresh selected preview');
  const fresh = await evaluate("document.querySelector('#page-preview-text').textContent");
  if (fresh.includes('Beta research')) throw new Error('Stale selected context survived navigation');

  await second.goto('chrome://version/');
  await selectUrls([`${origin}/a`, 'chrome://version/']);
  await evaluate("document.querySelector('#preview-tabs').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Only selected HTTP')"), 'internal-tab refusal');
  if (await evaluate("document.querySelector('#page-preview-text').textContent")) {
    throw new Error('Internal-tab refusal exposed partial context');
  }
  await second.goto(`${origin}/changed`);
  const third = await context.newPage();
  await third.goto(`${origin}/third`);
  const fourth = await context.newPage();
  await fourth.goto(`${origin}/fourth`);
  await selectUrls([`${origin}/a`, `${origin}/changed`, `${origin}/third`, `${origin}/fourth`]);
  await evaluate("document.querySelector('#preview-tabs').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Select two or three')"), 'four-tab cap');
  console.log('PASS: native selected tabs, bounded redacted context, navigation refresh, refusals and cap');
} finally {
  socket?.close();
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
