import {decideSegmentPlayback, undoSegmentTarget} from './segment_policy.mjs';

const SEEK_EPSILON = 0.05;

export function createPlaybackController(media, onDecision = () => {}) {
  if (!media || typeof media.addEventListener !== 'function' ||
      typeof media.removeEventListener !== 'function' ||
      typeof onDecision !== 'function') {
    throw new TypeError('A media element and decision callback are required');
  }

  let running = false;
  let context = null;
  let manualDecision = null;
  let lastAutoDecision = null;
  const suppressed = new Map();

  function clearManual() {
    if (manualDecision) {
      manualDecision = null;
      onDecision(null);
    }
  }

  function evaluate() {
    if (!running || !context || context.incognito !== false ||
        context.allowPlayback !== true ||
        !Number.isFinite(media.duration) || media.duration <= 0 ||
        !Number.isFinite(media.currentTime)) {
      clearManual();
      return null;
    }

    for (const [uuid, range] of suppressed) {
      if (media.currentTime < range.start - SEEK_EPSILON ||
          media.currentTime >= range.end + SEEK_EPSILON) {
        suppressed.delete(uuid);
      }
    }
    const segments = context.segments.filter(segment =>
      segment && typeof segment === 'object' &&
      !suppressed.has(segment.uuid));
    const decision = decideSegmentPlayback({
      videoId: context.videoId,
      currentTime: media.currentTime,
      duration: media.duration,
      segments,
      settings: context.settings,
      incognito: context.incognito,
    });
    if (!decision) {
      clearManual();
      return null;
    }
    if (decision.kind === 'manual') {
      if (!manualDecision || manualDecision.uuid !== decision.uuid) {
        manualDecision = decision;
        onDecision(decision);
      }
      return decision;
    }

    clearManual();
    lastAutoDecision = decision;
    media.currentTime = decision.to;
    onDecision(decision);
    return decision;
  }

  function setContext(nextContext) {
    const hadAutoDecision = lastAutoDecision !== null;
    context = nextContext && typeof nextContext === 'object' ? {
      videoId: nextContext.videoId,
      segments: Array.isArray(nextContext.segments) ?
          nextContext.segments.slice() : [],
      settings: nextContext.settings,
      incognito: nextContext.incognito,
      allowPlayback: nextContext.allowPlayback,
    } : null;
    suppressed.clear();
    lastAutoDecision = null;
    clearManual();
    if (hadAutoDecision) {
      onDecision(null);
    }
    return evaluate();
  }

  function undo() {
    if (!lastAutoDecision || !context) {
      return false;
    }
    const target = undoSegmentTarget(
        lastAutoDecision, context.videoId, media.currentTime);
    if (target === null) {
      lastAutoDecision = null;
      return false;
    }
    for (const segment of context.segments) {
      if (segment && typeof segment === 'object' &&
          lastAutoDecision.uuids.includes(segment.uuid)) {
        suppressed.set(segment.uuid, segment);
      }
    }
    lastAutoDecision = null;
    onDecision(null);
    media.currentTime = target;
    return true;
  }

  function skipManual() {
    if (!manualDecision || !context ||
        manualDecision.videoId !== context.videoId) {
      return false;
    }
    const target = manualDecision.to;
    clearManual();
    media.currentTime = target;
    return true;
  }

  return {
    start() {
      if (!running) {
        running = true;
        media.addEventListener('timeupdate', evaluate);
        media.addEventListener('seeked', evaluate);
        media.addEventListener('durationchange', evaluate);
        evaluate();
      }
    },
    stop() {
      if (running) {
        running = false;
        media.removeEventListener('timeupdate', evaluate);
        media.removeEventListener('seeked', evaluate);
        media.removeEventListener('durationchange', evaluate);
        const hadAutoDecision = lastAutoDecision !== null;
        clearManual();
        lastAutoDecision = null;
        suppressed.clear();
        if (hadAutoDecision) {
          onDecision(null);
        }
      }
    },
    setContext,
    evaluate,
    undo,
    skipManual,
  };
}
