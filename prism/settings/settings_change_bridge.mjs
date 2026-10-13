// A fixed, authenticated options-page signal; settings are read in the worker.
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

export function createSettingsChangeHandler({extensionId, ruleOwner,
    incognito} = {}) {
  if (typeof extensionId !== 'string' || !/^[a-p]{32}$/.test(extensionId)) {
    throw new TypeError('A Chromium extension ID is required');
  }
  if (typeof ruleOwner?.settingsChanged !== 'function') {
    throw new TypeError('A worker rule owner is required');
  }
  const optionsUrl = `chrome-extension://${extensionId}/settings/media_controls.html`;

  return async function applySettings(message, sender) {
    if (incognito !== false) {
      return {ok: false, state: 'skipped',
        error: 'incognito_disabled'};
    }
    if (!isRequest(message, sender, extensionId, optionsUrl)) {
      return {ok: false, state: 'skipped',
        error: 'unauthorized'};
    }
    try {
      const result = await ruleOwner.settingsChanged();
      return {ok: result.ok, state: result.state, error: result.error};
    } catch {
      return {ok: false, state: 'unknown', error: 'apply_failed'};
    }
  };
}
