// Privileged lookup boundary for a future bundled media component extension.
import {isMediaSettings} from '../settings/media_controls_store.mjs';
import {lookupSegments} from './segment_lookup.mjs';
import {videoIdFromYouTubeWatchURL} from './youtube_site_adapter.mjs';

const HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
]);
const MAX_DURATION = 86400;
const MAX_ACTIVE_LOOKUPS = 16;
const MAX_TRACKED_TABS = 128;
const REQUEST_GAP_MS = 500;

function exactKeys(value, expected) {
  return value !== null && typeof value === 'object' &&
      !Array.isArray(value) &&
      Reflect.ownKeys(value).length === expected.length &&
      expected.every(key => Object.hasOwn(value, key));
}

function youtubeOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && HOSTS.has(url.hostname) &&
        !url.port && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

function videoIdFromSender(sender, extensionId) {
  if (!sender || sender.id !== extensionId || sender.frameId !== 0 ||
      !Number.isSafeInteger(sender.tab?.id) || sender.tab.id < 0 ||
      sender.tab.incognito !== false ||
      (sender.documentLifecycle !== undefined &&
        sender.documentLifecycle !== 'active')) {
    return null;
  }
  const senderOrigin = youtubeOrigin(sender.url);
  const tabOrigin = youtubeOrigin(sender.tab.url);
  if (!senderOrigin || senderOrigin !== tabOrigin ||
      (sender.origin !== undefined && sender.origin !== senderOrigin)) {
    return null;
  }
  return videoIdFromYouTubeWatchURL(sender.tab.url);
}

export function createSegmentMessageHandler({extensionId, settingsStore,
                                            fetchPrefix, incognito} = {}) {
  if (typeof extensionId !== 'string' || !/^[a-p]{32}$/.test(extensionId)) {
    throw new TypeError('A component extension ID is required');
  }
  const lastRequestAt = new Map();
  let activeLookups = 0;
  return async (message, sender) => {
    const empty = (error) => ({segments: [], rejected: 0, error});
    if (incognito !== false) {
      return empty('incognito_disabled');
    }
    if (!exactKeys(message, ['type', 'duration']) ||
        message.type !== 'prism.media.lookup' ||
        !Number.isFinite(message.duration) || message.duration <= 0 ||
        message.duration > MAX_DURATION) {
      return empty('invalid_request');
    }
    const videoId = videoIdFromSender(sender, extensionId);
    if (!videoId) {
      return empty('unauthorized');
    }
    const now = performance.now();
    for (const [tabId, timestamp] of lastRequestAt) {
      if (now - timestamp >= REQUEST_GAP_MS) {
        lastRequestAt.delete(tabId);
      }
    }
    if (activeLookups >= MAX_ACTIVE_LOOKUPS ||
        lastRequestAt.has(sender.tab.id) ||
        lastRequestAt.size >= MAX_TRACKED_TABS) {
      return empty('rate_limited');
    }
    lastRequestAt.set(sender.tab.id, now);
    ++activeLookups;
    try {
      let loaded;
      try {
        loaded = await settingsStore.load();
      } catch {
        return empty('settings_unavailable');
      }
      if (loaded?.error || !isMediaSettings(loaded?.settings)) {
        return empty('settings_unavailable');
      }
      if (!loaded.settings.segments.enabled) {
        return empty('disabled');
      }
      const result = await lookupSegments({videoId, duration: message.duration,
        settings: loaded.settings.segments, incognito: false, fetchPrefix});
      return {...result, segments: result.segments.flatMap(segment => {
        const mode = loaded.settings.segments.categories[segment.category];
        return mode === 'auto' || mode === 'manual' ?
          [{...segment, mode}] : [];
      })};
    } finally {
      --activeLookups;
    }
  };
}
