#!/usr/bin/env node
// Checks Ed25519 Web Crypto verification in the pinned source-built browser.
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {createServer} from 'node:http';
import {existsSync, mkdtempSync, readFileSync, realpathSync, rmSync} from
  'node:fs';
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
const expected = JSON.parse(readFileSync(join(repo, 'chromium.lock.json'),
  'utf8')).chromium_src;
const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'],
  {encoding: 'utf8'}).trim();
if (actual !== expected) {
  throw new Error(`Chromium source is ${actual}, expected ${expected}`);
}

const pair = await webcrypto.subtle.generateKey('Ed25519', true,
  ['sign', 'verify']);
const publicKey = Array.from(new Uint8Array(await webcrypto.subtle.exportKey(
  'raw', pair.publicKey)));
const payload = new TextEncoder().encode(JSON.stringify({
  sourceId: 'prism.synthetic', version: '1.0.0', rules: [{
    id: 1, destinationHost: 'ads.prism.test', resourceTypes: ['script'],
  }],
}));
const signature = new Uint8Array(await webcrypto.subtle.sign('Ed25519',
  pair.privateKey, payload));
const envelope = {keyId: 'test-key',
  payload: Buffer.from(payload).toString('base64url'),
  signature: Buffer.from(signature).toString('base64url')};
const server = createServer((request, response) => {
  const files = {
    '/signed_rule_update.mjs': 'prism/blocking/signed_rule_update.mjs',
    '/rule_compiler.mjs': 'prism/blocking/rule_compiler.mjs',
  };
  if (Object.hasOwn(files, request.url)) {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end(readFileSync(join(repo, files[request.url])));
  } else {
    response.writeHead(200, {'content-type': 'text/html'});
    response.end('<!doctype html><title>Prism signed rule probe</title>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = mkdtempSync(join(tmpdir(), 'prism-signed-rule-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: binary, headless: true,
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async ({envelope, publicKey}) => {
    const {prepareSignedRuleUpdate} = await import('/signed_rule_update.mjs');
    const trustedKeys = new Map([['test-key', {
      sourceId: 'prism.synthetic', publicKey: Uint8Array.from(publicKey),
    }]]);
    const settings = {enabled: true};
    const valid = await prepareSignedRuleUpdate({
      envelope, trustedKeys, settings,
    });
    const tampered = await prepareSignedRuleUpdate({
      envelope: {...envelope, signature: 'AA'}, trustedKeys, settings,
      current: valid.candidate,
    });
    return {validError: valid.error,
      ruleCount: valid.candidate?.rules.length,
      tamperedError: tampered.error,
      retained: tampered.candidate === valid.candidate};
  }, {envelope, publicKey});
  if (result.validError !== null || result.ruleCount !== 1 ||
      result.tamperedError !== 'invalid_envelope' || !result.retained) {
    throw new Error(`Unexpected browser verification: ${JSON.stringify(result)}`);
  }
  console.log('PASS: pinned Chromium verified a signed synthetic rule bundle');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(profile, {recursive: true, force: true});
}
