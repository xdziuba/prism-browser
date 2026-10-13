#!/usr/bin/env node
// Exercises compiled synthetic DNR rules in the existing source-built browser.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync,
  writeFileSync, mkdirSync} from 'node:fs';
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

const bundle = {sourceId: 'prism.synthetic', version: '1.0.0', rules: [{
  id: 1, destinationHost: 'ads.prism.test', resourceTypes: ['script'],
}]};
const compiled = compileAdblockRules({bundle, settings: {
  enabled: true, disabledSites: ['allowed.prism.test'],
}});
const root = mkdtempSync(join(tmpdir(), 'prism-adblock-'));
const fixture = join(root, 'fixture');
mkdirSync(fixture);
writeFileSync(join(fixture, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Prism Synthetic Rule Smoke',
  version: '0.1.0',
  permissions: ['declarativeNetRequest'],
  declarative_net_request: {rule_resources: [
    {id: 'probe', enabled: true, path: 'rules.json'},
  ]},
}));
writeFileSync(join(fixture, 'rules.json'), JSON.stringify(compiled.rules));

const server = createServer((request, response) => {
  if (request.url === '/probe.js') {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end('window.prismAdProbeLoaded = true;');
  } else {
    response.writeHead(200, {'content-type': 'text/html'});
    response.end('<!doctype html><title>Prism rule probe</title>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const scriptUrl = `http://ads.prism.test:${port}/probe.js`;
const hostRules = 'MAP ads.prism.test 127.0.0.1,' +
  'MAP blocked.prism.test 127.0.0.1,' +
  'MAP allowed.prism.test 127.0.0.1';

async function probe(useExtension, topHost) {
  const profile = join(root, `profile-${topHost}-${useExtension}`);
  const args = ['--no-proxy-server', `--host-resolver-rules=${hostRules}`];
  if (useExtension) {
    args.push(`--disable-extensions-except=${fixture}`,
      `--load-extension=${fixture}`);
  }
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: binary,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args,
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`http://${topHost}:${port}/`, {timeout: 10000});
    let failed;
    page.on('requestfailed', request => {
      if (request.url() === scriptUrl) {
        failed = request.failure()?.errorText;
      }
    });
    try {
      await page.addScriptTag({url: scriptUrl});
    } catch (error) {
      if (!useExtension || topHost === 'allowed.prism.test') {
        throw error;
      }
    }
    return {loaded: await page.evaluate(() => !!window.prismAdProbeLoaded),
      failed};
  } finally {
    await context.close();
  }
}

try {
  const baseline = await probe(false, 'blocked.prism.test');
  const blocked = await probe(true, 'blocked.prism.test');
  const excluded = await probe(true, 'allowed.prism.test');
  if (!baseline.loaded || baseline.failed || blocked.loaded ||
      blocked.failed !== 'net::ERR_BLOCKED_BY_CLIENT' ||
      !excluded.loaded || excluded.failed) {
    throw new Error(`Unexpected DNR results: ${JSON.stringify({
      baseline, blocked, excluded,
    })}`);
  }
  console.log('PASS: compiled rule blocked one site and spared the excluded site');
} finally {
  await new Promise(resolve => server.close(resolve));
  rmSync(root, {recursive: true, force: true});
}
