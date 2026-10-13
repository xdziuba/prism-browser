import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import {createSignedPackageStore, SIGNED_PACKAGE_KEY} from
  '../../prism/blocking/signed_package_store.mjs';
import {createSignedRuleCoordinator} from
  '../../prism/blocking/signed_rule_coordinator.mjs';
import {defaultMediaSettings} from
  '../../prism/settings/media_controls_store.mjs';

const subtle = webcrypto.subtle;

async function fixture() {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = new Uint8Array(await subtle.exportKey('raw',
    pair.publicKey));
  const trustedKeys = new Map([['test-key', {
    sourceId: 'prism.synthetic', publicKey,
  }]]);
  const data = {};
  let writeMode = 'normal';
  let readFails = false;
  const storageArea = {
    async setAccessLevel() {},
    async get() {
      if (readFails) {
        throw new Error('unavailable');
      }
      return structuredClone(data);
    },
    async set(value) {
      if (writeMode === 'reject') {
        throw new Error('write failed');
      }
      Object.assign(data, structuredClone(value));
      if (writeMode === 'write-then-reject') {
        throw new Error('reply lost');
      }
    },
  };
  const packageStore = createSignedPackageStore({storageArea, trustedKeys,
    incognito: false, subtle});
  const settings = defaultMediaSettings();
  settings.adblock.enabled = true;
  settings.adblock.disabledSites = ['allowed.prism.test'];
  const settingsStore = {load: async () => ({settings, error: null})};
  let rules = [];
  let rejectUpdate = false;
  let rejectFromUpdate = Infinity;
  let updateCount = 0;
  const dnrApi = {
    async getDynamicRules() { return structuredClone(rules); },
    async updateDynamicRules({removeRuleIds, addRules}) {
      ++updateCount;
      if (rejectUpdate || updateCount >= rejectFromUpdate) {
        throw new Error('DNR failure');
      }
      rules = [...rules.filter(rule => !removeRuleIds.includes(rule.id)),
        ...structuredClone(addRules)];
    },
  };
  const coordinator = createSignedRuleCoordinator({settingsStore,
    packageStore, dnrApi, trustedKeys, incognito: false, subtle});
  return {
    coordinator, packageStore, settings, data,
    get rules() { return structuredClone(rules); },
    setWriteMode: mode => { writeMode = mode; },
    setReadFails: value => { readFails = value; },
    setRejectUpdate: value => { rejectUpdate = value; },
    setRejectFromUpdate: value => { rejectFromUpdate = value; },
    async envelope(version, destinationHost = 'ads.prism.test') {
      const payload = new TextEncoder().encode(JSON.stringify({
        sourceId: 'prism.synthetic', version,
        rules: [{id: 1, destinationHost, resourceTypes: ['script']}],
      }));
      const signature = new Uint8Array(await subtle.sign('Ed25519',
        pair.privateKey, payload));
      return {keyId: 'test-key',
        payload: Buffer.from(payload).toString('base64url'),
        signature: Buffer.from(signature).toString('base64url')};
    },
  };
}

test('activates signed rules before committing an advancing cache version', async () => {
  const item = await fixture();
  const first = await item.coordinator(await item.envelope('1.0.0'));
  assert.equal(first.ok, true);
  assert.equal(first.provenance.version, '1.0.0');
  assert.deepEqual(item.rules[0].condition.excludedTopDomains,
    ['allowed.prism.test']);
  const second = await item.coordinator(await item.envelope('1.1.0',
    'new.prism.test'));
  assert.equal(second.ok, true);
  assert.deepEqual(item.rules[0].condition.requestDomains,
    ['new.prism.test']);
  assert.equal((await item.packageStore.load()).candidate.provenance.version,
    '1.1.0');
  const rollback = await item.coordinator(await item.envelope('1.0.0'));
  assert.equal(rollback.error, 'rollback');
  assert.deepEqual(item.rules[0].condition.requestDomains,
    ['new.prism.test']);
});

test('rejected DNR installation does not advance the cached package', async () => {
  const item = await fixture();
  await item.coordinator(await item.envelope('1.0.0'));
  item.setRejectUpdate(true);
  const result = await item.coordinator(await item.envelope('1.1.0',
    'new.prism.test'));
  assert.deepEqual(result, {ok: false, state: 'unchanged',
    error: 'activation_failed'});
  assert.deepEqual(item.rules[0].condition.requestDomains,
    ['ads.prism.test']);
  assert.equal((await item.packageStore.load()).candidate.provenance.version,
    '1.0.0');
});

test('cache write failure restores the prior installed DNR rules', async () => {
  const item = await fixture();
  await item.coordinator(await item.envelope('1.0.0'));
  item.setWriteMode('reject');
  const result = await item.coordinator(await item.envelope('1.1.0',
    'new.prism.test'));
  assert.deepEqual(result, {ok: false, state: 'restored',
    error: 'cache_commit_failed'});
  assert.deepEqual(item.rules[0].condition.requestDomains,
    ['ads.prism.test']);
  assert.equal((await item.packageStore.load()).candidate.provenance.version,
    '1.0.0');
});

test('failed rollback reports unknown rule state', async () => {
  const item = await fixture();
  await item.coordinator(await item.envelope('1.0.0'));
  item.setWriteMode('reject');
  item.setRejectFromUpdate(3);
  const result = await item.coordinator(await item.envelope('1.1.0',
    'new.prism.test'));
  assert.deepEqual(result, {ok: false, state: 'unknown',
    error: 'rollback_failed'});
  assert.deepEqual(item.rules[0].condition.requestDomains,
    ['new.prism.test']);
});

test('lost write acknowledgement is resolved by re-verifying the cache', async () => {
  const item = await fixture();
  item.setWriteMode('write-then-reject');
  const result = await item.coordinator(await item.envelope('1.0.0'));
  assert.equal(result.ok, true);
  assert.equal((await item.packageStore.load()).candidate.provenance.version,
    '1.0.0');
  assert.equal(item.rules.length, 1);
});

test('unreadable cache after activation clears DNR and reports failure', async () => {
  const item = await fixture();
  const originalSave = item.packageStore.save;
  item.packageStore.save = async envelope => {
    item.setReadFails(true);
    return originalSave(envelope);
  };
  const result = await item.coordinator(await item.envelope('1.0.0'));
  assert.deepEqual(result, {ok: false, state: 'disabled',
    error: 'cache_commit_failed'});
  assert.deepEqual(item.rules, []);
});

test('concurrent calls serialize and Incognito never touches dependencies', async () => {
  const item = await fixture();
  const [newer, older] = await Promise.all([
    item.coordinator(await item.envelope('2.0.0')),
    item.coordinator(await item.envelope('1.0.0')),
  ]);
  assert.equal(newer.ok, true);
  assert.equal(older.error, 'rollback');
  assert.equal((await item.packageStore.load()).candidate.provenance.version,
    '2.0.0');

  const privateCoordinator = createSignedRuleCoordinator({
    incognito: true,
    settingsStore: {load() { throw new Error('settings touched'); }},
    packageStore: {load() { throw new Error('cache touched'); }},
    dnrApi: {getDynamicRules() { throw new Error('DNR touched'); }},
  });
  assert.deepEqual(await privateCoordinator(null),
    {ok: false, state: 'skipped', error: 'incognito_disabled'});
  assert.ok(item.data[SIGNED_PACKAGE_KEY]);
});
