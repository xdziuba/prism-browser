// One transient, keyboard-accessible action for the active video session.
import {SKIPPABLE_CATEGORIES} from './segment_policy.mjs';

const CATEGORY_LABELS = Object.freeze({
  sponsor: 'sponsor',
  selfpromo: 'self-promotion',
  interaction: 'interaction',
  intro: 'intro',
  outro: 'outro',
  preview: 'preview',
  music_offtopic: 'off-topic music',
  filler: 'filler',
});
const CATEGORIES = new Set(SKIPPABLE_CATEGORIES);
const UNDO_VISIBLE_MS = 10000;

function validDecision(decision) {
  return decision && typeof decision === 'object' &&
    (decision.kind === 'manual' || decision.kind === 'auto') &&
    Number.isFinite(decision.from) && Number.isFinite(decision.to) &&
    decision.from >= 0 && decision.to > decision.from &&
    (decision.kind === 'auto' || CATEGORIES.has(decision.category));
}

export function createPlaybackControls({document, onSkip, onUndo} = {}) {
  if (!document?.createElement || typeof onSkip !== 'function' ||
      typeof onUndo !== 'function') {
    throw new TypeError('A document and playback actions are required');
  }
  let host = null;
  let button = null;
  let announcement = null;
  let current = null;
  let expiry = null;

  function hide() {
    if (expiry !== null) {
      clearTimeout(expiry);
      expiry = null;
    }
    host?.remove();
    host = null;
    button = null;
    announcement = null;
    current = null;
  }

  function createHost() {
    if (!document.body) return false;
    host = document.createElement('div');
    host.setAttribute('data-prism-media-control', '');
    const shadow = host.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    style.textContent = `
      :host { position: fixed; right: 16px; bottom: 84px;
        z-index: 2147483646; font: 600 14px/1.3 system-ui, sans-serif; }
      button { min-height: 44px; max-width: min(280px, calc(100vw - 32px));
        padding: 10px 16px; border: 1px solid #d8e3ff; border-radius: 10px;
        background: #111b30; color: #fff; box-shadow: 0 4px 16px #0008;
        cursor: pointer; font: inherit; }
      button:hover { background: #24385a; }
      button:focus-visible { outline: 3px solid #ffd866; outline-offset: 3px; }
      .announcement { position: absolute; width: 1px; height: 1px;
        padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%);
        white-space: nowrap; border: 0; }
      @media (prefers-contrast: more) {
        button { border: 2px solid currentColor; box-shadow: none; }
      }
    `;
    announcement = document.createElement('span');
    announcement.className = 'announcement';
    announcement.setAttribute('role', 'status');
    button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      try {
        if (current?.kind === 'manual') onSkip();
        if (current?.kind === 'auto') onUndo();
      } finally {
        hide();
      }
    });
    shadow.append(style, announcement, button);
    document.body.append(host);
    return true;
  }

  return {
    show(decision) {
      if (!validDecision(decision)) {
        hide();
        return false;
      }
      if (!host && !createHost()) return false;
      if (expiry !== null) clearTimeout(expiry);
      expiry = null;
      current = decision;
      button.textContent = decision.kind === 'manual' ?
        `Skip ${CATEGORY_LABELS[decision.category]} segment` : 'Undo skip';
      announcement.textContent = decision.kind === 'manual' ?
        `${CATEGORY_LABELS[decision.category]} segment. Skip available.` :
        'Segment skipped. Undo available.';
      if (decision.kind === 'auto') {
        expiry = setTimeout(hide, UNDO_VISIBLE_MS);
      }
      return true;
    },
    stop: hide,
  };
}
