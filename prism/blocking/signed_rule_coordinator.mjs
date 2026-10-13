// Coordinates one signed candidate, DNR readback, and the trusted cache.
import {isMediaSettings} from '../settings/media_controls_store.mjs';
import {isCompiledRuleSet} from './rule_compiler.mjs';
import {createDynamicRuleActivator} from './rule_activation.mjs';
import {prepareSignedRuleUpdate} from './signed_rule_update.mjs';

function sameProvenance(left, right) {
  return left && right && left.sourceId === right.sourceId &&
      left.version === right.version && left.keyId === right.keyId &&
      left.sha256 === right.sha256;
}

export function createSignedRuleCoordinator({settingsStore, packageStore,
    dnrApi, trustedKeys, incognito,
    subtle = globalThis.crypto?.subtle} = {}) {
  let pending = Promise.resolve();
  return envelope => {
    const run = async () => {
      if (incognito !== false) {
        return {ok: false, state: 'skipped', error: 'incognito_disabled'};
      }
      let activate;
      try {
        activate = createDynamicRuleActivator(dnrApi);
      } catch {
        return {ok: false, state: 'unknown', error: 'invalid_api'};
      }
      let loadedSettings;
      let previous;
      try {
        loadedSettings = await settingsStore.load();
        previous = await packageStore.load();
      } catch {
        return {ok: false, state: 'unchanged', error: 'state_unavailable'};
      }
      if (loadedSettings?.error ||
          !isMediaSettings(loadedSettings?.settings) ||
          !loadedSettings.settings.adblock.enabled || !previous ||
          previous.error || previous.envelope === undefined ||
          previous.candidate === undefined ||
          (previous.envelope === null) !== (previous.candidate === null)) {
        return {ok: false, state: 'unchanged', error: 'state_unavailable'};
      }
      let prepared;
      try {
        prepared = await prepareSignedRuleUpdate({
          envelope, trustedKeys, settings: loadedSettings.settings.adblock,
          current: previous.candidate, subtle,
        });
      } catch {
        return {ok: false, state: 'unchanged', error: 'invalid_package'};
      }
      if (prepared.error || !prepared.candidate) {
        return {ok: false, state: 'unchanged',
          error: prepared.error ?? 'invalid_package'};
      }
      let before;
      try {
        before = await dnrApi.getDynamicRules();
      } catch {
        return {ok: false, state: 'unknown', error: 'read_failed'};
      }
      if (!isCompiledRuleSet(before)) {
        return {ok: false, state: 'unknown', error: 'invalid_existing_rules'};
      }
      const activated = await activate(prepared.candidate);
      if (!activated.ok) {
        return {ok: false,
          state: activated.installedRules ? 'unchanged' : 'unknown',
          error: 'activation_failed'};
      }

      try {
        await packageStore.save(envelope);
      } catch {
        // A rejected write can still have reached persistent storage.
      }
      let cached;
      try {
        cached = await packageStore.load();
      } catch {
        cached = null;
      }
      if (!cached?.error && sameProvenance(
          cached?.candidate?.provenance,
          prepared.candidate.provenance)) {
        return {ok: true, state: 'enabled', error: null,
          provenance: prepared.candidate.provenance};
      }
      if (!cached?.error &&
          ((!previous.candidate && !cached?.candidate) ||
            sameProvenance(cached?.candidate?.provenance,
              previous.candidate?.provenance))) {
        const restored = await activate({rules: before});
        return restored.ok ?
          {ok: false, state: 'restored', error: 'cache_commit_failed'} :
          {ok: false, state: 'unknown', error: 'rollback_failed'};
      }
      const cleared = await activate({rules: []});
      return cleared.ok ?
        {ok: false, state: 'disabled', error: 'cache_commit_failed'} :
        {ok: false, state: 'unknown', error: 'clear_failed'};
    };
    const result = pending.then(run);
    pending = result.then(() => {}, () => {});
    return result;
  };
}
