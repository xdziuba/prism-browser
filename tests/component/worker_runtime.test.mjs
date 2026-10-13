import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerBundledComponentWorker} from
  '../../prism/component/worker_runtime.mjs';
import {defaultMediaSettings, MEDIA_SETTINGS_KEY} from
  '../../prism/settings/media_controls_store.mjs';

const extensionId = 'a'.repeat(32);
const videoId = 'abcdefghijk';
const watchURL = `https://www.youtube.com/watch?v=${videoId}`;
const optionsSender = {id: extensionId, frameId: 0,
  url: `chrome-extension://${extensionId}/settings/media_controls.html`,
  origin: `chrome-extension://${extensionId}`, tab: {incognito: false}};
const videoSender = {id: extensionId, frameId: 0, url: watchURL,
  origin: 'https://www.youtube.com',
  tab: {id: 7, url: watchURL, incognito: false}};

function fixture({settings = defaultMediaSettings(), initialRules = [],
                  incognito = false, fetchPrefix} = {}) {
  const stored = {[MEDIA_SETTINGS_KEY]: settings};
  const calls = [];
  let rules = initialRules;
  const listeners = {};
  const runtime = {id: extensionId};
  for (const event of ['onMessage', 'onInstalled', 'onStartup']) {
    runtime[event] = {addListener(callback) { listeners[event] = callback; }};
  }
  const storageArea = {
    async setAccessLevel({accessLevel}) { calls.push(`access:${accessLevel}`); },
    async get(key) { calls.push(`get:${key}`); return {[key]: stored[key]}; },
    async set(value) { Object.assign(stored, value); },
  };
  const dnrApi = {
    async getDynamicRules() { calls.push('dnr:read'); return rules; },
    async updateDynamicRules({removeRuleIds, addRules}) {
      calls.push('dnr:update');
      rules = rules.filter(rule => !removeRuleIds.includes(rule.id))
        .concat(addRules);
    },
  };
  const worker = registerBundledComponentWorker({runtime, storageArea,
    dnrApi, incognito, fetchPrefix});
  const send = (message, sender) => new Promise(resolve => {
    listeners.onMessage(message, sender, resolve);
  });
  return {worker, calls, listeners, send,
    get rules() { return rules; }};
}

test('cold worker clears old DNR state before answering status', async () => {
  const oldRule = {id: 1, priority: 1,
    action: {type: 'block'},
    condition: {requestDomains: ['old.prism.test'],
      resourceTypes: ['script']}};
  const item = fixture({initialRules: [oldRule]});
  const status = await item.send({type: 'prism.rules.status'}, optionsSender);
  assert.deepEqual(status, {state: 'disabled', ruleCount: 0,
    sourceId: null, version: null});
  assert.deepEqual(item.rules, []);
  assert.ok(item.calls.indexOf('dnr:update') <
    item.calls.lastIndexOf('dnr:read'));
});

test('dispatches only authenticated fixed messages and serial startup',
  async () => {
    const item = fixture();
    await item.worker.ready;
    const before = item.calls.length;
    assert.deepEqual(await item.send({type: 'prism.update', rules: []},
      optionsSender), {error: 'invalid_request'});
    assert.equal((await item.send({type: 'prism.settings.apply',
      settings: defaultMediaSettings()}, optionsSender)).error,
      'unauthorized');
    assert.equal((await item.send({type: 'prism.settings.apply'},
      videoSender)).error, 'unauthorized');
    assert.equal(item.calls.length, before);
    assert.deepEqual(await item.send({type: 'prism.settings.apply'},
      optionsSender), {ok: true, state: 'disabled', error: null});
    item.listeners.onStartup();
    item.listeners.onInstalled();
    const status = await item.send({type: 'prism.rules.status'},
      optionsSender);
    assert.equal(status.state, 'disabled');
    assert.equal(item.rules.length, 0);
  });

test('media lookup stays disabled without a provider; test provider is scoped',
  async () => {
    const settings = defaultMediaSettings();
    settings.segments.enabled = true;
    const noProvider = fixture({settings});
    assert.deepEqual(await noProvider.send({type: 'prism.media.lookup',
      duration: 120}, videoSender),
    {segments: [], rejected: 0, error: 'network_error'});

    const prefixes = [];
    const local = fixture({settings, fetchPrefix: async prefix => {
      prefixes.push(prefix);
      return [{videoID: videoId, segments: [{segment: [4, 8],
        category: 'sponsor', UUID: 'synthetic-1', actionType: 'skip'}]}];
    }});
    assert.equal((await local.send({type: 'prism.media.lookup',
      duration: 120}, optionsSender)).error, 'unauthorized');
    const response = await local.send({type: 'prism.media.lookup',
      duration: 120}, videoSender);
    assert.deepEqual(response.segments, [{start: 4, end: 8,
      category: 'sponsor', uuid: 'synthetic-1', mode: 'auto'}]);
    assert.equal(prefixes.length, 1);
    assert.match(prefixes[0], /^[a-f0-9]{4}$/);
  });

test('unknown Incognito state fails before storage, DNR, and lookup',
  async () => {
  const item = fixture({incognito: null,
      fetchPrefix: async () => { throw new Error('must not run'); }});
    await item.worker.ready;
    assert.deepEqual(item.calls, []);
    assert.equal((await item.send({type: 'prism.media.lookup',
      duration: 120}, videoSender)).error, 'incognito_disabled');
    assert.equal((await item.send({type: 'prism.rules.status'},
      optionsSender)).error, 'incognito_disabled');
    assert.deepEqual(item.calls, []);
  });
