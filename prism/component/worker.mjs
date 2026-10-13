// Bundled entry point. Providers and signing keys stay unconfigured until
// distribution rights and rule provenance are settled.
import {registerBundledComponentWorker} from './worker_runtime.mjs';

registerBundledComponentWorker({
  runtime: chrome.runtime,
  storageArea: chrome.storage.local,
  dnrApi: chrome.declarativeNetRequest,
  incognito: chrome.extension.inIncognitoContext,
});
