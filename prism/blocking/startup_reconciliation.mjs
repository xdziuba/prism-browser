// Reconciles persisted DNR rules with trusted settings and a signed package.
import {isMediaSettings} from '../settings/media_controls_store.mjs';
import {createDynamicRuleActivator} from './rule_activation.mjs';
import {prepareSignedRuleUpdate} from './signed_rule_update.mjs';

export async function reconcileAdblockStartup({settingsStore,
    loadSignedEnvelope, trustedKeys, dnrApi, incognito,
    subtle = globalThis.crypto?.subtle} = {}) {
  if (incognito !== false) {
    return {ok: false, state: 'skipped', error: 'incognito_disabled'};
  }
  let activate;
  try {
    activate = createDynamicRuleActivator(dnrApi);
  } catch {
    return {ok: false, state: 'unknown', error: 'invalid_api'};
  }
  const clear = async error => {
    const result = await activate({rules: []});
    return result.ok ?
      {ok: error === null, state: 'disabled', error} :
      {ok: false, state: 'unknown', error: 'clear_failed'};
  };

  let loaded;
  try {
    loaded = await settingsStore.load();
  } catch {
    return clear('settings_error');
  }
  if (loaded?.error || !isMediaSettings(loaded?.settings)) {
    return clear('settings_error');
  }
  if (!loaded.settings.adblock.enabled) {
    return clear(null);
  }
  let envelope;
  try {
    envelope = await loadSignedEnvelope();
  } catch {
    return clear('package_unavailable');
  }
  if (!envelope) {
    return clear('package_unavailable');
  }
  let prepared;
  try {
    prepared = await prepareSignedRuleUpdate({
      envelope, trustedKeys, settings: loaded.settings.adblock, subtle,
    });
  } catch {
    return clear('verification_failed');
  }
  if (prepared.error || !prepared.candidate) {
    return clear('verification_failed');
  }
  const result = await activate(prepared.candidate);
  return result.ok ?
    {ok: true, state: 'enabled', error: null,
      provenance: prepared.candidate.provenance} :
    {ok: false, state: 'unknown', error: 'activation_failed'};
}
