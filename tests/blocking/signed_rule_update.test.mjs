import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import {prepareSignedRuleUpdate} from
  '../../prism/blocking/signed_rule_update.mjs';

const subtle = webcrypto.subtle;
const settings = {enabled: true};
const bundle = {sourceId: 'prism.synthetic', version: '1.0.0', rules: [{
  id: 1, destinationHost: 'ads.prism.test', resourceTypes: ['script'],
}]};
const encode = bytes => Buffer.from(bytes).toString('base64url');

async function fixture() {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = new Uint8Array(await subtle.exportKey('raw',
    pair.publicKey));
  const trustedKeys = new Map([['test-key', {
    sourceId: 'prism.synthetic', publicKey,
  }]]);
  const signBytes = async payload => {
    const signature = await subtle.sign('Ed25519', pair.privateKey, payload);
    return {keyId: 'test-key', payload: encode(payload),
      signature: encode(signature)};
  };
  const sign = value => signBytes(new TextEncoder().encode(
    JSON.stringify(value)));
  return {trustedKeys, sign, signBytes};
}

test('verified package becomes a candidate with key and digest provenance', async () => {
  const {trustedKeys, sign} = await fixture();
  const result = await prepareSignedRuleUpdate({envelope: await sign(bundle),
    trustedKeys, settings, subtle});
  assert.equal(result.error, null);
  assert.equal(result.candidate.rules.length, 1);
  assert.equal(result.candidate.provenance.keyId, 'test-key');
  assert.match(result.candidate.provenance.sha256, /^[0-9a-f]{64}$/);
});

test('tampering and unknown keys preserve the previous candidate', async () => {
  const {trustedKeys, sign} = await fixture();
  const current = {rules: [{id: 7}], provenance: {
    sourceId: 'prism.synthetic', version: '0.9.0',
  }};
  const valid = await sign(bundle);
  const tampered = {...valid, payload: encode(new TextEncoder().encode(
    JSON.stringify({...bundle, version: '9.0.0'})))};
  const unknown = {...valid, keyId: 'unknown'};
  for (const [envelope, error] of [
    [tampered, 'bad_signature'],
    [unknown, 'unknown_key'],
    [{...valid, signature: 'AA'}, 'invalid_envelope'],
    [{...valid, unexpected: true}, 'invalid_envelope'],
  ]) {
    const result = await prepareSignedRuleUpdate({envelope, trustedKeys,
      settings, current, subtle});
    assert.equal(result.error, error);
    assert.strictEqual(result.candidate, current);
  }
});

test('signed malformed rules, source changes and rollback do not replace', async () => {
  const {trustedKeys, sign} = await fixture();
  const current = {rules: [], provenance: {
    sourceId: 'prism.synthetic', version: '1.0.0',
  }};
  for (const [value, error] of [
    [{...bundle, version: '1.0.0'}, 'rollback'],
    [{...bundle, version: '0.9.9'}, 'rollback'],
    [{...bundle, version: '01.0.0'}, 'invalid_bundle'],
    [{...bundle, sourceId: 'other.source', version: '2.0.0'},
      'source_changed'],
    [{...bundle, version: '2.0.0', rules: [{id: 1,
      destinationHost: '*.invalid', resourceTypes: ['script']}]},
      'invalid_bundle'],
  ]) {
    const result = await prepareSignedRuleUpdate({envelope: await sign(value),
      trustedKeys, settings, current, subtle});
    assert.equal(result.error, error);
    assert.strictEqual(result.candidate, current);
  }
});

test('disabled settings do not inspect or replace a candidate', async () => {
  const current = {rules: [{id: 1}]};
  const result = await prepareSignedRuleUpdate({
    envelope: {malformed: true}, settings: {enabled: false}, current,
  });
  assert.equal(result.error, 'disabled');
  assert.strictEqual(result.candidate, current);
});

test('noncanonical, oversized and signed invalid UTF-8 payloads fail', async () => {
  const {trustedKeys, signBytes} = await fixture();
  const current = {rules: [{id: 7}]};
  for (const [envelope, error] of [
    [{...await signBytes(Uint8Array.of(0)), payload: 'AB'},
      'invalid_envelope'],
    [{...await signBytes(Uint8Array.of(0)),
      payload: 'A'.repeat(1_500_000)}, 'invalid_envelope'],
    [await signBytes(Uint8Array.of(0xff)), 'invalid_bundle'],
  ]) {
    const result = await prepareSignedRuleUpdate({envelope, trustedKeys,
      settings, current, subtle});
    assert.equal(result.error, error);
    assert.strictEqual(result.candidate, current);
  }
});
