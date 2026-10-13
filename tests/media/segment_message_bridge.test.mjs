import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSegmentMessageHandler} from
  '../../prism/media/segment_message_bridge.mjs';
import {hashVideoIdPrefix} from '../../prism/media/segment_policy.mjs';
import {defaultMediaSettings} from
  '../../prism/settings/media_controls_store.mjs';

const extensionId = 'a'.repeat(32);
const videoId = 'abcdefghijk';
const url = `https://www.youtube.com/watch?v=${videoId}`;
const request = {type: 'prism.media.lookup', duration: 100};
const sender = {
  id: extensionId, frameId: 0, url, origin: 'https://www.youtube.com',
  documentLifecycle: 'active',
  tab: {id: 3, url, incognito: false},
};

function fixture({enabled = true, incognito = false,
                  settingsError = null} = {}) {
  const settings = defaultMediaSettings();
  settings.segments.enabled = enabled;
  let settingsReads = 0;
  const prefixes = [];
  const handler = createSegmentMessageHandler({
    extensionId, incognito,
    settingsStore: {load: async () => {
      ++settingsReads;
      return {settings, error: settingsError};
    }},
    fetchPrefix: async prefix => {
      prefixes.push(prefix);
      return [{videoID: videoId, segments: [{
        segment: [10, 20], category: 'sponsor', UUID: 'synthetic-1',
        actionType: 'skip',
      }]}];
    },
  });
  return {handler, prefixes, get settingsReads() { return settingsReads; }};
}

test('derives video ID from browser sender and returns only validated segments', async () => {
  const item = fixture();
  const result = await item.handler(request, sender);
  assert.deepEqual(result, {segments: [{start: 10, end: 20,
    category: 'sponsor', uuid: 'synthetic-1'}], rejected: 0, error: null});
  assert.deepEqual(item.prefixes, [await hashVideoIdPrefix(videoId)]);
  assert.equal(item.settingsReads, 1);
  assert.equal(Object.hasOwn(result, 'videoId'), false);
});

test('SPA route uses current browser tab URL, not old document URL', async () => {
  const item = fixture();
  const result = await item.handler(request, {...sender,
    url: 'https://www.youtube.com/feed/subscriptions'});
  assert.equal(result.error, null);
  assert.equal(result.segments.length, 1);
});

test('request cannot supply a video ID, origin, URL, or settings', async () => {
  const item = fixture();
  for (const message of [
    {...request, videoId: 'differentid'},
    {...request, origin: 'https://attacker.test'},
    {...request, settings: {enabled: true}},
    {...request, duration: Infinity},
    {...request, duration: 0},
    {...request, duration: 86401},
    {type: 'prism.media.other', duration: 100},
  ]) {
    const result = await item.handler(message, sender);
    assert.deepEqual(result,
      {segments: [], rejected: 0, error: 'invalid_request'});
  }
  assert.equal(item.settingsReads, 0);
  assert.deepEqual(item.prefixes, []);
});

test('rejects forged, subframe, private, stale, and lookalike senders', async () => {
  const item = fixture();
  const invalid = [
    {...sender, id: 'b'.repeat(32)},
    {...sender, frameId: 1},
    {...sender, origin: 'null'},
    {...sender, documentLifecycle: 'prerender'},
    {...sender, tab: {...sender.tab, incognito: true}},
    {...sender, tab: {...sender.tab, id: -1}},
    {...sender, tab: {...sender.tab, url: 'https://youtube.com.evil.test/watch?v=abcdefghijk'}},
    {...sender, tab: {...sender.tab, url: 'https://www.youtube.com/watch?v=abcdefghijk&v=abcdefghijk'}},
    {...sender, tab: {...sender.tab, url: 'https://www.youtube.com:444/watch?v=abcdefghijk'}},
    {...sender, tab: {...sender.tab, url: 'https://music.youtube.com/watch?v=abcdefghijk'}},
    {...sender, tab: undefined},
  ];
  for (const candidate of invalid) {
    assert.deepEqual(await item.handler(request, candidate),
      {segments: [], rejected: 0, error: 'unauthorized'});
  }
  assert.equal(item.settingsReads, 0);
  assert.deepEqual(item.prefixes, []);
});

test('disabled, failed settings and Incognito never request segments', async () => {
  for (const options of [
    {enabled: false}, {settingsError: 'storage_error'},
    {incognito: true},
  ]) {
    const item = fixture(options);
    const result = await item.handler(request, sender);
    assert.deepEqual(result.segments, []);
    assert.deepEqual(item.prefixes, []);
    if (options.incognito) {
      assert.equal(item.settingsReads, 0);
      assert.equal(result.error, 'incognito_disabled');
    } else {
      assert.equal(item.settingsReads, 1);
      assert.equal(result.error, options.enabled === false ?
        'disabled' : 'settings_unavailable');
    }
  }
});

test('limits repeated and concurrent requests before network amplification', async () => {
  const settings = defaultMediaSettings();
  settings.segments.enabled = true;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let reads = 0;
  let fetches = 0;
  const handler = createSegmentMessageHandler({
    extensionId, incognito: false,
    settingsStore: {load: async () => {
      ++reads;
      return {settings, error: null};
    }},
    fetchPrefix: async () => {
      ++fetches;
      await gate;
      return [];
    },
  });
  const running = Array.from({length: 16}, (_, index) => handler(request, {
    ...sender, tab: {...sender.tab, id: index + 1},
  }));
  const sameTab = await handler(request, sender);
  const extraTab = await handler(request, {...sender,
    tab: {...sender.tab, id: 17}});
  assert.equal(sameTab.error, 'rate_limited');
  assert.equal(extraTab.error, 'rate_limited');
  assert.equal(reads, 16);
  release();
  const results = await Promise.all(running);
  assert.equal(results.every(result => result.error === null), true);
  assert.equal(fetches, 16);
});

test('handler requires a concrete component extension identity', () => {
  assert.throws(() => createSegmentMessageHandler({extensionId: ''}),
    TypeError);
});
