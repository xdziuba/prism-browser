import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSettingsChangeHandler, APPLY_SETTINGS_MESSAGE} from
  '../../prism/settings/settings_change_bridge.mjs';
import {defaultMediaSettings} from
  '../../prism/settings/media_controls_store.mjs';
import {createAdblockRuleOwner} from
  '../../prism/blocking/adblock_rule_owner.mjs';

const extensionId = 'a'.repeat(32);
const sender = {id: extensionId, frameId: 0,
  url: `chrome-extension://${extensionId}/settings/media_controls.html`,
  origin: `chrome-extension://${extensionId}`,
  documentLifecycle: 'active', tab: {incognito: false}};
const message = {type: APPLY_SETTINGS_MESSAGE};

function fixture() {
  const calls = [];
  const settingsStore = {async load() {
    calls.push('settings');
    return {settings: defaultMediaSettings(), error: null};
  }};
  const packageStore = {async load() {
    calls.push('package');
    return {envelope: null};
  }};
  const dnrApi = {
    async getDynamicRules() { calls.push('read'); return []; },
    async updateDynamicRules() { calls.push('update'); },
  };
  const ruleOwner = createAdblockRuleOwner({settingsStore, packageStore,
    trustedKeys: new Map(), dnrApi, incognito: false});
  const handle = createSettingsChangeHandler({extensionId, ruleOwner,
    incognito: false});
  return {handle, calls};
}

test('rejects forged or payload-bearing notifications before side effects',
  async () => {
    const {handle, calls} = fixture();
    for (const [request, source] of [
      [{...message, settings: defaultMediaSettings()}, sender],
      [message, {...sender, id: 'b'.repeat(32)}],
      [message, {...sender, url: 'https://www.youtube.com/watch?v=test'}],
      [message, {...sender, url: `${sender.url}?x=1`}],
      [message, {...sender, origin: 'https://www.youtube.com'}],
      [message, {...sender, frameId: 1}],
      [message, {...sender, documentLifecycle: 'prerender'}],
      [message, {...sender, tab: {incognito: true}}],
    ]) {
      assert.deepEqual(await handle(request, source),
        {ok: false, state: 'skipped', error: 'unauthorized'});
    }
    assert.deepEqual(calls, []);
  });

test('authentic signal reloads trusted settings and returns bounded status',
  async () => {
    const {handle, calls} = fixture();
    assert.deepEqual(await handle(message, sender),
      {ok: true, state: 'disabled', error: null});
    assert.deepEqual(calls, ['settings', 'read']);
  });

test('unknown Incognito mode fails before storage or DNR access', async () => {
  const calls = [];
  const handle = createSettingsChangeHandler({extensionId,
    ruleOwner: {settingsChanged() { calls.push('rules'); }},
    incognito: undefined});
  assert.deepEqual(await handle(message, sender),
    {ok: false, state: 'skipped', error: 'incognito_disabled'});
  assert.deepEqual(calls, []);
});

test('accepted notifications reconcile serially', async () => {
  const calls = [];
  let running = false;
  const settingsStore = {async load() {
    assert.equal(running, false);
    running = true;
    calls.push('start');
    await new Promise(resolve => setTimeout(resolve, 5));
    running = false;
    calls.push('end');
    return {settings: defaultMediaSettings(), error: null};
  }};
  const dnrApi = {async getDynamicRules() { return []; },
    async updateDynamicRules() {}};
  const ruleOwner = createAdblockRuleOwner({settingsStore,
    packageStore: {async load() { return {envelope: null}; }},
    trustedKeys: new Map(), dnrApi, incognito: false});
  const handle = createSettingsChangeHandler({extensionId, ruleOwner,
    incognito: false});
  const results = await Promise.all([
    handle(message, sender), handle(message, sender)]);
  assert.equal(results.every(result => result.ok), true);
  assert.deepEqual(calls, ['start', 'end', 'start', 'end']);
});
