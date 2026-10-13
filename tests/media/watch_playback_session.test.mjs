import assert from 'node:assert/strict';
import test from 'node:test';
import {createWatchPlaybackSession} from
  '../../prism/media/watch_playback_session.mjs';

const VIDEO_A = 'AbCdEfGhI12';
const VIDEO_B = 'zYxWvUtSrQ9';
const tick = () => new Promise(resolve => setImmediate(resolve));

class FakeMedia extends EventTarget {
  currentTime = 0;
  duration = 100;
  readyState = 1;
  isConnected = true;

  moveTo(time) {
    this.currentTime = time;
    this.dispatchEvent(new Event('timeupdate'));
  }
}

function fixture(requestSegments = async () => ({error: null, segments: []}),
                 options = {}) {
  let emit;
  let route = `https://www.youtube.com/watch?v=${VIDEO_A}`;
  const decisions = [];
  const session = createWatchPlaybackSession({
    readURL: () => route,
    requestSegments,
    onDecision: decision => decisions.push(decision),
    observerFactory: ({onChange}) => {
      emit = onChange;
      return {start() {}, stop() {}};
    },
    ...options,
  });
  return {session, decisions,
    emit: value => emit(value),
    route: value => { route = value; }};
}

function response(mode = 'auto', category = 'sponsor') {
  return {error: null, rejected: 0, segments: [{start: 10, end: 20,
    category, uuid: 'synthetic-1', mode}]};
}

test('starts only for ready allowed media and suspends during ads', async () => {
  let calls = 0;
  const item = fixture(async () => { ++calls; return response(); });
  const media = new FakeMedia();
  item.session.start();
  item.emit({videoId: VIDEO_A, media, allowPlayback: false});
  await tick();
  assert.equal(calls, 0);
  media.readyState = 0;
  item.emit({videoId: VIDEO_A, media, allowPlayback: true});
  await tick();
  assert.equal(calls, 0);
  media.readyState = 1;
  item.emit({videoId: VIDEO_A, media, allowPlayback: true});
  await tick();
  assert.equal(calls, 1);
  item.emit({videoId: VIDEO_A, media, allowPlayback: false});
  media.moveTo(12);
  assert.equal(media.currentTime, 12);
  item.emit({videoId: VIDEO_A, media, allowPlayback: true});
  assert.equal(media.currentTime, 20);
  assert.equal(item.session.undo(), true);
  media.moveTo(13);
  assert.equal(media.currentTime, 13);
  item.session.stop();
  assert.equal(item.session.undo(), false);
});

test('manual action is exposed without automatic seeking', async () => {
  const item = fixture(async () => response('manual', 'intro'));
  const media = new FakeMedia();
  item.session.start();
  item.emit({videoId: VIDEO_A, media, allowPlayback: true});
  await tick();
  media.moveTo(12);
  assert.equal(media.currentTime, 12);
  assert.equal(item.decisions.at(-1).kind, 'manual');
  assert.equal(item.session.skipManual(), true);
  assert.equal(media.currentTime, 20);
  item.session.stop();
});

test('late responses after route, media, and stop cannot seek', async () => {
  const releases = [];
  const item = fixture(() => new Promise(resolve => releases.push(resolve)));
  const first = new FakeMedia();
  const replacement = new FakeMedia();
  item.session.start();
  item.emit({videoId: VIDEO_A, media: first, allowPlayback: true});
  await tick();
  item.route(`https://www.youtube.com/watch?v=${VIDEO_B}`);
  item.emit({videoId: VIDEO_B, media: replacement, allowPlayback: true});
  await tick();
  releases[0](response());
  await tick();
  first.moveTo(12);
  assert.equal(first.currentTime, 12);
  item.session.stop();
  releases[1](response());
  await tick();
  replacement.moveTo(12);
  assert.equal(replacement.currentTime, 12);
});

test('a changed URL for the same video discards the old response', async () => {
  const releases = [];
  const item = fixture(() => new Promise(resolve => releases.push(resolve)));
  const media = new FakeMedia();
  item.session.start();
  item.emit({videoId: VIDEO_A, media, allowPlayback: true});
  await tick();
  item.route(`https://www.youtube.com/watch?v=${VIDEO_A}&t=4`);
  releases[0](response());
  await tick();
  assert.equal(releases.length, 2);
  media.moveTo(12);
  assert.equal(media.currentTime, 12);
  releases[1](response());
  await tick();
  assert.equal(media.currentTime, 20);
  item.session.stop();
});

test('rejects conflicting response actions and remains dormant in Incognito', async () => {
  const invalid = response();
  invalid.segments.push({...invalid.segments[0], uuid: 'synthetic-2',
    mode: 'manual'});
  const item = fixture(async () => invalid);
  const media = new FakeMedia();
  item.session.start();
  item.emit({videoId: VIDEO_A, media, allowPlayback: true});
  await tick();
  media.moveTo(12);
  assert.equal(media.currentTime, 12);
  item.session.stop();

  let called = false;
  const privateItem = fixture(async () => { called = true; return response(); },
      {incognito: true});
  privateItem.session.start();
  privateItem.emit({videoId: VIDEO_A, media, allowPlayback: true});
  await tick();
  assert.equal(called, false);
});

test('a rate-limited lookup retries once and stop cancels its timer', async () => {
  let calls = 0;
  const item = fixture(async () => {
    ++calls;
    return {error: 'rate_limited', segments: []};
  });
  item.session.start();
  item.emit({videoId: VIDEO_A, media: new FakeMedia(), allowPlayback: true});
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(calls, 2);
  item.session.stop();
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal(calls, 2);
});
