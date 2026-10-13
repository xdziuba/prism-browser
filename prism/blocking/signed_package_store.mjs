// Keeps one reverified synthetic rule envelope in trusted component storage.
import {prepareSignedRuleUpdate} from './signed_rule_update.mjs';

export const SIGNED_PACKAGE_KEY = 'prismSignedRulesV1';
const VERIFICATION_SETTINGS = Object.freeze({enabled: true,
  disabledSites: Object.freeze([])});

function exactKeys(value, expected) {
  return value !== null && typeof value === 'object' &&
      !Array.isArray(value) &&
      Reflect.ownKeys(value).length === expected.length &&
      expected.every(key => Object.hasOwn(value, key));
}

export function createSignedPackageStore({storageArea, trustedKeys,
                                          incognito,
                                          subtle = globalThis.crypto?.subtle} = {}) {
  const ready = () => storageArea &&
      typeof storageArea.setAccessLevel === 'function' &&
      typeof storageArea.get === 'function' &&
      typeof storageArea.set === 'function';
  let pendingSave = Promise.resolve();

  async function readVerified() {
    try {
      await storageArea.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
      const stored = await storageArea.get(SIGNED_PACKAGE_KEY);
      const record = stored?.[SIGNED_PACKAGE_KEY];
      if (record === undefined) {
        return {envelope: null, candidate: null, error: null};
      }
      if (!exactKeys(record, ['version', 'envelope']) ||
          record.version !== 1) {
        return {envelope: null, candidate: null,
          error: 'invalid_package'};
      }
      const verified = await prepareSignedRuleUpdate({
        envelope: record.envelope, trustedKeys,
        settings: VERIFICATION_SETTINGS, subtle,
      });
      if (verified.error || !verified.candidate) {
        return {envelope: null, candidate: null,
          error: 'invalid_package'};
      }
      return {envelope: {...record.envelope},
        candidate: verified.candidate, error: null};
    } catch {
      return {envelope: null, candidate: null, error: 'storage_error'};
    }
  }

  async function load() {
    if (incognito !== false) {
      return {envelope: null, candidate: null,
        error: 'incognito_disabled'};
    }
    if (!ready()) {
      return {envelope: null, candidate: null, error: 'storage_error'};
    }
    await pendingSave;
    return readVerified();
  }

  function save(envelope) {
    if (incognito !== false) {
      return Promise.resolve({ok: false, error: 'incognito_disabled'});
    }
    if (!ready()) {
      return Promise.resolve({ok: false, error: 'storage_error'});
    }
    const run = async () => {
      const existing = await readVerified();
      if (existing.error) {
        return {ok: false, error: existing.error};
      }
      const prepared = await prepareSignedRuleUpdate({
        envelope, trustedKeys, settings: VERIFICATION_SETTINGS,
        current: existing.candidate, subtle,
      });
      if (prepared.error || !prepared.candidate) {
        return {ok: false, error: prepared.error ?? 'invalid_package'};
      }
      const snapshot = {keyId: envelope.keyId, payload: envelope.payload,
        signature: envelope.signature};
      try {
        await storageArea.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
        await storageArea.set({[SIGNED_PACKAGE_KEY]: {
          version: 1, envelope: snapshot,
        }});
      } catch {
        return {ok: false, error: 'storage_error'};
      }
      return {ok: true, error: null,
        provenance: prepared.candidate.provenance};
    };
    const result = pendingSave.then(run);
    pendingSave = result.then(() => {}, () => {});
    return result;
  }

  return {load, save};
}
