import {isMediaSettings} from './media_controls_store.mjs';
import {SKIPPABLE_CATEGORIES} from '../media/segment_policy.mjs';

export async function mountMediaControls({document, store} = {}) {
  if (!document?.getElementById || typeof store?.load !== 'function' ||
      typeof store?.save !== 'function') {
    throw new TypeError('A settings document and store are required');
  }
  const form = document.getElementById('media-form');
  const status = document.getElementById('form-status');
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

  function message(value, kind = 'info') {
    status.textContent = value;
    status.dataset.kind = kind;
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
    lock(false);
    if (!saved?.ok) {
      message('Settings could not be saved.', 'error');
      return;
    }
    draft = next;
    message('Saved. Changes take effect after the component restarts.');
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
  lock(false);
  message('Ready');
  return {ok: true};
}
