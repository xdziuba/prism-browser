// Prism-owned playback policy for SponsorBlock-compatible segment data.
// The network adapter and browser integration are separate from this module.

export const SKIPPABLE_CATEGORIES = Object.freeze([
  'sponsor',
  'intro',
  'outro',
  'interaction',
  'selfpromo',
  'preview',
  'music_offtopic',
  'filler',
]);

const CATEGORY_SET = new Set(SKIPPABLE_CATEGORIES);
const ACTION_SET = new Set(['off', 'manual', 'auto']);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const SEGMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_CANDIDATES = 4096;
const MAX_SEGMENTS = 512;
const MAX_SECONDS = 86400;
const SEEK_EPSILON = 0.05;
const MIN_SKIP_SECONDS = 0.2;

function isRecord(value) {
  return value !== null && typeof value === 'object' &&
      !Array.isArray(value);
}

export async function hashVideoIdPrefix(videoId, subtle = globalThis.crypto?.subtle) {
  if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId) ||
      !subtle?.digest) {
    return null;
  }
  const digest = new Uint8Array(
      await subtle.digest('SHA-256', new TextEncoder().encode(videoId)));
  if (digest.length < 2) {
    return null;
  }
  return Array.from(digest.slice(0, 2), byte =>
    byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeSegmentSettings(input) {
  const source = isRecord(input) ? input : {};
  const requested = isRecord(source.categories) ? source.categories : {};
  const categories = Object.create(null);
  for (const category of SKIPPABLE_CATEGORIES) {
    const action = requested[category];
    categories[category] = ACTION_SET.has(action) ? action :
        category === 'sponsor' ? 'auto' : 'off';
  }
  return {enabled: source.enabled === true, categories};
}

export function parseHashPrefixSegments({videoId, payload, duration} = {}) {
  const empty = {segments: [], rejected: 0, error: null};
  if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId)) {
    return {...empty, error: 'invalid_video_id'};
  }
  if (!Array.isArray(payload) || payload.length > MAX_CANDIDATES) {
    return {...empty, error: 'invalid_response'};
  }
  const matching = payload.filter(candidate =>
    isRecord(candidate) && candidate.videoID === videoId);
  if (matching.length === 0) {
    return empty;
  }
  if (matching.length !== 1 || !Array.isArray(matching[0].segments) ||
      matching[0].segments.length > MAX_SEGMENTS) {
    return {...empty, error: 'invalid_response'};
  }

  const maxEnd = Number.isFinite(duration) && duration > 0 ?
      Math.min(duration + 1, MAX_SECONDS) : MAX_SECONDS;
  const segments = [];
  const seen = new Set();
  let rejected = 0;
  for (const item of matching[0].segments) {
    const range = isRecord(item) ? item.segment : null;
    const start = Array.isArray(range) ? range[0] : null;
    const end = Array.isArray(range) ? range[1] : null;
    if (!isRecord(item) || !Array.isArray(range) || range.length !== 2 ||
        !Number.isFinite(start) || !Number.isFinite(end) || start < 0 ||
        end <= start || end > maxEnd || !CATEGORY_SET.has(item.category) ||
        (item.actionType !== undefined && item.actionType !== 'skip') ||
        typeof item.UUID !== 'string' || !SEGMENT_ID.test(item.UUID) ||
        seen.has(item.UUID)) {
      ++rejected;
      continue;
    }
    seen.add(item.UUID);
    segments.push({start, end, category: item.category, uuid: item.UUID});
  }
  segments.sort((left, right) =>
    left.start - right.start || left.end - right.end);
  return {segments, rejected, error: null};
}

export function decideSegmentPlayback({videoId, currentTime, duration,
                                      segments, settings, incognito = false} = {}) {
  if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId) ||
      !Number.isFinite(currentTime) || currentTime < 0 ||
      !Array.isArray(segments) || segments.length > MAX_SEGMENTS || incognito) {
    return null;
  }
  const policy = normalizeSegmentSettings(settings);
  if (!policy.enabled) {
    return null;
  }
  const maxTime = Number.isFinite(duration) && duration > 0 ?
      Math.min(duration, MAX_SECONDS) : MAX_SECONDS;
  if (currentTime >= maxTime) {
    return null;
  }
  const eligible = segments.filter(segment =>
    isRecord(segment) && CATEGORY_SET.has(segment.category) &&
    Number.isFinite(segment.start) && Number.isFinite(segment.end) &&
    segment.start >= 0 && segment.end > segment.start &&
    segment.end <= maxTime + 1 && typeof segment.uuid === 'string' &&
    SEGMENT_ID.test(segment.uuid));
  const activeManual = eligible.find(segment =>
    policy.categories[segment.category] === 'manual' &&
    segment.start <= currentTime && currentTime < segment.end);
  if (activeManual) {
    return {kind: 'manual', videoId, from: currentTime,
            to: Math.min(activeManual.end, maxTime),
            category: activeManual.category, uuid: activeManual.uuid};
  }
  const automatic = eligible.filter(segment =>
    policy.categories[segment.category] === 'auto').sort((left, right) =>
    left.start - right.start || left.end - right.end);
  const active = automatic.filter(segment =>
    segment.start <= currentTime && currentTime < segment.end);
  if (active.length === 0) {
    return null;
  }
  let target = Math.max(...active.map(segment => segment.end));
  for (const segment of automatic) {
    if (segment.start > target + SEEK_EPSILON) {
      break;
    }
    if (segment.end > target) {
      target = segment.end;
    }
  }
  for (const segment of eligible) {
    if (policy.categories[segment.category] === 'manual' &&
        segment.start > currentTime && segment.start < target) {
      target = Math.min(target, segment.start);
    }
  }
  target = Math.min(target, maxTime);
  if (target - currentTime < MIN_SKIP_SECONDS) {
    return null;
  }
  return {kind: 'auto', videoId, from: currentTime, to: target,
          uuids: automatic.filter(segment =>
            segment.start < target && segment.end > currentTime)
              .map(segment => segment.uuid)};
}

export function undoSegmentTarget(decision, videoId, currentTime) {
  if (!isRecord(decision) || decision.kind !== 'auto' ||
      decision.videoId !== videoId || !Number.isFinite(decision.from) ||
      !Number.isFinite(decision.to) || !Number.isFinite(currentTime) ||
      decision.from < 0 || decision.to <= decision.from ||
      currentTime < decision.to - 0.5 || currentTime > decision.to + 10) {
    return null;
  }
  return decision.from;
}
