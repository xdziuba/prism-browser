// The worker's one queue for startup, settings changes, and signed updates.
import {reconcileAdblockStartup} from './startup_reconciliation.mjs';
import {createSignedRuleCoordinator} from './signed_rule_coordinator.mjs';

export function createAdblockRuleOwner({settingsStore, packageStore,
    trustedKeys, dnrApi, incognito,
    subtle = globalThis.crypto?.subtle} = {}) {
  const update = createSignedRuleCoordinator({settingsStore, packageStore,
    trustedKeys, dnrApi, incognito, subtle});
  let pending = Promise.resolve();

  function enqueue(operation) {
    const result = pending.then(operation).catch(() => ({
      ok: false, state: 'unknown', error: 'owner_failed',
    }));
    pending = result.then(() => {});
    return result;
  }

  const reconcile = () => reconcileAdblockStartup({
    settingsStore,
    loadSignedEnvelope: async () => (await packageStore.load()).envelope,
    trustedKeys, dnrApi, incognito, subtle,
  });
  return Object.freeze({
    startup: () => enqueue(reconcile),
    settingsChanged: () => enqueue(reconcile),
    installUpdate: envelope => enqueue(() => update(envelope)),
  });
}
