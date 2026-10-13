import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import {createAdblockRuleOwner} from
  '../../prism/blocking/adblock_rule_owner.mjs';
import {createSignedPackageStore} from
  '../../prism/blocking/signed_package_store.mjs';
import {defaultMediaSettings} from
  '../../prism/settings/media_controls_store.mjs';

async function fixture() {
  const pair = await webcrypto.subtle.generateKey('Ed25519', true,
    ['sign', 'verify']);
  const publicKey = new Uint8Array(await webcrypto.subtle.exportKey('raw',
    pair.publicKey));
  const trustedKeys = new Map([['test-key', {
    sourceId: 'prism.synthetic', publicKey,
  }]]);
  const data = {};
  const storageArea = {
    async setAccessLevel() {},
    async get(key) { return {[key]: structuredClone(data[key])}; },
    async set(record) { Object.assign(data, structuredClone(record)); },
  };
  const packageStore = createSignedPackageStore({storageArea, trustedKeys,
    incognito: false, subtle: webcrypto.subtle});
  const settings = defaultMediaSettings();
  settings.adblock.enabled = true;
  const settingsStore = {async load() {
    return {settings: structuredClone(settings), error: null};
  }};
  let rules = [];
  const calls = [];
  let hold = null;
  const dnrApi = {
    async getDynamicRules() {
      calls.push('read');
      return structuredClone(rules);
    },
    async updateDynamicRules({removeRuleIds, addRules}) {
      calls.push('update');
      if (hold) {
        const pending = hold;
        hold = null;
        pending.enter();
        await pending.wait;
      }
      rules = [...rules.filter(rule => !removeRuleIds.includes(rule.id)),
        ...structuredClone(addRules)];
    },
  };
  const owner = createAdblockRuleOwner({settingsStore, packageStore,
    trustedKeys, dnrApi, incognito: false, subtle: webcrypto.subtle});
  return {owner, packageStore, settings, calls,
    get rules() { return structuredClone(rules); },
    holdNextUpdate() {
      let enter;
      let release;
      const entered = new Promise(resolve => { enter = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      hold = {enter, wait};
      return {entered, release};
    },
    async envelope(version, destinationHost) {
      const payload = new TextEncoder().encode(JSON.stringify({
        sourceId: 'prism.synthetic', version,
        rules: [{id: 1, destinationHost, resourceTypes: ['script']}],
      }));
      const signature = new Uint8Array(await webcrypto.subtle.sign('Ed25519',
        pair.privateKey, payload));
      return {keyId: 'test-key',
        payload: Buffer.from(payload).toString('base64url'),
        signature: Buffer.from(signature).toString('base64url')};
    },
  };
}

test('startup, update, and settings reconciliation share one DNR queue',
  async () => {
    const item = await fixture();
    const first = await item.envelope('1.0.0', 'ads.prism.test');
    const next = await item.envelope('1.1.0', 'newads.prism.test');
    assert.equal((await item.packageStore.save(first)).ok, true);
    const gate = item.holdNextUpdate();
    const startup = item.owner.startup();
    await gate.entered;
    const update = item.owner.installUpdate(next);
    const settings = item.owner.settingsChanged();
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(item.calls.filter(call => call === 'update').length, 1);
    gate.release();
    const results = await Promise.all([startup, update, settings]);
    assert.deepEqual(results.map(result => result.ok), [true, true, true]);
    assert.equal(item.rules.length, 1);
    assert.deepEqual(item.rules[0].condition.requestDomains,
      ['newads.prism.test']);
    assert.equal((await item.packageStore.load()).candidate.provenance.version,
      '1.1.0');
    item.settings.adblock.enabled = false;
    assert.deepEqual(await item.owner.settingsChanged(),
      {ok: true, state: 'disabled', error: null});
    assert.deepEqual(item.rules, []);
  });

test('rejected update does not poison later reconciliation', async () => {
  const item = await fixture();
  assert.equal((await item.packageStore.save(
    await item.envelope('1.0.0', 'ads.prism.test'))).ok, true);
  const rejected = await item.owner.installUpdate({signature: 'bad'});
  assert.equal(rejected.ok, false);
  assert.equal((await item.owner.startup()).ok, true);
  assert.deepEqual(item.rules[0].condition.requestDomains,
    ['ads.prism.test']);
});

test('Incognito owner touches no external state', async () => {
  const calls = [];
  const owner = createAdblockRuleOwner({incognito: true,
    settingsStore: {load() { calls.push('settings'); }},
    packageStore: {load() { calls.push('package'); }},
    dnrApi: {getDynamicRules() { calls.push('dnr'); }}});
  const results = await Promise.all([owner.startup(),
    owner.settingsChanged(), owner.installUpdate({})]);
  assert.equal(results.every(result =>
    result.error === 'incognito_disabled'), true);
  assert.deepEqual(calls, []);
});
