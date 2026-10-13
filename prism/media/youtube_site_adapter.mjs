const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function videoIdFromYouTubeWatchURL(value) {
  if (typeof value !== 'string') {
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname) ||
      url.port || url.username || url.password || url.pathname !== '/watch') {
    return null;
  }
  const ids = url.searchParams.getAll('v');
  return ids.length === 1 && VIDEO_ID.test(ids[0]) ? ids[0] : null;
}

export function inspectYouTubeWatchPage(pageURL, root) {
  const videoId = videoIdFromYouTubeWatchURL(pageURL);
  if (!videoId || !root || typeof root.querySelector !== 'function') {
    return null;
  }
  const player = root.querySelector('#movie_player');
  const media = player?.querySelector('video.html5-main-video');
  if (!media || media.tagName !== 'VIDEO') {
    return null;
  }
  return {
    videoId,
    media,
    allowPlayback: !player.classList.contains('ad-showing'),
  };
}
