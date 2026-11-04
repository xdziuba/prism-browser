#!/usr/bin/env node
// Real console-event smoke for the pinned source-built Prism browser.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
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

const profile = mkdtempSync(join(tmpdir(), 'prism-console-triage-'));
const server = createServer((_request, response) => {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  response.end('<!doctype html><title>Console fixture</title><h1>Console fixture</h1>');
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
    await delay(100);
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
    args: ['--ozone-platform=x11', '--no-first-run', '--remote-debugging-port=0',
      '--host-resolver-rules=MAP api.openai.com ~NOTFOUND'],
    env: browserEnv, viewport: {width: 1100, height: 820},
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://prism-ai/');
  const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  await page.locator('#open-side-panel').click();
  const evaluate = await attachPanel(port);
  await page.goto(origin);
  await waitFor(() => evaluate("!!document.querySelector('#capture-console')"), 'console controls');
  if (!(await evaluate("document.querySelector('#capture-console').disabled"))) {
    throw new Error('Console capture was enabled before session start');
  }
  await evaluate("document.querySelector('#model').value = 'test-model'; document.querySelector('#api-key').value = 'synthetic-invalid-key'; document.querySelector('#start-form').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#capture-console').disabled"), 'active session');
  await evaluate("document.querySelector('#capture-console').click()");
  await waitFor(() => evaluate("document.querySelector('#console-status').textContent.includes('Capturing warnings')"), 'capture start');
  if (await evaluate("document.querySelector('#messages').textContent.includes('Analyze captured')")) {
    throw new Error('Analysis began without explicit action');
  }
  await page.evaluate(() => {
    console.warn('Cookie: password=synthetic-secret-never-send');
    console.error('TypeError: synthetic-secret-never-send');
  });
  await evaluate("import('chrome://resources/js/cr.js').then(({addWebUiListener}) => { window.__prismConsoleSent = null; addWebUiListener('prism-console-capture', result => { if (result.sent) window.__prismConsoleSent = result; }); })");
  await evaluate("document.querySelector('#analyze-console').click()");
  await waitFor(() => evaluate("!!window.__prismConsoleSent"), 'analysis dispatch');
  const state = await evaluate("({digest: window.__prismConsoleSent.digest, message: document.querySelector('#messages').textContent})");
  if (!state.digest.includes('TypeError') || !state.digest.includes('warning') ||
      !state.digest.includes('Captured console warnings/errors: 2') ||
      state.digest.includes('synthetic-secret') ||
      !state.message.includes('Analyze captured console metadata')) {
    throw new Error(`Console metadata incorrect: ${JSON.stringify(state)}`);
  }
  await waitFor(() => evaluate("!document.querySelector('#setup').hidden"), 'offline API failure');
  if (await evaluate("document.querySelector('#console-digest').textContent !== ''")) {
    throw new Error('Console metadata remained visible after session stop');
  }
  await evaluate("document.querySelector('#api-key').value = 'synthetic-invalid-key'; document.querySelector('#start-form').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#capture-console').disabled"), 'second session');
  await evaluate("document.querySelector('#capture-console').click()");
  await waitFor(() => evaluate("document.querySelector('#console-status').textContent.includes('Capturing warnings')"), 'second capture');
  await page.goto(`${origin}/next`);
  await evaluate("document.querySelector('#analyze-console').click()");
  await waitFor(() => evaluate("document.querySelector('#console-status').textContent.includes('expired')"), 'navigation invalidation');
  console.log('PASS: real console warnings/errors, metadata-only analysis, no raw secret, navigation invalidation, offline failure');
} finally {
  socket?.close();
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(profile, {recursive: true, force: true});
}
