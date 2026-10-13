// Verifies a synthetic signed rule package before proposing DNR activation.
import {compileAdblockRules} from './rule_compiler.mjs';

const MAX_PAYLOAD_BYTES = 1024 * 1024;
const KEY_ID = /^[a-z][a-z0-9._-]{0,63}$/;

function decodeBase64url(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 ||
      value.length > Math.ceil(maxBytes * 4 / 3) + 2 ||
      !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    return null;
  }
  let binary;
  try {
    binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') +
        '='.repeat((4 - value.length % 4) % 4));
  } catch {
    return null;
  }
  if (binary.length > maxBytes) {
    return null;
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  let canonical = '';
  for (let offset = 0; offset < bytes.length; offset += 8190) {
    canonical += btoa(String.fromCharCode(...bytes.subarray(offset,
      offset + 8190)));
  }
  return canonical.replaceAll('+', '-').replaceAll('/', '_')
      .replace(/=+$/, '') === value ? bytes : null;
}

function versionParts(version) {
  if (typeof version !== 'string' ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    return null;
  }
  const parts = version.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function advances(previous, next) {
  for (let index = 0; index < 3; ++index) {
    if (next[index] !== previous[index]) {
      return next[index] > previous[index];
    }
  }
  return false;
}

export async function prepareSignedRuleUpdate({envelope, trustedKeys,
                                               settings, current = null,
                                               subtle = globalThis.crypto?.subtle} = {}) {
  const fail = error => ({candidate: current, error});
  if (settings?.enabled !== true) {
    return fail('disabled');
  }
  if (!envelope || typeof envelope !== 'object' ||
      Array.isArray(envelope) ||
      Object.keys(envelope).sort().join(',') !== 'keyId,payload,signature' ||
      typeof envelope.keyId !== 'string' || !KEY_ID.test(envelope.keyId)) {
    return fail('invalid_envelope');
  }
  const trusted = trustedKeys instanceof Map ?
      trustedKeys.get(envelope.keyId) : null;
  if (!trusted || !(trusted.publicKey instanceof Uint8Array) ||
      trusted.publicKey.length !== 32 || typeof trusted.sourceId !== 'string') {
    return fail('unknown_key');
  }
  const payload = decodeBase64url(envelope.payload, MAX_PAYLOAD_BYTES);
  const signature = decodeBase64url(envelope.signature, 64);
  if (!payload || !signature || signature.length !== 64) {
    return fail('invalid_envelope');
  }
  if (!subtle?.importKey || !subtle?.verify || !subtle?.digest) {
    return fail('unsupported_crypto');
  }
  let verified;
  try {
    const key = await subtle.importKey('raw', trusted.publicKey, 'Ed25519',
      false, ['verify']);
    verified = await subtle.verify('Ed25519', key, signature, payload);
  } catch {
    return fail('verification_error');
  }
  if (!verified) {
    return fail('bad_signature');
  }
  let bundle;
  try {
    bundle = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(payload));
  } catch {
    return fail('invalid_bundle');
  }
  if (!bundle || bundle.sourceId !== trusted.sourceId ||
      (current && current.provenance?.sourceId !== bundle.sourceId)) {
    return fail('source_changed');
  }
  const nextVersion = versionParts(bundle.version);
  const previousVersion = current ?
      versionParts(current.provenance?.version) : null;
  if (!nextVersion || (current && !previousVersion)) {
    return fail('invalid_bundle');
  }
  if (previousVersion && !advances(previousVersion, nextVersion)) {
    return fail('rollback');
  }
  let compiled;
  try {
    compiled = compileAdblockRules({bundle, settings});
  } catch {
    return fail('invalid_bundle');
  }
  let digest;
  try {
    digest = new Uint8Array(await subtle.digest('SHA-256', payload));
  } catch {
    return fail('verification_error');
  }
  const sha256 = Array.from(digest, byte =>
    byte.toString(16).padStart(2, '0')).join('');
  return {candidate: {
    rules: compiled.rules,
    provenance: {...compiled.provenance, keyId: envelope.keyId, sha256},
  }, error: null};
}
