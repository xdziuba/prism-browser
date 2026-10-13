// Versioned preferences for a future trusted, bundled Prism media component.
import {isValidDisabledSites} from '../blocking/rule_compiler.mjs';
import {SKIPPABLE_CATEGORIES, normalizeSegmentSettings} from
    '../media/segment_policy.mjs';

export const MEDIA_SETTINGS_KEY = 'prismMediaSettingsV1';
const ACTIONS = new Set(['off', 'manual', 'auto']);

function exactKeys(value, expected) {
  return value !== null && typeof value === 'object' &&
      !Array.isArray(value) &&
      Reflect.ownKeys(value).length === expected.length &&
      expected.every(key => Object.hasOwn(value, key));
}

export function defaultMediaSettings() {
  const segments = normalizeSegmentSettings({});
  return {
    version: 1,
    segments: {enabled: false, categories: {...segments.categories}},
    adblock: {enabled: false, disabledSites: []},
  };
}

export function isMediaSettings(value) {
  try {
    return exactKeys(value, ['version', 'segments', 'adblock']) &&
        value.version === 1 &&
        exactKeys(value.segments, ['enabled', 'categories']) &&
        typeof value.segments.enabled === 'boolean' &&
        exactKeys(value.segments.categories, SKIPPABLE_CATEGORIES) &&
        SKIPPABLE_CATEGORIES.every(category =>
          ACTIONS.has(value.segments.categories[category])) &&
        exactKeys(value.adblock, ['enabled', 'disabledSites']) &&
        typeof value.adblock.enabled === 'boolean' &&
        isValidDisabledSites(value.adblock.disabledSites);
  } catch {
    return false;
  }
}

function copySettings(value) {
  return {
    version: 1,
    segments: {
      enabled: value.segments.enabled,
      categories: Object.fromEntries(SKIPPABLE_CATEGORIES.map(category =>
        [category, value.segments.categories[category]])),
    },
    adblock: {
      enabled: value.adblock.enabled,
      disabledSites: [...value.adblock.disabledSites],
    },
  };
}

export function createMediaSettingsStore({storageArea, incognito} = {}) {
  let pendingSave = Promise.resolve();
  const ready = () => storageArea &&
      typeof storageArea.setAccessLevel === 'function' &&
      typeof storageArea.get === 'function' &&
      typeof storageArea.set === 'function';
  const restrictAccess = () => storageArea.setAccessLevel({
    accessLevel: 'TRUSTED_CONTEXTS',
  });

  async function load() {
    if (incognito !== false) {
      return {settings: defaultMediaSettings(), error: 'incognito_disabled'};
    }
    if (!ready()) {
      return {settings: defaultMediaSettings(), error: 'storage_error'};
    }
    try {
      await pendingSave;
      await restrictAccess();
      const result = await storageArea.get(MEDIA_SETTINGS_KEY);
      if (result?.[MEDIA_SETTINGS_KEY] === undefined) {
        return {settings: defaultMediaSettings(), error: null};
      }
      if (!isMediaSettings(result[MEDIA_SETTINGS_KEY])) {
        return {settings: defaultMediaSettings(), error: 'invalid_settings'};
      }
      return {settings: copySettings(result[MEDIA_SETTINGS_KEY]), error: null};
    } catch {
      return {settings: defaultMediaSettings(), error: 'storage_error'};
    }
  }

  function save(settings) {
    if (incognito !== false) {
      return Promise.resolve({ok: false, error: 'incognito_disabled'});
    }
    if (!isMediaSettings(settings)) {
      return Promise.resolve({ok: false, error: 'invalid_settings'});
    }
    if (!ready()) {
      return Promise.resolve({ok: false, error: 'storage_error'});
    }
    let snapshot;
    try {
      snapshot = copySettings(settings);
    } catch {
      return Promise.resolve({ok: false, error: 'invalid_settings'});
    }
    if (!isMediaSettings(snapshot)) {
      return Promise.resolve({ok: false, error: 'invalid_settings'});
    }
    const operation = pendingSave.then(async () => {
      try {
        await restrictAccess();
        await storageArea.set({[MEDIA_SETTINGS_KEY]: snapshot});
        return {ok: true, error: null};
      } catch {
        return {ok: false, error: 'storage_error'};
      }
    });
    pendingSave = operation;
    return operation;
  }

  return {load, save};
}
