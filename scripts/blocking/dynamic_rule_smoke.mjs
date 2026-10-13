#!/usr/bin/env node
// Exercises dynamic-rule replacement in the existing source-built Chromium.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {cpSync, existsSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {compileAdblockRules} from '../../prism/blocking/rule_compiler.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) {
  throw new Error('The binary must be in the full Chromium source checkout');
}
const expected = JSON.parse(readFileSync(join(repo, 'chromium.lock.json'),
  'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'],
  {encoding: 'utf8'}).trim();
if (actual !== expected) {
  throw new Error(`Chromium source is ${actual}, expected ${expected}`);
}

const candidate = compileAdblockRules({bundle: {
  sourceId: 'prism.synthetic', version: '1.0.0', rules: [{
    id: 1, destinationHost: 'ads.prism.test', resourceTypes: ['script'],
  }],
}, settings: {enabled: true, disabledSites: ['allowed.prism.test']}});
const root = mkdtempSync(join(tmpdir(), 'prism-dynamic-rule-'));
const fixture = join(root, 'fixture');
mkdirSync(fixture);
writeFileSync(join(fixture, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Prism Dynamic Rule Smoke',
  version: '0.1.0',
  permissions: ['declarativeNetRequest'],
  background: {service_worker: 'worker.js'},
}));
writeFileSync(join(fixture, 'worker.js'),
  'chrome.runtime.onInstalled.addListener(() => {});');
writeFileSync(join(fixture, 'control.html'),
  '<!doctype html><script type="module" src="control.mjs"></script>');
writeFileSync(join(fixture, 'control.mjs'),
  `import {createDynamicRuleActivator} from './rule_activation.mjs';
   window.prismReplace = createDynamicRuleActivator(chrome.declarativeNetRequest);`);
for (const file of ['rule_activation.mjs', 'rule_compiler.mjs']) {
  cpSync(join(repo, 'prism', 'blocking', file), join(fixture, file));
}

const server = createServer((request, response) => {
  if (request.url === '/probe.js') {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end('window.prismAdProbeLoaded = true;');
  } else {
    response.writeHead(200, {'content-type': 'text/html'});
    response.end('<!doctype html><title>Prism dynamic rule probe</title>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const scriptUrl = `http://ads.prism.test:${port}/probe.js`;
const hostRules = 'MAP ads.prism.test 127.0.0.1,' +
  'MAP blocked.prism.test 127.0.0.1,' +
  'MAP allowed.prism.test 127.0.0.1';
let context;

async function probe(topHost) {
  const page = await context.newPage();
  try {
    await page.goto(`http://${topHost}:${port}/`, {timeout: 10000});
    let failed;
    page.on('requestfailed', request => {
      if (request.url() === scriptUrl) {
        failed = request.failure()?.errorText;
      }
    });
    try {
      await page.addScriptTag({url: scriptUrl});
    } catch {
      // A blocked request is the expected outcome for one case.
    }
    return {loaded: await page.evaluate(() => !!window.prismAdProbeLoaded),
      failed};
  } finally {
    await page.close();
  }
}

try {
  context = await chromium.launchPersistentContext(join(root, 'profile'), {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-proxy-server', `--host-resolver-rules=${hostRules}`,
      `--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`],
  });
  const worker = context.serviceWorkers()[0] ??
    await context.waitForEvent('serviceworker', {timeout: 10000});
  const extensionId = new URL(worker.url()).hostname;
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/control.html`);
  await control.waitForFunction(() => !!window.prismReplace);

  const baseline = await probe('blocked.prism.test');
  const installed = await control.evaluate(value =>
    window.prismReplace(value), candidate);
  const blocked = await probe('blocked.prism.test');
  const excluded = await probe('allowed.prism.test');
  const invalid = await control.evaluate(() => window.prismReplace({
    rules: [{id: 9, priority: 1, action: {type: 'redirect'},
      condition: {requestDomains: ['ads.prism.test'],
        resourceTypes: ['script']}}],
  }));
  const stillBlocked = await probe('blocked.prism.test');
  const disabled = await control.evaluate(() => window.prismReplace({
    rules: [], provenance: null,
  }));
  const afterDisable = await probe('blocked.prism.test');
  if (!baseline.loaded || !installed.ok || blocked.loaded ||
      blocked.failed !== 'net::ERR_BLOCKED_BY_CLIENT' ||
      !excluded.loaded || invalid.error !== 'invalid_candidate' ||
      stillBlocked.loaded ||
      stillBlocked.failed !== 'net::ERR_BLOCKED_BY_CLIENT' ||
      !disabled.ok || !afterDisable.loaded) {
    throw new Error(`Unexpected dynamic DNR result: ${JSON.stringify({
      baseline, installed, blocked, excluded, invalid, stillBlocked,
      disabled, afterDisable,
    })}`);
  }
  console.log('PASS: dynamic rule replacement, site exclusion, and disable');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
