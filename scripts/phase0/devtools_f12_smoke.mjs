#!/usr/bin/env node
// Exercises the built browser's F12 accelerator on an isolated X11 display.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

if (!process.env.DISPLAY || process.env.DISPLAY === ':0') {
  throw new Error('Run under an isolated X11 display, not the user desktop');
}
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDir, '..', '..');
const binary = realpathSync(process.argv[2]);
const source = resolve(dirname(binary), '..', '..');
if (!existsSync(join(source, '.git'))) {
  throw new Error('The binary must be in the full Chromium source checkout');
}
const expected = JSON.parse(readFileSync(join(repository, 'chromium.lock.json'), 'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== expected) throw new Error(`Chromium source is ${actual}, expected ${expected}`);
const profile = mkdtempSync(join(tmpdir(), 'prism-devtools-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: binary,
    headless: false,
    args: ['--ozone-platform=x11', '--no-first-run'],
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('data:text/html,<title>Prism Phase 0 F12 Test</title><h1>F12</h1>');
  const session = await context.newCDPSession(page);
  await delay(500);
  execFileSync('python3', [
    join(scriptDir, 'x11_key_probe.py'),
    ':main', 'F12',
  ], {stdio: 'inherit'});

  let target;
  for (let attempt = 0; attempt < 30; attempt++) {
    const {targetInfos} = await session.send('Target.getTargets');
    target = targetInfos.find(info => info.url.startsWith('devtools://'));
    if (target) break;
    await delay(200);
  }
  if (!target) throw new Error('F12 did not open a DevTools target');
  if (process.env.PRISM_DEVTOOLS_SCREENSHOT) {
    await delay(1500);
    execFileSync('import', ['-window', 'root', process.env.PRISM_DEVTOOLS_SCREENSHOT]);
  }
  console.log(`PASS: F12 opened ${target.title} (${target.url})`);
} finally {
  await context?.close();
  rmSync(profile, {recursive: true, force: true});
}
