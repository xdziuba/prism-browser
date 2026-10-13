import {createPlaybackController} from './playback_controller.mjs';
import {SKIPPABLE_CATEGORIES} from './segment_policy.mjs';
import {createYouTubeWatchObserver, videoIdFromYouTubeWatchURL} from
  './youtube_site_adapter.mjs';

const CATEGORY_SET = new Set(SKIPPABLE_CATEGORIES);
const SEGMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const RETRY_DELAY_MS = 550;

function playbackContext(response) {
  if (!response || response.error !== null ||
      !Array.isArray(response.segments) || response.segments.length > 512) {
    return null;
  }
  const categories = Object.fromEntries(SKIPPABLE_CATEGORIES.map(
      category => [category, 'off']));
  const segments = [];
  const seen = new Set();
  for (const item of response.segments) {
    if (!item || !CATEGORY_SET.has(item.category) ||
        !Number.isFinite(item.start) || !Number.isFinite(item.end) ||
        item.start < 0 || item.end <= item.start ||
        typeof item.uuid !== 'string' || !SEGMENT_ID.test(item.uuid) ||
        (item.mode !== 'auto' && item.mode !== 'manual') ||
        seen.has(item.uuid) ||
        (categories[item.category] !== 'off' &&
          categories[item.category] !== item.mode)) {
      return null;
    }
    seen.add(item.uuid);
    categories[item.category] = item.mode;
    segments.push({start: item.start, end: item.end,
      category: item.category, uuid: item.uuid});
  }
  return {segments, settings: {enabled: true, categories}};
}

export function createWatchPlaybackSession({root, events, readURL,
                                             requestSegments, onDecision,
                                             incognito = false,
                                             observerFactory =
                                               createYouTubeWatchObserver} = {}) {
  if (typeof readURL !== 'function' ||
      typeof requestSegments !== 'function' ||
      typeof onDecision !== 'function' ||
      typeof observerFactory !== 'function') {
    throw new TypeError('URL, lookup, decision, and observer callbacks are required');
  }

  let running = false;
  let generation = 0;
  let current = null;
  let controller = null;
  let retryTimer = null;

  function clearRetry() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function reset() {
    ++generation;
    clearRetry();
    controller?.stop();
    controller = null;
    current = null;
  }

  function isCurrent(state, token, requestedURL) {
    return running && current === state && generation === token &&
        state.media.isConnected !== false &&
        readURL() === requestedURL &&
        videoIdFromYouTubeWatchURL(requestedURL) === state.videoId;
  }

  function maybeRequest() {
    const state = current;
    if (!running || incognito !== false || !state || state.requested ||
        !state.allowPlayback || state.media.readyState < 1 ||
        !Number.isFinite(state.media.duration) ||
        state.media.duration <= 0 || state.media.duration > 86400 ||
        videoIdFromYouTubeWatchURL(readURL()) !== state.videoId) {
      return;
    }
    state.requested = true;
    const token = generation;
    const requestedURL = readURL();
    Promise.resolve().then(() => requestSegments(state.media.duration)).then(
      response => {
        if (running && current === state && generation === token &&
            state.media.isConnected !== false &&
            readURL() !== requestedURL &&
            videoIdFromYouTubeWatchURL(readURL()) === state.videoId &&
            !state.routeRetried) {
          state.routeRetried = true;
          state.requested = false;
          maybeRequest();
          return;
        }
        if (!isCurrent(state, token, requestedURL)) {
          return;
        }
        if (response?.error === 'rate_limited' && !state.retried) {
          state.retried = true;
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (isCurrent(state, token, requestedURL)) {
              state.requested = false;
              maybeRequest();
            }
          }, RETRY_DELAY_MS);
          return;
        }
        const context = playbackContext(response);
        if (!context) {
          return;
        }
        controller = createPlaybackController(state.media, onDecision);
        controller.setContext({...context, videoId: state.videoId,
          incognito: false, allowPlayback: state.allowPlayback});
        controller.start();
      }).catch(() => {});
  }

  function onChange(snapshot) {
    if (!running) {
      return;
    }
    if (!snapshot || snapshot.videoId !== current?.videoId ||
        snapshot.media !== current?.media) {
      reset();
      if (!snapshot) {
        return;
      }
      current = {videoId: snapshot.videoId, media: snapshot.media,
        allowPlayback: false, requested: false, retried: false,
        routeRetried: false};
    }
    current.allowPlayback = snapshot.allowPlayback === true;
    controller?.setPlaybackAllowed(current.allowPlayback);
    maybeRequest();
  }

  const observer = observerFactory({root, events, readURL, onChange});
  if (typeof observer?.start !== 'function' ||
      typeof observer?.stop !== 'function') {
    throw new TypeError('A watch-page observer is required');
  }

  return {
    start() {
      if (!running && incognito === false) {
        running = true;
        observer.start();
      }
    },
    stop() {
      if (running) {
        running = false;
        observer.stop();
        reset();
      }
    },
    skipManual() { return controller?.skipManual() ?? false; },
    undo() { return controller?.undo() ?? false; },
  };
}
