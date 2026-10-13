import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import {createSignedPackageStore, SIGNED_PACKAGE_KEY} from
  '../../prism/blocking/signed_package_store.mjs';

const subtle = webcrypto.subtle;

async function signingFixture() {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = new Uint8Array(await subtle.exportKey('raw',
    pair.publicKey));
  return {
    trustedKeys: new Map([['test-key', {
      sourceId: 'prism.synthetic', publicKey,
    }]]),
    async envelope(version) {
      const payload = new TextEncoder().encode(JSON.stringify({
        sourceId: 'prism.synthetic', version,
        rules: [{id: 1, destinationHost: 'ads.prism.test',
          resourceTypes: ['script']}],
      }));
      const signature = new Uint8Array(await subtle.sign('Ed25519',
        pair.privateKey, payload));
      return {keyId: 'test-key',
        payload: Buffer.from(payload).toString('base64url'),
        signature: Buffer.from(signature).toString('base64url')};
    },
  };
}

function storageFixture() {
  const data = {};
  const calls = [];
  return {
    data, calls,
    async setAccessLevel(value) {
      calls.push(['access', value.accessLevel]);
    },
    async get(key) {
      calls.push(['get', key]);
      return structuredClone(data);
    },
    async set(value) {
      calls.push(['set']);
      Object.assign(data, structuredClone(value));
    },
  };
}

function store(storageArea, trustedKeys, incognito = false) {
  return createSignedPackageStore({storageArea, trustedKeys, incognito,
    subtle});
}

test('reverifies a cached envelope after restart and rejects old versions', async () => {
  const signing = await signingFixture();
  const storage = storageFixture();
  const first = store(storage, signing.trustedKeys);
  assert.deepEqual(await first.load(),
    {envelope: null, candidate: null, error: null});
  const version1 = await signing.envelope('1.0.0');
  assert.equal((await first.save(version1)).ok, true);
  const restarted = store(storage, signing.trustedKeys);
  const loaded = await restarted.load();
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.envelope, version1);
  assert.equal(loaded.candidate.provenance.version, '1.0.0');
  assert.equal((await restarted.save(await signing.envelope('0.9.0'))).error,
    'rollback');
  assert.equal((await restarted.save(version1)).error, 'rollback');
  assert.equal((await restarted.save(await signing.envelope('1.1.0'))).ok,
    true);
  assert.equal((await store(storage, signing.trustedKeys).load())
      .candidate.provenance.version, '1.1.0');
  assert.equal(storage.calls.every(([kind], index) => kind !== 'get' &&
    kind !== 'set' || storage.calls[index - 1]?.[0] === 'access'), true);
});

test('tampering fails closed and cannot silently replace the cached floor', async () => {
  const signing = await signingFixture();
  const storage = storageFixture();
  const cache = store(storage, signing.trustedKeys);
  const envelope = await signing.envelope('1.0.0');
  await cache.save(envelope);
  storage.data[SIGNED_PACKAGE_KEY].envelope.signature = 'AA';
  assert.equal((await cache.load()).error, 'invalid_package');
  assert.equal((await cache.save(await signing.envelope('1.1.0'))).error,
    'invalid_package');
  assert.equal(storage.data[SIGNED_PACKAGE_KEY].envelope.signature, 'AA');
  storage.data[SIGNED_PACKAGE_KEY] = {version: 2, envelope};
  assert.equal((await cache.load()).error, 'invalid_package');
});

test('concurrent writes serialize version checks and storage failures preserve cache', async () => {
  const signing = await signingFixture();
  const storage = storageFixture();
  const cache = store(storage, signing.trustedKeys);
  const newer = await signing.envelope('2.0.0');
  const older = await signing.envelope('1.0.0');
  const [first, second] = await Promise.all([
    cache.save(newer), cache.save(older),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.error, 'rollback');
  storage.set = async () => { throw new Error('storage failure'); };
  assert.equal((await cache.save(await signing.envelope('2.1.0'))).error,
    'storage_error');
  assert.equal((await cache.load()).candidate.provenance.version, '2.0.0');
});

test('Incognito and unavailable storage perform no read or write', async () => {
  const signing = await signingFixture();
  const storage = storageFixture();
  const privateCache = store(storage, signing.trustedKeys, true);
  assert.equal((await privateCache.load()).error, 'incognito_disabled');
  assert.equal((await privateCache.save(await signing.envelope('1.0.0'))).error,
    'incognito_disabled');
  assert.deepEqual(storage.calls, []);
  assert.equal((await store(null, signing.trustedKeys).load()).error,
    'storage_error');
});
