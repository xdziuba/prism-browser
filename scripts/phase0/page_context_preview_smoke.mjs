#!/usr/bin/env node
// Exercises the native panel's user-invoked read path in the source-built browser.
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

const profile = mkdtempSync(join(tmpdir(), 'prism-page-preview-'));
const server = createServer((request, response) => {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  response.end(request.url === '/second'
    ? '<!doctype html><title>Second</title><main><h1>Second document</h1><p>Changed tab content.</p></main>'
    : '<!doctype html><title>First</title><main><h1>Research notes</h1><p>Visible project summary.</p><p>api_key="synthetic-secret-123"</p><p>Authorization : Bearer synthetic-header-123</p><p>Cookie : session=synthetic-cookie-123</p><label>Private field<input value="editable-secret-456"></label><div aria-hidden="true">hidden-secret-789</div></main>');
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
  const deadline = Date.now() + 8000;
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
    args: ['--ozone-platform=x11', '--no-first-run', '--remote-debugging-port=0'],
    env: browserEnv, viewport: {width: 1100, height: 820},
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('chrome://prism-ai/');
  const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  await page.locator('#open-side-panel').click();
  const evaluate = await attachPanel(port);
  await page.goto(origin);
  await waitFor(() => evaluate("!!document.querySelector('#preview-page')"), 'preview control');
  await evaluate("document.querySelector('#preview-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Context ready')"), 'first page preview');
  const first = await evaluate("document.querySelector('#page-preview-text').textContent");
  const status = await evaluate("document.querySelector('#page-preview-status').textContent");
  if (!status.includes(origin) || !first.includes('Research notes') ||
      !first.includes('Visible project summary.') || !first.includes('[redacted]') ||
      first.includes('synthetic-secret-123') || first.includes('editable-secret-456') ||
      first.includes('hidden-secret-789') || first.includes('synthetic-header-123') ||
      first.includes('synthetic-cookie-123')) {
    const cdp = await context.newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    const roles = ax.nodes.reduce((counts, node) => {
      const role = node.role?.value ?? 'unknown';
      counts[role] = (counts[role] ?? 0) + 1;
      return counts;
    }, {});
    await cdp.detach();
    throw new Error(`First preview incorrect: ${JSON.stringify({
      origin: status.includes(origin), heading: first.includes('Research notes'),
      summary: first.includes('Visible project summary.'), redacted: first.includes('[redacted]'),
      leakedInline: first.includes('synthetic-secret-123'),
      leakedInput: first.includes('editable-secret-456'), length: first.length,
      leakedHidden: first.includes('hidden-secret-789'),
      leakedHeader: first.includes('synthetic-header-123'),
      leakedCookie: first.includes('synthetic-cookie-123'),
      axNodeCount: ax.nodes.length, roles,
      axShape: ax.nodes.map(node => ({role: node.role?.value, ignored: node.ignored,
        children: node.childIds?.length ?? 0})),
    })}`);
  }
  await page.goto(`${origin}/second`);
  await evaluate("document.querySelector('#preview-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-text').textContent.includes('Second document')"), 'fresh page preview');
  const second = await evaluate("document.querySelector('#page-preview-text').textContent");
  if (second.includes('Research notes') ||
      second.split('Second document').length !== 2) {
    throw new Error('Preview retained stale or duplicate heading content');
  }
  if (process.env.PRISM_PAGE_PREVIEW_SCREENSHOT) {
    execFileSync('import', ['-window', 'root', process.env.PRISM_PAGE_PREVIEW_SCREENSHOT]);
  }
  await page.goto('chrome://version/');
  await evaluate("document.querySelector('#preview-page').click()");
  await waitFor(() => evaluate("document.querySelector('#page-preview-status').textContent.includes('Open an HTTP')"), 'internal-page refusal');
  const width = await evaluate('({viewport: innerWidth, scroll: document.documentElement.scrollWidth})');
  if (width.scroll > width.viewport) throw new Error('Preview caused panel overflow');
  console.log('PASS: live page preview, redaction, navigation refresh, internal-page refusal');
} finally {
  socket?.close();
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(profile, {recursive: true, force: true});
}
