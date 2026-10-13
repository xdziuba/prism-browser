// One trusted worker owner for settings, DNR, and bounded media lookups.
import {createAdblockRuleOwner} from '../blocking/adblock_rule_owner.mjs';
import {createSignedPackageStore} from '../blocking/signed_package_store.mjs';
import {createSegmentMessageHandler} from '../media/segment_message_bridge.mjs';
import {createMediaSettingsStore} from '../settings/media_controls_store.mjs';
import {createSettingsChangeHandler, APPLY_SETTINGS_MESSAGE,
  RULE_STATUS_MESSAGE} from '../settings/settings_change_bridge.mjs';

const LOOKUP_MESSAGE = 'prism.media.lookup';
const unavailableProvider = async () => { throw new Error('provider unavailable'); };

export function registerBundledComponentWorker({runtime, storageArea, dnrApi,
    incognito, trustedKeys = new Map(), fetchPrefix = unavailableProvider} = {}) {
  if (!runtime?.onMessage?.addListener ||
      !runtime?.onInstalled?.addListener ||
      !runtime?.onStartup?.addListener ||
      typeof runtime.id !== 'string' ||
      typeof fetchPrefix !== 'function') {
    throw new TypeError('A Chromium extension worker runtime is required');
  }
  const settingsStore = createMediaSettingsStore({storageArea, incognito});
  const packageStore = createSignedPackageStore({storageArea, trustedKeys,
    incognito});
  const ruleOwner = createAdblockRuleOwner({settingsStore, packageStore,
    trustedKeys, dnrApi, incognito});
  const settingsMessage = createSettingsChangeHandler({
    extensionId: runtime.id, ruleOwner, incognito});
  const segmentMessage = createSegmentMessageHandler({
    extensionId: runtime.id, settingsStore, fetchPrefix, incognito});

  // MV3 can wake for a message without emitting either lifecycle event.
  const ready = ruleOwner.startup();
  runtime.onInstalled.addListener(() => { void ruleOwner.startup(); });
  runtime.onStartup.addListener(() => { void ruleOwner.startup(); });
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message?.type;
    if (type !== APPLY_SETTINGS_MESSAGE && type !== RULE_STATUS_MESSAGE &&
        type !== LOOKUP_MESSAGE) {
      sendResponse({error: 'invalid_request'});
      return false;
    }
    ready.then(() => type === LOOKUP_MESSAGE ?
      segmentMessage(message, sender) : settingsMessage(message, sender))
      .then(sendResponse, () => sendResponse({error: 'worker_error'}));
    return true;
  });
  return {ready};
}
