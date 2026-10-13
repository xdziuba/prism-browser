import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  createMediaSettingsStore, defaultMediaSettings, isMediaSettings,
  MEDIA_SETTINGS_KEY,
} from '../../prism/settings/media_controls_store.mjs';

function fakeStorage() {
  const values = {};
  const calls = [];
  return {
    values, calls,
    async setAccessLevel(value) { calls.push(['access', value.accessLevel]); },
    async get(key) { calls.push(['get', key]); return {[key]: values[key]}; },
    async set(value) {
      calls.push(['set', value]);
      Object.assign(values, structuredClone(value));
    },
  };
}

test('defaults are independent, disabled, and complete', async () => {
  const storageArea = fakeStorage();
  const store = createMediaSettingsStore({storageArea, incognito: false});
  const first = await store.load();
  const second = await store.load();
  assert.equal(first.error, null);
  assert.deepEqual(first.settings, defaultMediaSettings());
  assert.equal(first.settings.segments.categories.sponsor, 'auto');
  assert.equal(first.settings.adblock.enabled, false);
  first.settings.adblock.disabledSites.push('news.prism.test');
  assert.deepEqual(second.settings.adblock.disabledSites, []);
  assert.deepEqual(storageArea.calls[0], ['access', 'TRUSTED_CONTEXTS']);
  assert.deepEqual(storageArea.calls[1], ['get', MEDIA_SETTINGS_KEY]);
});

test('validated settings round-trip under one key', async () => {
  const storageArea = fakeStorage();
  const store = createMediaSettingsStore({storageArea, incognito: false});
  const settings = defaultMediaSettings();
  settings.segments.enabled = true;
  settings.segments.categories.intro = 'manual';
  settings.adblock.enabled = true;
  settings.adblock.disabledSites = ['news.prism.test'];
  assert.deepEqual(await store.save(settings), {ok: true, error: null});
  settings.adblock.disabledSites.push('mutated.prism.test');
  assert.deepEqual((await store.load()).settings.adblock.disabledSites,
    ['news.prism.test']);
  assert.equal(storageArea.calls.filter(([name]) => name === 'set').length, 1);
  assert.deepEqual(storageArea.calls.map(([name]) => name),
    ['access', 'set', 'access', 'get']);
});

test('malformed and future records fail closed', async () => {
  const storageArea = fakeStorage();
  const store = createMediaSettingsStore({storageArea, incognito: false});
  const invalid = [
    {...defaultMediaSettings(), version: 2},
    {...defaultMediaSettings(), visitedUrl: 'https://example.test/'},
    {...defaultMediaSettings(), adblock: {enabled: true}},
    {...defaultMediaSettings(), adblock: {
      enabled: true, disabledSites: ['news.prism.test/']}},
    {...defaultMediaSettings(), adblock: {
      enabled: true, disabledSites: Array(1)}},
    {...defaultMediaSettings(), segments: {
      enabled: true, categories: {sponsor: 'auto'}}},
    {...defaultMediaSettings(), segments: {
      ...defaultMediaSettings().segments, enabled: 'true'}},
  ];
  for (const item of invalid) {
    assert.equal(isMediaSettings(item), false);
    assert.deepEqual(await store.save(item),
      {ok: false, error: 'invalid_settings'});
    storageArea.values[MEDIA_SETTINGS_KEY] = item;
    assert.deepEqual(await store.load(),
      {settings: defaultMediaSettings(), error: 'invalid_settings'});
  }
  assert.equal(storageArea.calls.some(([name]) => name === 'set'), false);
});

test('Incognito or unknown mode never accesses persistent storage', async () => {
  for (const incognito of [true, undefined, null]) {
    const storageArea = fakeStorage();
    const store = createMediaSettingsStore({storageArea, incognito});
    assert.deepEqual(await store.load(),
      {settings: defaultMediaSettings(), error: 'incognito_disabled'});
    assert.deepEqual(await store.save(defaultMediaSettings()),
      {ok: false, error: 'incognito_disabled'});
    assert.deepEqual(storageArea.calls, []);
  }
});

test('access and read errors yield disabled defaults without a write', async () => {
  for (const broken of ['setAccessLevel', 'get']) {
    const storageArea = fakeStorage();
    storageArea[broken] = async () => { throw new Error('synthetic failure'); };
    const store = createMediaSettingsStore({storageArea, incognito: false});
    assert.deepEqual(await store.load(),
      {settings: defaultMediaSettings(), error: 'storage_error'});
    if (broken === 'setAccessLevel') {
      assert.deepEqual(await store.save(defaultMediaSettings()),
        {ok: false, error: 'storage_error'});
      assert.deepEqual(storageArea.calls, []);
    }
  }
});

test('saves serialize and preserve invocation order after a failure', async () => {
  const storageArea = fakeStorage();
  const order = [];
  let count = 0;
  storageArea.set = async value => {
    const number = ++count;
    order.push(['start', number]);
    await new Promise(resolve => setTimeout(resolve, number === 1 ? 10 : 0));
    order.push(['end', number]);
    if (number === 1) { throw new Error('synthetic failure'); }
    Object.assign(storageArea.values, value);
  };
  const store = createMediaSettingsStore({storageArea, incognito: false});
  const first = defaultMediaSettings();
  first.adblock.enabled = true;
  const second = defaultMediaSettings();
  second.segments.enabled = true;
  const results = await Promise.all([store.save(first), store.save(second)]);
  assert.deepEqual(results, [
    {ok: false, error: 'storage_error'}, {ok: true, error: null},
  ]);
  assert.deepEqual(order,
    [['start', 1], ['end', 1], ['start', 2], ['end', 2]]);
  assert.deepEqual((await store.load()).settings, second);
});
