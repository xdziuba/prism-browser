// Read-only comparison of trusted preferences, a signed package, and DNR.
import {isMediaSettings} from '../settings/media_controls_store.mjs';
import {isCompiledRuleSet} from './rule_compiler.mjs';
import {sameCompiledRules} from './rule_activation.mjs';
import {prepareSignedRuleUpdate} from './signed_rule_update.mjs';

const result = (state, ruleCount = 0, sourceId = null, version = null) =>
  ({state, ruleCount, sourceId, version});

export async function readAdblockStatus({settingsStore, packageStore,
    trustedKeys, dnrApi, incognito,
    subtle = globalThis.crypto?.subtle} = {}) {
  if (incognito !== false) return result('unknown');
  let settings;
  let installed;
  try {
    settings = await settingsStore.load();
    installed = await dnrApi.getDynamicRules();
  } catch {
    return result('unknown');
  }
  if (!isCompiledRuleSet(installed)) return result('unknown');
  if (settings?.error || !isMediaSettings(settings?.settings)) {
    return result(installed.length ? 'drift' : 'unknown', installed.length);
  }
  if (!settings.settings.adblock.enabled) {
    return result(installed.length ? 'drift' : 'disabled', installed.length);
  }
  let packageRecord;
  try {
    packageRecord = await packageStore.load();
  } catch {
    packageRecord = null;
  }
  if (packageRecord?.error || !packageRecord?.envelope) {
    return result(installed.length ? 'drift' : 'unavailable',
      installed.length);
  }
  let prepared;
  try {
    prepared = await prepareSignedRuleUpdate({
      envelope: packageRecord.envelope, trustedKeys,
      settings: settings.settings.adblock, subtle,
    });
  } catch {
    return result('unknown', installed.length);
  }
  if (prepared.error || !prepared.candidate) {
    return result(installed.length ? 'drift' : 'unavailable',
      installed.length);
  }
  if (!sameCompiledRules(installed, prepared.candidate.rules)) {
    return result('drift', installed.length);
  }
  const provenance = prepared.candidate.provenance;
  return result('active', installed.length,
    provenance.sourceId, provenance.version);
}
