#!/usr/bin/env node
// Tests the native Prism side panel in the pinned, source-built Linux browser.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display');
}
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) throw new Error('Use the full Chromium source build');
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);

const profile = mkdtempSync(join(tmpdir(), 'prism-panel-smoke-'));
const browserEnv = {
  ...process.env, XDG_CURRENT_DESKTOP: '', XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: '',
  GTK_USE_PORTAL: '0', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/prism-no-session-bus',
};
let context;
let panel;
let privateContext;

async function targets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  return response.json();
}

async function attachPanel(port) {
  let target;
  for (let attempt = 0; attempt < 40; attempt++) {
    target = (await targets(port)).find(item =>
      item.type === 'browser_ui' && item.url.startsWith('chrome://prism-ai-panel/'));
    if (target?.webSocketDebuggerUrl) break;
    await delay(150);
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('Native Prism panel target did not open');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const packet = JSON.parse(event.data);
    if (!packet.id || !pending.has(packet.id)) return;
    const {resolve, reject} = pending.get(packet.id);
    pending.delete(packet.id);
    packet.error ? reject(new Error(packet.error.message)) : resolve(packet.result);
  });
  socket.addEventListener('close', () => {
    for (const {reject} of pending.values()) reject(new Error('Panel target closed'));
    pending.clear();
  });
  async function send(method, params = {}) {
    const id = ++nextId;
    const result = new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
    socket.send(JSON.stringify({id, method, params}));
    return result;
  }
  return {
    targetId: target.id,
    socket,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    },
    close() { socket.close(); },
  };
}

async function waitFor(check, description, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: binary, headless: false,
    args: ['--ozone-platform=x11', '--no-first-run', '--force-device-scale-factor=1',
      '--remote-debugging-port=0'],
    env: browserEnv, viewport: {width: 1100, height: 820},
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://version/');
  await page.goto('chrome://prism-ai/');
  const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  if (!Number.isInteger(port) || port <= 0) throw new Error('Invalid CDP port');

  await page.locator('#open-side-panel').click();
  panel = await attachPanel(port);
  await waitFor(() => panel.evaluate("!!document.querySelector('#start-form')"), 'Prism panel assets');
  await delay(800);
  const tabHeaderFits = await page.evaluate(() => {
    const button = document.querySelector('#open-side-panel');
    return button.getBoundingClientRect().right <= innerWidth + 1;
  });
  if (!tabHeaderFits) throw new Error('Full-tab panel button was clipped by the native panel');
  if (await panel.evaluate("!document.querySelector('#open-side-panel').hidden")) {
    throw new Error('Full-tab-only panel button appeared inside the panel');
  }
  const width = await panel.evaluate(`({viewport: innerWidth,
    scroll: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('*')]
      .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8).map(element => [element.tagName, element.id,
        Math.round(element.getBoundingClientRect().right)])})`);
  if (width.scroll > width.viewport) {
    throw new Error(`Prism panel has horizontal overflow: ${JSON.stringify(width)}`);
  }

  await panel.evaluate(`(() => {
    document.querySelector('#model').value = 'prism-test-model';
    document.querySelector('#api-key').value = 'sk-test-not-a-real-key';
    document.querySelector('#start-form').requestSubmit();
  })()`);
  await waitFor(() => panel.evaluate("!document.querySelector('#workspace').hidden"), 'session in the owning browser');
  if (await panel.evaluate("document.querySelector('#api-key').value") !== '') {
    throw new Error('Session key remained in the renderer input');
  }
  await panel.evaluate("document.querySelector('#nav-settings').click()");
  await panel.evaluate(`(() => {
    document.querySelector('#default-model').value = 'prism-panel-model';
    document.querySelector('#settings-form').requestSubmit();
  })()`);
  if (await panel.evaluate("localStorage.getItem('prism.defaultModel')") !== 'prism-panel-model') {
    throw new Error('Panel model setting was not saved');
  }
  await panel.evaluate("document.querySelector('#nav-assistant').click()");
  if (process.env.PRISM_PANEL_SCREENSHOT) {
    execFileSync('import', ['-window', 'root', process.env.PRISM_PANEL_SCREENSHOT]);
  }

  await page.locator('#open-side-panel').click();
  await waitFor(async () => {
    const matching = (await targets(port)).find(item => item.id === panel.targetId);
    return !matching || await panel.evaluate("document.querySelector('#setup').hidden === false").catch(() => true);
  }, 'session to stop after the native panel is hidden');
  panel.close();
  panel = null;

  await page.locator('#open-side-panel').click();
  panel = await attachPanel(port);
  await waitFor(() => panel.evaluate("!!document.querySelector('#setup')"), 'reopened panel');
  if (await panel.evaluate("document.querySelector('#setup').hidden") ||
      !await panel.evaluate("document.querySelector('#workspace').hidden") ||
      await panel.evaluate("document.querySelector('#api-key').value") !== '') {
    throw new Error('Reopened panel retained a live session or key');
  }
  if (await panel.evaluate("document.querySelector('#model').value") !== 'prism-panel-model') {
    throw new Error('Panel model setting did not survive reopening');
  }
  await page.locator('#open-side-panel').click();
  await waitFor(async () => !(await targets(port)).some(item =>
    item.url.startsWith('chrome://prism-ai-panel/')), 'native panel to close');
  panel.close();
  panel = null;

  privateContext = await context.browser().newContext();
  const privatePage = await privateContext.newPage();
  await privatePage.goto('chrome://version/');
  await privatePage.goto('chrome://prism-ai/');
  await privatePage.locator('#open-side-panel').click();
  await delay(300);
  if ((await targets(port)).some(item => item.url.startsWith('chrome://prism-ai-panel/'))) {
    throw new Error('Prism panel opened in an off-the-record browser context');
  }
  console.log('PASS: Native panel session lifecycle, model persistence, and incognito exclusion');
} finally {
  panel?.close();
  await privateContext?.close();
  await context?.close();
  rmSync(profile, {recursive: true, force: true});
}
