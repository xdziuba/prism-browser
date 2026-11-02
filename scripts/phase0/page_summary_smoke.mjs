#!/usr/bin/env node
// Checks the explicit summary action without a developer API key.
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

const profile = mkdtempSync(join(tmpdir(), 'prism-page-summary-'));
const server = createServer((request, response) => {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  response.end('<!doctype html><title>Summary fixture</title><main><h1>Planet data</h1><p>Mars has two moons.</p><p>api_key="synthetic-secret-123"</p></main>');
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
  await waitFor(() => evaluate("!!document.querySelector('#summarize-page')"), 'summary button');
  if (!(await evaluate("document.querySelector('#summarize-page').disabled"))) {
    throw new Error('Summary was enabled before session start');
  }
  await evaluate("document.querySelector('#model').value = 'test-model'; document.querySelector('#api-key').value = 'synthetic-invalid-key'; document.querySelector('#start-form').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#summarize-page').disabled"), 'active session');
  if (await evaluate("document.querySelector('#messages').textContent.includes('Summarize the active page')")) {
    throw new Error('Summary began without the button press');
  }
  await evaluate("chrome.send('prismAskPage', ['a'.repeat(2049)])");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('at most 2 KiB')"), 'question size refusal');
  await evaluate("document.querySelector('#prompt').value = 'How many moons does Mars have?'");
  await page.goto('chrome://version/');
  await evaluate("document.querySelector('#ask-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Open an HTTP')"), 'internal-page question refusal');
  if (!(await evaluate("document.querySelector('#prompt').value.includes('How many moons')"))) {
    throw new Error('Rejected page question was lost');
  }
  await page.goto(origin);
  const width = await evaluate('({viewport: innerWidth, scroll: document.documentElement.scrollWidth})');
  if (width.scroll > width.viewport) throw new Error('Page question controls overflow the panel');
  if (process.env.PRISM_PAGE_QUESTION_SCREENSHOT) {
    execFileSync('import', ['-window', 'root', process.env.PRISM_PAGE_QUESTION_SCREENSHOT]);
  }
  await evaluate("document.querySelector('#ask-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent === 'Page question sent.'"), 'page question dispatch');
  const question = await evaluate("({message: document.querySelector('#messages').textContent, composer: document.querySelector('#prompt').value})");
  if (!question.message.includes('How many moons does Mars have?') || question.composer) {
    throw new Error(`Page question UI state incorrect: ${JSON.stringify(question)}`);
  }
  await waitFor(() => evaluate("!document.querySelector('#setup').hidden"), 'offline question failure');
  await evaluate("document.querySelector('#api-key').value = 'synthetic-invalid-key'; document.querySelector('#start-form').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#summarize-page').disabled"), 'second session');
  await page.goto('chrome://version/');
  await evaluate("document.querySelector('#summarize-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Open an HTTP')"), 'internal-page refusal');
  if (await evaluate("document.querySelector('#messages').textContent.includes('Summarize the active page')")) {
    throw new Error('Internal page reached the model request');
  }
  await page.goto(origin);
  await evaluate("document.querySelector('#summarize-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent === 'Summary request sent.'"), 'summary dispatch');
  const state = await evaluate("({message: document.querySelector('#messages').textContent, preview: document.querySelector('#page-preview-text').textContent, busy: document.querySelector('#summarize-page').disabled})");
  if (!state.message.includes('Summarize the active page') || state.preview.includes('synthetic-secret-123') || !state.busy) {
    throw new Error(`Summary UI state incorrect: ${JSON.stringify(state)}`);
  }
  await waitFor(() => evaluate("!document.querySelector('#setup').hidden"), 'offline summary failure');
  await page.goto('chrome://version/');
  await waitFor(() => evaluate("document.querySelector('#summarize-page').disabled"), 'inactive session');
  console.log('PASS: explicit summary and page question dispatch, session gating, internal-page refusals, offline failures');
} finally {
  socket?.close();
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(profile, {recursive: true, force: true});
}
