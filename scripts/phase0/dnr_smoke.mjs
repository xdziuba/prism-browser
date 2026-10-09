#!/usr/bin/env node
// Verifies MV3 declarativeNetRequest using a controlled local resource.
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) {
  throw new Error('The binary must be in the full Chromium source checkout');
}
const expected = JSON.parse(readFileSync(join(repo, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);
const fixtureSource = join(repo, 'tests', 'fixtures', 'dnr-extension');
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/javascript');
  response.end('window.prismDnrProbeLoaded = true;');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/prism-dnr-probe.js`;

async function probe(withExtension) {
  const profile = mkdtempSync(join(tmpdir(), 'prism-dnr-'));
  const fixture = join(profile, 'fixture');
  if (withExtension) cpSync(fixtureSource, fixture, {recursive: true});
  const args = withExtension ?
    [`--disable-extensions-except=${fixture}`, `--load-extension=${fixture}`] : [];
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: binary,
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args,
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    let failed;
    page.on('requestfailed', request => {
      if (request.url() === url) failed = request.failure()?.errorText;
    });
    try {
      await page.addScriptTag({url});
    } catch (error) {
      if (!withExtension) throw error;
    }
    return {loaded: await page.evaluate(() => !!window.prismDnrProbeLoaded), failed};
  } finally {
    await context?.close();
    rmSync(profile, {recursive: true, force: true});
  }
}

try {
  const baseline = await probe(false);
  const extension = await probe(true);
  if (!baseline.loaded || baseline.failed || extension.loaded ||
      extension.failed !== 'net::ERR_BLOCKED_BY_CLIENT') {
    throw new Error(`Unexpected DNR result: ${JSON.stringify({baseline, extension})}`);
  }
  console.log('PASS: MV3 DNR blocked the local probe script');
} finally {
  server.close();
}
