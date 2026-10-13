// A fixed, authenticated options-page signal; settings are read in the worker.
import {reconcileAdblockStartup} from '../blocking/startup_reconciliation.mjs';
import {APPLY_SETTINGS_MESSAGE} from './settings_message.mjs';

export {APPLY_SETTINGS_MESSAGE};

function isRequest(message, sender, extensionId, optionsUrl) {
  return message !== null && typeof message === 'object' &&
    !Array.isArray(message) && Reflect.ownKeys(message).length === 1 &&
    message.type === APPLY_SETTINGS_MESSAGE &&
    sender?.id === extensionId && sender.url === optionsUrl &&
    sender.frameId === 0 &&
    (sender.origin === undefined ||
      sender.origin === `chrome-extension://${extensionId}`) &&
    (sender.documentLifecycle === undefined ||
      sender.documentLifecycle === 'active') &&
    (sender.tab === undefined || sender.tab.incognito === false);
}

export function createSettingsChangeHandler({extensionId, settingsStore,
    packageStore, trustedKeys, dnrApi, incognito,
    subtle = globalThis.crypto?.subtle} = {}) {
  if (typeof extensionId !== 'string' || !/^[a-p]{32}$/.test(extensionId)) {
    throw new TypeError('A Chromium extension ID is required');
  }
  const optionsUrl = `chrome-extension://${extensionId}/settings/media_controls.html`;
  let pending = Promise.resolve();

  return function applySettings(message, sender) {
    if (incognito !== false) {
      return Promise.resolve({ok: false, state: 'skipped',
        error: 'incognito_disabled'});
    }
    if (!isRequest(message, sender, extensionId, optionsUrl)) {
      return Promise.resolve({ok: false, state: 'skipped',
        error: 'unauthorized'});
    }
    const run = async () => {
      const result = await reconcileAdblockStartup({
        settingsStore,
        loadSignedEnvelope: async () => (await packageStore.load()).envelope,
        trustedKeys, dnrApi, incognito, subtle,
      });
      return {ok: result.ok, state: result.state, error: result.error};
    };
    const result = pending.then(run).catch(() => ({
      ok: false, state: 'unknown', error: 'apply_failed',
    }));
    pending = result.then(() => {});
    return result;
  };
}
