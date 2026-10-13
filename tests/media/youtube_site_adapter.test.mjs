import assert from 'node:assert/strict';
import test from 'node:test';

import {videoIdFromYouTubeWatchURL} from
  '../../prism/media/youtube_site_adapter.mjs';

const VIDEO = 'AbCdEfGhI12';

test('watch URL parser accepts exact YouTube HTTPS hosts and one video ID', () => {
  for (const host of ['youtube.com', 'www.youtube.com', 'm.youtube.com',
                      'music.youtube.com']) {
    assert.equal(videoIdFromYouTubeWatchURL(
        `https://${host}/watch?v=${VIDEO}&t=12`), VIDEO);
  }
});

test('watch URL parser rejects lookalikes and ambiguous routes', () => {
  for (const url of [
    `https://youtube.com.evil.test/watch?v=${VIDEO}`,
    `http://www.youtube.com/watch?v=${VIDEO}`,
    `https://www.youtube.com:8443/watch?v=${VIDEO}`,
    `https://www.youtube.com/watch?v=${VIDEO}&v=zYxWvUtSrQ9`,
    `https://www.youtube.com/shorts/${VIDEO}`,
    `https://www.youtube.com/watch?v=bad`,
    `https://user@www.youtube.com/watch?v=${VIDEO}`,
    'not-a-url',
  ]) {
    assert.equal(videoIdFromYouTubeWatchURL(url), null, url);
  }
});
