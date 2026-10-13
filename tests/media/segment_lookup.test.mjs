import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {after, test} from 'node:test';
import {
  createPrefixTransport,
  lookupSegments,
} from '../../prism/media/segment_lookup.mjs';
import {hashVideoIdPrefix} from '../../prism/media/segment_policy.mjs';

const VIDEO_ID = 'abcdefghijk';
const ENABLED = {enabled: true};
const servers = [];

after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  })));
});

async function localOrigin(handler) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test('lookup sends only the hash prefix and selects the exact video', async () => {
  const prefix = await hashVideoIdPrefix(VIDEO_ID);
  let path;
  const origin = await localOrigin((request, response) => {
    path = request.url;
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify([
      {videoID: 'otherVideo1', segments: [
        {segment: [1, 2], UUID: 'wrong', category: 'sponsor'}]},
      {videoID: VIDEO_ID, segments: [
        {segment: [3, 5], UUID: 'right', category: 'sponsor'}]},
    ]));
  });
  let options;
  const transport = createPrefixTransport({origin, fetchImpl: (url, init) => {
    options = init;
    return fetch(url, init);
  }});
  const result = await lookupSegments({videoId: VIDEO_ID, duration: 20,
    settings: ENABLED, fetchPrefix: transport});
  assert.equal(path, `/api/skipSegments/${prefix}`);
  assert.deepEqual(result.segments, [
    {start: 3, end: 5, category: 'sponsor', uuid: 'right'}]);
  assert.equal(result.error, null);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
});

test('disabled, Incognito and all-off settings make no request', async () => {
  let calls = 0;
  const fetchPrefix = () => { ++calls; throw new Error('unexpected request'); };
  for (const input of [
    {settings: ENABLED, incognito: true},
    {settings: {enabled: false}},
    {settings: {enabled: true, categories: {sponsor: 'off'}}},
  ]) {
    const result = await lookupSegments({videoId: VIDEO_ID, fetchPrefix,
      ...input});
    assert.deepEqual(result.segments, []);
    assert.equal(result.error, null);
  }
  assert.equal(calls, 0);
});

test('transport rejects unsafe origins and invalid prefixes', async () => {
  for (const origin of [
    'http://example.com', 'https://user:pass@example.com',
    'https://example.com/path', 'https://example.com/?token=secret',
  ]) {
    assert.throws(() => createPrefixTransport({origin}), TypeError);
  }
  await assert.rejects(createPrefixTransport({origin: 'https://example.com'})
      ('abc'), {tag: 'invalid_prefix'});
});

test('404 is empty; bad JSON, excess bytes and HTTP errors fail closed', async () => {
  let status = 404;
  let body = '';
  const origin = await localOrigin((_request, response) => {
    response.writeHead(status, {'content-type': 'application/json'});
    response.end(body);
  });
  const fetchPrefix = createPrefixTransport({origin});
  const run = () => lookupSegments({videoId: VIDEO_ID, settings: ENABLED,
    fetchPrefix});
  assert.deepEqual(await run(), {segments: [], rejected: 0, error: null});
  status = 200;
  body = '{bad';
  assert.equal((await run()).error, 'invalid_response');
  body = ' '.repeat(1024 * 1024 + 1);
  assert.equal((await run()).error, 'response_too_large');
  status = 503;
  body = 'server details must not escape';
  assert.equal((await run()).error, 'http_error');
});

test('redirects and caller cancellation fail closed', async () => {
  const origin = await localOrigin((_request, response) => {
    response.writeHead(302, {location: 'https://example.com/secret'});
    response.end();
  });
  const fetchPrefix = createPrefixTransport({origin});
  const redirected = await lookupSegments({videoId: VIDEO_ID,
    settings: ENABLED, fetchPrefix});
  assert.deepEqual(redirected.segments, []);
  assert.equal(redirected.error, 'network_error');

  const controller = new AbortController();
  controller.abort();
  const aborted = await lookupSegments({videoId: VIDEO_ID,
    settings: ENABLED, fetchPrefix, signal: controller.signal});
  assert.equal(aborted.error, 'aborted');
});

test('cancellation interrupts an in-flight lookup', async () => {
  let received;
  const requestReceived = new Promise(resolve => { received = resolve; });
  const origin = await localOrigin((_request, response) => {
    received();
    response.writeHead(200, {'content-type': 'application/json'});
    // Keep the response open until the caller cancels the request.
  });
  const controller = new AbortController();
  const result = lookupSegments({videoId: VIDEO_ID, settings: ENABLED,
    fetchPrefix: createPrefixTransport({origin}), signal: controller.signal});
  await requestReceived;
  controller.abort();
  assert.equal((await result).error, 'aborted');
});
