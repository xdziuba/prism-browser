// Prism-owned transport boundary for hashed-prefix segment lookups.
// A browser component must choose the origin; page content must not supply it.
import {
  hashVideoIdPrefix,
  normalizeSegmentSettings,
  parseHashPrefixSegments,
} from './segment_policy.mjs';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const PREFIX = /^[0-9a-f]{4}$/;

class LookupError extends Error {
  constructor(tag) {
    super(tag);
    this.tag = tag;
  }
}

function validateOrigin(origin) {
  if (typeof origin !== 'string') {
    throw new TypeError('origin must be a string');
  }
  const url = new URL(origin);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.href !== `${url.origin}/`) {
    throw new TypeError('invalid lookup origin');
  }
  return url.origin;
}

async function readBoundedJson(response) {
  if (response.redirected) {
    throw new LookupError('redirected_response');
  }
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new LookupError('http_error');
  }
  if (!/^application\/json(?:\s*;|\s*$)/i.test(
      response.headers.get('content-type') ?? '') || !response.body) {
    throw new LookupError('invalid_response');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new LookupError('response_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  } catch {
    throw new LookupError('invalid_response');
  }
}

export function createPrefixTransport({origin, fetchImpl = globalThis.fetch} = {}) {
  const validatedOrigin = validateOrigin(origin);
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function');
  }
  return async (prefix, {signal} = {}) => {
    if (typeof prefix !== 'string' || !PREFIX.test(prefix)) {
      throw new LookupError('invalid_prefix');
    }
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetchImpl(
        `${validatedOrigin}/api/skipSegments/${prefix}`, {
          method: 'GET',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
          mode: 'cors',
          cache: 'no-store',
          headers: {Accept: 'application/json'},
          signal: requestSignal,
        });
    return readBoundedJson(response);
  };
}

export async function lookupSegments({videoId, duration, settings,
                                      incognito = false, fetchPrefix,
                                      signal} = {}) {
  const empty = {segments: [], rejected: 0, error: null};
  const policy = normalizeSegmentSettings(settings);
  if (!policy.enabled || incognito ||
      Object.values(policy.categories).every(action => action === 'off')) {
    return empty;
  }
  if (signal?.aborted) {
    return {...empty, error: 'aborted'};
  }
  const prefix = await hashVideoIdPrefix(videoId);
  if (!prefix) {
    return {...empty, error: 'invalid_video_id'};
  }
  if (signal?.aborted) {
    return {...empty, error: 'aborted'};
  }
  if (typeof fetchPrefix !== 'function') {
    return {...empty, error: 'invalid_transport'};
  }
  try {
    const payload = await fetchPrefix(prefix, {signal});
    if (signal?.aborted) {
      return {...empty, error: 'aborted'};
    }
    return parseHashPrefixSegments({videoId, payload, duration});
  } catch (error) {
    return {...empty, error: signal?.aborted ? 'aborted' :
        error instanceof LookupError ? error.tag : 'network_error'};
  }
}
