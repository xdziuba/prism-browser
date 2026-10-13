import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import {reconcileAdblockStartup} from
  '../../prism/blocking/startup_reconciliation.mjs';
import {defaultMediaSettings} from
  '../../prism/settings/media_controls_store.mjs';

const subtle = webcrypto.subtle;
const bundle = {
  sourceId: 'prism.synthetic', version: '1.0.0',
  rules: [{id: 1, destinationHost: 'ads.prism.test',
    resourceTypes: ['script']}],
};

async function signedFixture() {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = new Uint8Array(await subtle.exportKey('raw',
    pair.publicKey));
  const payload = new TextEncoder().encode(JSON.stringify(bundle));
  const signature = new Uint8Array(await subtle.sign('Ed25519',
    pair.privateKey, payload));
  return {
    envelope: {keyId: 'test-key', payload: Buffer.from(payload).toString(
      'base64url'), signature: Buffer.from(signature).toString('base64url')},
    trustedKeys: new Map([['test-key', {
      sourceId: 'prism.synthetic', publicKey,
    }]]),
  };
}

function dnrFixture(initial = []) {
  let rules = structuredClone(initial);
  const calls = [];
  return {
    calls,
    get rules() { return structuredClone(rules); },
    async getDynamicRules() {
      calls.push('get');
      return structuredClone(rules);
    },
    async updateDynamicRules({removeRuleIds, addRules}) {
      calls.push('update');
      rules = [...rules.filter(rule => !removeRuleIds.includes(rule.id)),
        ...structuredClone(addRules)];
    },
  };
}

function options({settings = defaultMediaSettings(), settingsError = null,
    envelope = null, trustedKeys = new Map(), dnrApi = dnrFixture(),
    incognito = false} = {}) {
  return {
    settingsStore: {load: async () => ({settings, error: settingsError})},
    loadSignedEnvelope: async () => envelope,
    trustedKeys, dnrApi, incognito, subtle,
  };
}

test('startup verifies signed rules with current site exclusions', async () => {
  const {envelope, trustedKeys} = await signedFixture();
  const settings = defaultMediaSettings();
  settings.adblock.enabled = true;
  settings.adblock.disabledSites = ['news.prism.test'];
  const dnrApi = dnrFixture();
  const result = await reconcileAdblockStartup(options({
    settings, envelope, trustedKeys, dnrApi,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.state, 'enabled');
  assert.equal(result.provenance.sourceId, 'prism.synthetic');
  assert.deepEqual(dnrApi.rules[0].condition.excludedTopDomains,
    ['news.prism.test']);
});

test('disabled or invalid settings clear rules persisted from prior run', async () => {
  const {envelope, trustedKeys} = await signedFixture();
  const enabled = defaultMediaSettings();
  enabled.adblock.enabled = true;
  const dnrApi = dnrFixture();
  await reconcileAdblockStartup(options({
    settings: enabled, envelope, trustedKeys, dnrApi,
  }));
  assert.equal(dnrApi.rules.length, 1);
  let reads = 0;
  const disabled = await reconcileAdblockStartup({
    ...options({dnrApi}),
    loadSignedEnvelope: async () => { ++reads; throw new Error('not needed'); },
  });
  assert.deepEqual(disabled,
    {ok: true, state: 'disabled', error: null});
  assert.equal(reads, 0);
  assert.deepEqual(dnrApi.rules, []);

  await reconcileAdblockStartup(options({
    settings: enabled, envelope, trustedKeys, dnrApi,
  }));
  const malformed = await reconcileAdblockStartup(options({
    settings: {...enabled, version: 2}, dnrApi,
  }));
  assert.deepEqual(malformed,
    {ok: false, state: 'disabled', error: 'settings_error'});
  assert.deepEqual(dnrApi.rules, []);
});

test('missing or tampered signed package clears stale rules', async () => {
  const {envelope, trustedKeys} = await signedFixture();
  const settings = defaultMediaSettings();
  settings.adblock.enabled = true;
  const stale = [{id: 7, priority: 1, action: {type: 'block'},
    condition: {requestDomains: ['stale.prism.test'],
      resourceTypes: ['script']}}];
  for (const [packageValue, error] of [
    [null, 'package_unavailable'],
    [{...envelope, signature: 'AA'}, 'verification_failed'],
  ]) {
    const dnrApi = dnrFixture(stale);
    const result = await reconcileAdblockStartup(options({
      settings, envelope: packageValue, trustedKeys, dnrApi,
    }));
    assert.deepEqual(result, {ok: false, state: 'disabled', error});
    assert.deepEqual(dnrApi.rules, []);
  }
});

test('DNR failure is reported as unknown, not safely disabled', async () => {
  const dnrApi = dnrFixture([{id: 1, priority: 1,
    action: {type: 'block'}, condition: {
      requestDomains: ['ads.prism.test'], resourceTypes: ['script'],
    }}]);
  dnrApi.updateDynamicRules = async () => { throw new Error('failure'); };
  const result = await reconcileAdblockStartup(options({dnrApi}));
  assert.deepEqual(result,
    {ok: false, state: 'unknown', error: 'clear_failed'});
  assert.equal(dnrApi.rules.length, 1);
});

test('Incognito touches neither settings, package, nor DNR', async () => {
  const dnrApi = dnrFixture();
  const result = await reconcileAdblockStartup({
    incognito: true, dnrApi,
    settingsStore: {load: () => { throw new Error('settings accessed'); }},
    loadSignedEnvelope: () => { throw new Error('package accessed'); },
  });
  assert.deepEqual(result,
    {ok: false, state: 'skipped', error: 'incognito_disabled'});
  assert.deepEqual(dnrApi.calls, []);
});
