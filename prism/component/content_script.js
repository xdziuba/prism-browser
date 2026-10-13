// Runs only in the extension isolated world; the worker owns settings and data.
if (window.top === window && chrome.extension.inIncognitoContext === false) {
  void Promise.all([
    import(chrome.runtime.getURL('media/watch_playback_session.mjs')),
    import(chrome.runtime.getURL('media/playback_controls.mjs')),
  ]).then(([{createWatchPlaybackSession}, {createPlaybackControls}]) => {
    let session;
    const controls = createPlaybackControls({
      document,
      onSkip: () => session?.skipManual(),
      onUndo: () => session?.undo(),
    });
    session = createWatchPlaybackSession({
      root: document,
      events: window,
      readURL: () => location.href,
      requestSegments: duration => chrome.runtime.sendMessage({
        type: 'prism.media.lookup', duration,
      }),
      onDecision: decision => controls.show(decision),
      incognito: false,
    });
    session.start();
    window.addEventListener('pagehide', () => {
      session.stop();
      controls.stop();
    }, {once: true});
  }).catch(() => {});
}
