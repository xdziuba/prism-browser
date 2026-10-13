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

export function createYouTubeWatchObserver({root, events, readURL,
                                            onChange} = {}) {
  if (!root?.documentElement || typeof root.querySelector !== 'function' ||
      typeof root.addEventListener !== 'function' ||
      typeof events?.addEventListener !== 'function' ||
      typeof events?.removeEventListener !== 'function' ||
      typeof readURL !== 'function' || typeof onChange !== 'function') {
    throw new TypeError('A document, event target, URL reader, and callback are required');
  }
  const Observer = root.defaultView?.MutationObserver;
  if (typeof Observer !== 'function') {
    throw new TypeError('MutationObserver is required');
  }

  let running = false;
  let current = undefined;
  let awaitingMetadata = false;
  let navigationPending = false;
  let metadataRequiredForNextRoute = false;
  let refreshTimer = null;
  let watchedPlayer = null;
  const scheduleRefresh = () => {
    if (running && refreshTimer === null) {
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, 50);
    }
  };
  const treeObserver = new Observer(scheduleRefresh);
  const playerObserver = new Observer(scheduleRefresh);

  function watchPlayer() {
    const player = root.querySelector('#movie_player');
    if (player === watchedPlayer) {
      return;
    }
    playerObserver.disconnect();
    watchedPlayer = player;
    if (player) {
      playerObserver.observe(player, {
        attributes: true, attributeFilter: ['class'],
      });
    }
  }

  function publish(next) {
    if (current?.videoId === next?.videoId &&
        current?.media === next?.media &&
        current?.allowPlayback === next?.allowPlayback &&
        current !== undefined) {
      return;
    }
    current = next;
    onChange(next);
  }

  function refresh() {
    if (!running) {
      return;
    }
    watchPlayer();
    const snapshot = inspectYouTubeWatchPage(readURL(), root);
    if (!snapshot) {
      awaitingMetadata = false;
      publish(null);
      return;
    }
    const identityChanged = current?.videoId !== snapshot.videoId ||
        current?.media !== snapshot.media;
    if (identityChanged) {
      const newMedia = current?.media && current.media !== snapshot.media;
      awaitingMetadata = snapshot.media.readyState < 1 ||
          (current?.media === snapshot.media && current !== undefined) ||
          (metadataRequiredForNextRoute && !newMedia);
      metadataRequiredForNextRoute = false;
    }
    publish({...snapshot,
      allowPlayback: snapshot.allowPlayback && !navigationPending &&
          !awaitingMetadata});
  }

  function onNavigateStart() {
    navigationPending = true;
    metadataRequiredForNextRoute = true;
    if (current) {
      publish({...current, allowPlayback: false});
    }
  }

  function onNavigateFinish() {
    navigationPending = false;
    refresh();
    if (current && !awaitingMetadata) {
      metadataRequiredForNextRoute = false;
    }
  }

  function onMetadata(event) {
    if (event.target === current?.media) {
      awaitingMetadata = false;
      refresh();
    }
  }

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      events.addEventListener('yt-navigate-start', onNavigateStart);
      events.addEventListener('yt-navigate-finish', onNavigateFinish);
      events.addEventListener('popstate', refresh);
      root.addEventListener('loadedmetadata', onMetadata, true);
      treeObserver.observe(root.documentElement, {
        subtree: true, childList: true,
      });
      refresh();
    },
    stop() {
      if (!running) {
        return;
      }
      running = false;
      treeObserver.disconnect();
      playerObserver.disconnect();
      watchedPlayer = null;
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      events.removeEventListener('yt-navigate-start', onNavigateStart);
      events.removeEventListener('yt-navigate-finish', onNavigateFinish);
      events.removeEventListener('popstate', refresh);
      root.removeEventListener('loadedmetadata', onMetadata, true);
      if (current) {
        publish(null);
      }
    },
    refresh,
  };
}
