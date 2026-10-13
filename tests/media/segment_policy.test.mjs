import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import test from 'node:test';

import {
  decideSegmentPlayback,
  hashVideoIdPrefix,
  normalizeSegmentSettings,
  parseHashPrefixSegments,
  undoSegmentTarget,
} from '../../prism/media/segment_policy.mjs';

const VIDEO = 'AbCdEfGhI12';
const OTHER_VIDEO = 'zYxWvUtSrQ9';

function segment(uuid, category, start, end, extra = {}) {
  return {UUID: uuid, category, segment: [start, end], ...extra};
}

test('lookup prefix hashes the video ID without exposing it', async () => {
  const expected = createHash('sha256').update(VIDEO).digest('hex').slice(0, 4);
  assert.equal(await hashVideoIdPrefix(VIDEO, webcrypto.subtle), expected);
  assert.equal(await hashVideoIdPrefix('bad', webcrypto.subtle), null);
});

test('hashed response uses only the exact video and rejects malformed ranges', () => {
  const response = [
    {videoID: OTHER_VIDEO, segments: [segment('wrong-video', 'sponsor', 1, 9)]},
    {videoID: VIDEO, segments: [
      segment('valid', 'sponsor', 10, 20),
      segment('outdated', 'sponsor', 20, 130),
      segment('unknown', 'new_category', 21, 25),
      segment('mute', 'sponsor', 30, 35, {actionType: 'mute'}),
      segment('duplicate', 'intro', 40, 45),
      segment('duplicate', 'intro', 50, 55),
    ]},
  ];
  const result = parseHashPrefixSegments({videoId: VIDEO, payload: response,
                                          duration: 100});
  assert.equal(result.error, null);
  assert.deepEqual(result.segments.map(item => item.uuid),
                   ['valid', 'duplicate']);
  assert.equal(result.rejected, 4);
  assert.equal(result.segments.some(item => item.uuid === 'wrong-video'), false);
});

test('ambiguous or oversized responses fail closed', () => {
  const entry = {videoID: VIDEO, segments: [segment('a', 'sponsor', 1, 2)]};
  assert.equal(parseHashPrefixSegments({videoId: VIDEO,
    payload: [entry, entry]}).error, 'invalid_response');
  assert.equal(parseHashPrefixSegments({videoId: VIDEO,
    payload: Array(4097).fill(entry)}).error, 'invalid_response');
  assert.equal(parseHashPrefixSegments({videoId: 'bad',
    payload: [entry]}).error, 'invalid_video_id');
  assert.deepEqual(parseHashPrefixSegments({videoId: VIDEO,
    payload: [{videoID: OTHER_VIDEO, segments: entry.segments}]}).segments, []);
});

test('settings opt in and default to sponsor only', () => {
  const defaults = normalizeSegmentSettings({enabled: true,
    categories: {intro: 'invalid', sponsor: 'auto', unexpected: 'auto'}});
  assert.equal(defaults.enabled, true);
  assert.equal(defaults.categories.sponsor, 'auto');
  assert.equal(defaults.categories.intro, 'off');
  assert.equal(defaults.categories.unexpected, undefined);
  assert.equal(normalizeSegmentSettings().enabled, false);

  const segments = [
    {uuid: 's', category: 'sponsor', start: 10, end: 20},
  ];
  const options = {videoId: VIDEO, currentTime: 12, duration: 100, segments};
  assert.equal(decideSegmentPlayback(options), null);
  assert.equal(decideSegmentPlayback({...options, settings: {enabled: true},
    incognito: true}), null);
  assert.deepEqual(decideSegmentPlayback({...options,
    settings: {enabled: true}}),
  {kind: 'auto', videoId: VIDEO, from: 12, to: 20, uuids: ['s']});
});

test('manual category takes priority over overlapping automatic ranges', () => {
  const segments = [
    {uuid: 'first', category: 'sponsor', start: 10, end: 20},
    {uuid: 'next', category: 'sponsor', start: 19.8, end: 25},
    {uuid: 'manual', category: 'intro', start: 22, end: 24},
  ];
  const settings = {enabled: true, categories: {intro: 'manual'}};
  const options = {videoId: VIDEO, duration: 100, segments, settings};
  assert.deepEqual(decideSegmentPlayback({...options, currentTime: 12}),
    {kind: 'auto', videoId: VIDEO, from: 12, to: 22,
     uuids: ['first', 'next']});
  assert.deepEqual(decideSegmentPlayback({...options, currentTime: 22}),
    {kind: 'manual', videoId: VIDEO, from: 22, to: 24,
     category: 'intro', uuid: 'manual'});
  assert.deepEqual(decideSegmentPlayback({...options, currentTime: 24}),
    {kind: 'auto', videoId: VIDEO, from: 24, to: 25, uuids: ['next']});
});

test('undo is scoped to the same video and recent skip destination', () => {
  const decision = {kind: 'auto', videoId: VIDEO, from: 12, to: 20};
  assert.equal(undoSegmentTarget(decision, VIDEO, 20), 12);
  assert.equal(undoSegmentTarget(decision, OTHER_VIDEO, 20), null);
  assert.equal(undoSegmentTarget(decision, VIDEO, 31), null);
  assert.equal(undoSegmentTarget({...decision, kind: 'manual'}, VIDEO, 20),
               null);
});
