import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import {readAdblockStatus} from '../../prism/blocking/rule_diagnostics.mjs';
import {prepareSignedRuleUpdate} from
  '../../prism/blocking/signed_rule_update.mjs';
import {defaultMediaSettings} from
  '../../prism/settings/media_controls_store.mjs';

async function fixture() {
  const pair = await webcrypto.subtle.generateKey('Ed25519', true,
    ['sign', 'verify']);
  const publicKey = new Uint8Array(await webcrypto.subtle.exportKey('raw',
    pair.publicKey));
  const trustedKeys = new Map([['test-key',
    {sourceId: 'prism.synthetic', publicKey}]]);
  const payload = new TextEncoder().encode(JSON.stringify({
    sourceId: 'prism.synthetic', version: '1.2.0', rules: [{id: 1,
      destinationHost: 'ads.prism.test', resourceTypes: ['script']}],
  }));
  const signature = new Uint8Array(await webcrypto.subtle.sign('Ed25519',
    pair.privateKey, payload));
  const envelope = {keyId: 'test-key',
    payload: Buffer.from(payload).toString('base64url'),
    signature: Buffer.from(signature).toString('base64url')};
  const settings = defaultMediaSettings();
  settings.adblock.enabled = true;
  settings.adblock.disabledSites = ['news.prism.test'];
  const prepared = await prepareSignedRuleUpdate({envelope, trustedKeys,
    settings: settings.adblock, subtle: webcrypto.subtle});
  assert.equal(prepared.error, null);
  let rules = prepared.candidate.rules;
  let cached = envelope;
  const dependencies = {incognito: false, trustedKeys,
    subtle: webcrypto.subtle,
    settingsStore: {async load() { return {settings, error: null}; }},
    packageStore: {async load() { return {envelope: cached, error: null}; }},
    dnrApi: {async getDynamicRules() { return structuredClone(rules); }},
  };
  return {dependencies, settings,
    setRules(value) { rules = value; },
    setCached(value) { cached = value; }};
}

test('reports active signed source only when DNR matches current settings',
  async () => {
    const item = await fixture();
    assert.deepEqual(await readAdblockStatus(item.dependencies), {
      state: 'active', ruleCount: 1,
      sourceId: 'prism.synthetic', version: '1.2.0',
    });
    item.settings.adblock.disabledSites = [];
    assert.deepEqual(await readAdblockStatus(item.dependencies), {
      state: 'drift', ruleCount: 1, sourceId: null, version: null,
    });
  });

test('disabled, missing package, and stale installed rules stay distinct',
  async () => {
    const item = await fixture();
    item.settings.adblock.enabled = false;
    assert.equal((await readAdblockStatus(item.dependencies)).state, 'drift');
    item.setRules([]);
    assert.deepEqual(await readAdblockStatus(item.dependencies), {
      state: 'disabled', ruleCount: 0, sourceId: null, version: null,
    });
    item.settings.adblock.enabled = true;
    item.setCached(null);
    assert.equal((await readAdblockStatus(item.dependencies)).state,
      'unavailable');
  });

test('Incognito status never touches settings, package, or DNR', async () => {
  const calls = [];
  const status = await readAdblockStatus({incognito: true,
    settingsStore: {load() { calls.push('settings'); }},
    packageStore: {load() { calls.push('package'); }},
    dnrApi: {getDynamicRules() { calls.push('dnr'); }}});
  assert.deepEqual(status, {state: 'unknown', ruleCount: 0,
    sourceId: null, version: null});
  assert.deepEqual(calls, []);
});
