import {createMediaSettingsStore} from './media_controls_store.mjs';
import {mountMediaControls} from './media_controls_ui.mjs';

const store = createMediaSettingsStore({
  storageArea: chrome.storage.local,
  incognito: chrome.extension.inIncognitoContext,
});
await mountMediaControls({document, store});
