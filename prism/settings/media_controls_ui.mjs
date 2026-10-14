import {isMediaSettings} from './media_controls_store.mjs';
import {SKIPPABLE_CATEGORIES} from '../media/segment_policy.mjs';

export async function mountMediaControls({document, store, applySaved,
                                          readStatus, readSegmentStatus} = {}) {
  if (!document?.getElementById || typeof store?.load !== 'function' ||
      typeof store?.save !== 'function') {
    throw new TypeError('A settings document and store are required');
  }
  const form = document.getElementById('media-form');
  const status = document.getElementById('form-status');
  const ruleStatus = document.getElementById('rule-status');
  const segmentStatus = document.getElementById('segment-status');
  const sites = document.getElementById('site-list');
  const siteInput = document.getElementById('site-input');
  const addButton = document.getElementById('add-site');
  const saveButton = document.getElementById('save-settings');
  const segmentsEnabled = document.getElementById('segments-enabled');
  const adblockEnabled = document.getElementById('adblock-enabled');
  const actions = new Map([...form.querySelectorAll('select[data-category]')]
    .map(select => [select.dataset.category, select]));
  if (actions.size !== SKIPPABLE_CATEGORIES.length ||
      SKIPPABLE_CATEGORIES.some(category => !actions.has(category))) {
    throw new TypeError('Category controls are incomplete');
  }
  let draft = null;
  let segmentAvailable = null;

  function message(value, kind = 'info') {
    status.textContent = value;
    status.dataset.kind = kind;
  }

  async function refreshRuleStatus() {
    let value;
    try {
      value = await readStatus?.();
    } catch {
      value = null;
    }
    let summary = 'Rule status could not be checked.';
    if (value?.state === 'disabled' && value.ruleCount === 0) {
      summary = 'Off · no rules installed.';
    } else if (value?.state === 'active' &&
        Number.isSafeInteger(value.ruleCount) &&
        value.ruleCount >= 0 && value.ruleCount <= 1000 &&
        typeof value.sourceId === 'string' &&
        /^[a-z][a-z0-9._-]{0,63}$/.test(value.sourceId) &&
        typeof value.version === 'string' &&
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version)) {
      summary = `Active · ${value.ruleCount} ` +
        `${value.ruleCount === 1 ? 'rule' : 'rules'} · ` +
        `${value.sourceId} ${value.version}`;
    } else if (value?.state === 'unavailable') {
      summary = 'No verified rule package is available.';
    } else if (value?.state === 'drift') {
      summary = 'Installed rules differ from saved settings. Save again to reconcile.';
    }
    ruleStatus.textContent = summary;
  }

  async function refreshSegmentStatus() {
    let value;
    try {
      value = await readSegmentStatus?.();
    } catch {
      value = null;
    }
    segmentAvailable = typeof value?.available === 'boolean' ?
      value.available : null;
    segmentStatus.dataset.state = segmentAvailable === false ?
      'unavailable' : segmentAvailable === true ? 'ready' : 'unknown';
    segmentStatus.textContent = segmentAvailable === false ?
      'No segment provider is configured in this build. Enabling will not skip videos.' :
      segmentAvailable === true ? 'A segment provider is configured.' :
      'Segment service status could not be checked.';
  }

  function lock(locked) {
    for (const control of form.querySelectorAll('input, select, button')) {
      control.disabled = locked;
    }
  }

  function currentSettings() {
    const categories = Object.fromEntries(SKIPPABLE_CATEGORIES.map(
      category => [category, actions.get(category).value]));
    return {version: 1,
      segments: {enabled: segmentsEnabled.checked, categories},
      adblock: {enabled: adblockEnabled.checked,
        disabledSites: [...draft.adblock.disabledSites]},
    };
  }

  function renderSites() {
    sites.replaceChildren();
    for (const domain of draft.adblock.disabledSites) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = domain;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.site = domain;
      remove.setAttribute('aria-label', `Remove ${domain}`);
      remove.textContent = 'Remove';
      item.append(label, remove);
      sites.append(item);
    }
  }

  function addSite() {
    if (!draft) return;
    const domain = siteInput.value.trim().toLowerCase();
    const next = currentSettings();
    next.adblock.disabledSites.push(domain);
    if (!isMediaSettings(next)) {
      message('Enter a new domain such as example.com.', 'error');
      return;
    }
    draft = next;
    siteInput.value = '';
    renderSites();
    message('Unsaved changes');
    siteInput.focus();
  }

  addButton.addEventListener('click', addSite);
  siteInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSite();
    }
  });
  sites.addEventListener('click', event => {
    const button = event.target.closest('button[data-site]');
    if (!button || !draft) return;
    draft = currentSettings();
    draft.adblock.disabledSites = draft.adblock.disabledSites.filter(
      site => site !== button.dataset.site);
    renderSites();
    message('Unsaved changes');
  });
  form.addEventListener('change', () => {
    if (draft) message('Unsaved changes');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!draft) return;
    const next = currentSettings();
    if (!isMediaSettings(next)) {
      message('Review the settings before saving.', 'error');
      return;
    }
    lock(true);
    let saved;
    try {
      saved = await store.save(next);
    } catch {
      saved = {ok: false};
    }
    if (!saved?.ok) {
      lock(false);
      message('Settings could not be saved.', 'error');
      return;
    }
    draft = next;
    await refreshSegmentStatus();
    if (applySaved) {
      let applied;
      try {
        applied = await applySaved();
      } catch {
        applied = {ok: false};
      }
      if (!applied?.ok) {
        let segmentIssue = '';
        if (next.segments.enabled && segmentAvailable === false) {
          segmentIssue = ' Segment lookup unavailable in this build.';
        } else if (next.segments.enabled && segmentAvailable === null) {
          segmentIssue = ' Segment service status unknown.';
        }
        message(`Saved, but ad blocking could not be applied.${segmentIssue}`,
          'error');
      } else if (next.segments.enabled && segmentAvailable !== true) {
        message(segmentAvailable === false ?
          'Saved. Ad blocking updated; segment lookup unavailable in this build.' :
          'Saved. Ad blocking updated; segment service status unknown.',
        'error');
      } else {
        message('Saved. Ad blocking updated; video choices apply on the next lookup.');
      }
    } else {
      message('Saved. Changes take effect after the component restarts.');
    }
    await refreshRuleStatus();
    lock(false);
    saveButton.focus();
  });

  lock(true);
  let loaded;
  try {
    loaded = await store.load();
  } catch {
    loaded = null;
  }
  if (loaded?.error || !isMediaSettings(loaded?.settings)) {
    await refreshSegmentStatus();
    await refreshRuleStatus();
    message('Settings are unavailable. No changes were saved.', 'error');
    return {ok: false};
  }
  draft = loaded.settings;
  segmentsEnabled.checked = draft.segments.enabled;
  adblockEnabled.checked = draft.adblock.enabled;
  for (const category of SKIPPABLE_CATEGORIES) {
    actions.get(category).value = draft.segments.categories[category];
  }
  renderSites();
  await refreshSegmentStatus();
  await refreshRuleStatus();
  lock(false);
  message('Ready');
  return {ok: true};
}
