import {createMediaSettingsStore} from './media_controls_store.mjs';
import {mountMediaControls} from './media_controls_ui.mjs';
import {APPLY_SETTINGS_MESSAGE} from './settings_message.mjs';

const store = createMediaSettingsStore({
  storageArea: chrome.storage.local,
  incognito: chrome.extension.inIncognitoContext,
});
await mountMediaControls({document, store,
  applySaved: () => chrome.runtime.sendMessage({type: APPLY_SETTINGS_MESSAGE})});
