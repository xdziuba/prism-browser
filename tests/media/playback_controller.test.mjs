import assert from 'node:assert/strict';
import test from 'node:test';

import {createPlaybackController} from
  '../../prism/media/playback_controller.mjs';

const VIDEO = 'AbCdEfGhI12';

class FakeMedia extends EventTarget {
  currentTime = 0;
  duration = 100;

  moveTo(time) {
    this.currentTime = time;
    this.dispatchEvent(new Event('timeupdate'));
  }
}

function context(overrides = {}) {
  return {
    videoId: VIDEO,
    segments: [{uuid: 'sponsor-1', category: 'sponsor',
                start: 10, end: 20}],
    settings: {enabled: true},
    incognito: false,
    allowPlayback: true,
    ...overrides,
  };
}

test('automatic skip can be undone once without a repeat loop', () => {
  const media = new FakeMedia();
  const decisions = [];
  const controller = createPlaybackController(media,
      decision => decisions.push(decision));
  controller.setContext(context());
  controller.start();

  media.moveTo(12);
  assert.equal(media.currentTime, 20);
  assert.equal(decisions.at(-1).kind, 'auto');
  assert.equal(controller.undo(), true);
  assert.equal(media.currentTime, 12);
  assert.equal(controller.undo(), false);
  media.moveTo(13);
  assert.equal(media.currentTime, 13);

  media.moveTo(21);
  media.moveTo(12);
  assert.equal(media.currentTime, 20);
  controller.stop();
  assert.equal(controller.undo(), false);
  media.moveTo(12);
  assert.equal(media.currentTime, 12);
});

test('manual segment is offered before an overlapping automatic seek', () => {
  const media = new FakeMedia();
  const decisions = [];
  const controller = createPlaybackController(media,
      decision => decisions.push(decision));
  controller.setContext(context({
    segments: [
      {uuid: 'sponsor-1', category: 'sponsor', start: 10, end: 25},
      {uuid: 'intro-1', category: 'intro', start: 22, end: 24},
    ],
    settings: {enabled: true, categories: {intro: 'manual'}},
  }));
  controller.start();

  media.moveTo(12);
  assert.equal(media.currentTime, 22);
  media.moveTo(22);
  assert.equal(media.currentTime, 22);
  assert.equal(decisions.at(-1).kind, 'manual');
  assert.equal(controller.skipManual(), true);
  assert.equal(media.currentTime, 24);
  assert.equal(controller.skipManual(), false);
  controller.stop();
});

test('browser state must explicitly permit playback and resets per video', () => {
  const media = new FakeMedia();
  const controller = createPlaybackController(media);
  controller.start();

  for (const blocked of [
    {settings: {enabled: false}},
    {incognito: true},
    {allowPlayback: false},
    {allowPlayback: undefined},
  ]) {
    controller.setContext(context(blocked));
    media.moveTo(12);
    assert.equal(media.currentTime, 12);
  }

  controller.setContext(context());
  media.moveTo(12);
  assert.equal(media.currentTime, 20);
  controller.setContext(context({videoId: 'zYxWvUtSrQ9'}));
  assert.equal(controller.undo(), false);
  controller.stop();
});

test('temporary ad suspension preserves an undone segment', () => {
  const media = new FakeMedia();
  const controller = createPlaybackController(media);
  controller.setContext(context());
  controller.start();
  media.moveTo(12);
  assert.equal(media.currentTime, 20);
  assert.equal(controller.undo(), true);
  assert.equal(media.currentTime, 12);

  controller.setPlaybackAllowed(false);
  media.moveTo(13);
  assert.equal(media.currentTime, 13);
  assert.equal(controller.undo(), false);
  controller.setPlaybackAllowed(true);
  assert.equal(media.currentTime, 13);

  media.moveTo(21);
  media.moveTo(12);
  assert.equal(media.currentTime, 20);
  controller.setPlaybackAllowed(false);
  assert.equal(controller.undo(), false);
  controller.stop();
});
