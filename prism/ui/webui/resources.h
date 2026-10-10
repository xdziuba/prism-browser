#ifndef PRISM_UI_WEBUI_RESOURCES_H_
#define PRISM_UI_WEBUI_RESOURCES_H_

namespace prism::ui {

inline constexpr char kPrismAiHtml[] = R"PRISM(<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Prism AI</title>
  <link rel="stylesheet" href="app.css">
  <script type="module" src="app.js"></script>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="identity"><span class="mark" aria-hidden="true">◈</span><div><strong>Prism</strong><span>Browser assistant</span></div></div>
      <div class="header-actions">
        <nav class="section-nav" aria-label="Prism sections">
          <a id="nav-assistant" href="#assistant">Assistant</a>
          <a id="nav-settings" href="#settings">Settings</a>
        </nav>
        <button id="stop" class="stop" type="button" disabled>Stop agent</button>
      </div>
    </header>
    <main>
      <section id="settings-view" class="settings" hidden aria-labelledby="settings-title">
        <p class="eyebrow">PREFERENCES</p>
        <h1 id="settings-title" tabindex="-1">AI settings</h1>
        <p class="intro">Choose the model used when starting a session and manage the key stored in your system vault.</p>
        <form id="settings-form" class="settings-card">
          <h2>Default model</h2>
          <label for="default-model">OpenAI model ID</label>
          <input id="default-model" name="default-model" maxlength="128" required autocomplete="off" spellcheck="false" placeholder="Model ID">
          <p class="hint">The model ID is saved only in this browser profile. You can change it for each session.</p>
          <button class="primary" type="submit">Save default model</button>
          <p id="settings-status" class="hint" role="status"></p>
        </form>
        <div class="settings-card" aria-labelledby="key-settings-title">
          <h2 id="key-settings-title">API key</h2>
          <p class="hint">A saved key stays in your operating system's credential vault. Prism never displays it here.</p>
          <button id="settings-remove-key" type="button">Remove saved key</button>
          <p id="settings-key-status" class="hint" role="status"></p>
        </div>
      </section>
      <section id="setup" class="setup" aria-labelledby="setup-title">
        <p class="eyebrow">SESSION SETUP</p>
        <h1 id="setup-title" tabindex="-1">Work with your browser.</h1>
        <p class="intro">Start a local session. Browser actions are scoped and reviewed before they change a page.</p>
        <form id="start-form">
          <label for="model">OpenAI model</label>
          <input id="model" name="model" required autocomplete="off" spellcheck="false" placeholder="Model ID">
          <label for="api-key">API key for this session</label>
          <input id="api-key" name="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…">
          <label class="save-key"><input id="save-key" type="checkbox"> Save this key in the system vault</label>
          <p class="hint">The key stays in memory for the session. Saving it uses your operating system's credential vault.</p>
          <div class="setup-actions"><button class="primary" type="submit">Start with key</button><button id="start-saved" type="button">Use saved key</button></div>
          <button id="remove-key" class="text-button" type="button">Remove saved key</button>
          <p id="credential-status" class="hint" role="status"></p>
        </form>
      </section>
      <section id="workspace" class="workspace" hidden aria-label="AI workspace">
        <div class="session-bar"><span id="session-state" role="status">Ready</span><span id="session-model"></span></div>
        <p id="storage-status" class="hint" role="status"></p>
        <section class="permissions" aria-labelledby="permissions-title">
          <h2 id="permissions-title">Browser access</h2>
          <label><input id="grant-read" type="checkbox"> Read page and tabs</label>
          <label><input id="grant-navigate" type="checkbox"> Open and switch tabs</label>
          <label><input id="grant-interact" type="checkbox"> Close or interact with tabs</label>
          <p class="hint">Actions that can change your browser still ask for approval.</p>
        </section>
        <section id="approval" class="approval" hidden aria-labelledby="approval-title">
          <p class="eyebrow">ACTION REQUEST</p>
          <h2 id="approval-title">Review browser action</h2>
          <p id="approval-details"></p>
          <div class="approval-actions"><button id="reject" type="button">Reject</button><button id="approve" class="primary" type="button">Approve once</button></div>
        </section>
        <section class="conversation" aria-labelledby="conversation-title">
          <div class="section-heading"><h2 id="conversation-title" tabindex="-1">Conversation</h2><span>Current session</span></div>
          <div id="messages" class="messages" role="log" aria-live="polite" aria-relevant="additions text"><p class="empty">Ask about the active tab or a development task.</p></div>
        </section>
        <form id="prompt-form" class="composer"><label for="prompt">Message</label><textarea id="prompt" rows="3" maxlength="65536" required placeholder="What should I inspect?"></textarea><div class="composer-actions"><span>Enter to send · Shift+Enter for a new line</span><button id="send" class="primary" type="submit">Send</button></div></form>
        <details class="timeline"><summary>Action timeline</summary><ol id="audit"></ol></details>
      </section>
    </main>
  </div>
</body>
</html>)PRISM";

inline constexpr char kPrismAiCss[] =
    R"PRISM(:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light dark;--ink:#222522;--muted:#666d67;--paper:#f6f5f0;--surface:#fffefa;--line:#d9ddd5;--accent:#9a532f;--accent-ink:#fff;--focus:#a55b34;--glass:rgba(255,254,250,.83);--user-surface:#e8ebe4;--approval-surface:#f6e9df;--approval-line:#d9b7a1;--error:#8f3b2e;--error-line:#b47a68}[hidden]{display:none!important}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink)}button,input,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.48}button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.shell{max-width:1040px;min-height:100vh;margin:auto}.topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px clamp(20px,4vw,48px);border-bottom:1px solid var(--line);background:var(--surface)}.identity{display:flex;align-items:center;gap:12px}.identity .mark{font-size:28px;color:var(--accent)}.identity div{display:flex;flex-direction:column;line-height:1.15}.identity strong{font-size:16px;letter-spacing:-.04em}.identity span:last-child{color:var(--muted);font-size:11px;margin-top:4px;letter-spacing:.08em;text-transform:uppercase}main{padding:clamp(24px,5vw,58px)}h1{font-size:clamp(30px,4vw,52px);line-height:1.08;letter-spacing:-.06em;margin:12px 0 16px;max-width:650px}h2{font-size:17px;letter-spacing:-.03em;margin:0}.eyebrow{font-size:11px;letter-spacing:.16em;font-weight:700;color:var(--accent);margin:0}.intro{font-size:16px;line-height:1.6;color:var(--muted);max-width:570px}.setup{max-width:680px}.setup form{display:grid;gap:10px;margin-top:38px;max-width:480px}label{font-size:13px;font-weight:650}input:not([type=checkbox]),textarea{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);min-height:44px}textarea{resize:vertical;min-height:92px}.hint{font-size:12px;line-height:1.5;color:var(--muted);margin:0 0 6px}button{border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);padding:10px 15px;min-height:42px;font-weight:650}.primary{border-color:var(--accent);background:var(--accent);color:var(--accent-ink)}.primary:hover:not(:disabled){filter:brightness(1.08)}.stop{border-color:var(--error-line);color:var(--error)}.session-bar{display:flex;justify-content:space-between;color:var(--muted);font-size:12px;border-bottom:1px solid var(--line);padding-bottom:18px}.workspace{display:grid;gap:28px}.permissions{display:grid;gap:12px}.permissions label{display:flex;align-items:center;gap:10px;font-weight:500}.permissions input{accent-color:var(--accent);width:17px;height:17px}.permissions .hint{margin-top:3px}.approval{padding:20px;background:var(--approval-surface);border:1px solid var(--approval-line);border-radius:10px}.approval h2{margin:8px 0}.approval p:not(.eyebrow){overflow-wrap:anywhere;line-height:1.55}.approval-actions{display:flex;gap:10px;justify-content:flex-end}.section-heading{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:12px}.section-heading span{font-size:12px;color:var(--muted)}.messages{min-height:180px;max-height:50vh;overflow:auto;display:flex;flex-direction:column;gap:16px;padding:20px 0}.empty{color:var(--muted);font-size:14px}.message{max-width:85%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;padding:12px 15px;border-radius:10px;background:var(--surface);border:1px solid var(--line);font-size:14px}.message.user{align-self:flex-end;background:var(--user-surface)}.message.error{border-color:var(--error-line);color:var(--error)}.composer{display:grid;gap:10px;border-top:1px solid var(--line);padding-top:18px}.composer-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.composer-actions span{font-size:11px;color:var(--muted)}.timeline{border-top:1px solid var(--line);padding-top:15px;color:var(--muted);font-size:13px}.timeline summary{cursor:pointer;font-weight:650}.timeline ol{padding-left:22px;line-height:1.7}.timeline li{overflow-wrap:anywhere}@supports(backdrop-filter:blur(12px)){.topbar{background:var(--glass);backdrop-filter:blur(12px)}}@media(max-width:600px){main{padding:24px 18px}.topbar{padding:16px 18px}.composer-actions span{display:none}.message{max-width:95%}}@media(prefers-reduced-transparency:reduce){.topbar{background:var(--surface);backdrop-filter:none}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}@media(prefers-color-scheme:dark){:root{--ink:#e9e9e2;--muted:#aeb4ac;--paper:#1d211f;--surface:#292e2b;--line:#424943;--accent:#cf8d69;--accent-ink:#1b1f1d;--focus:#e2a37e;--glass:rgba(41,46,43,.87);--user-surface:#344039;--approval-surface:#3a2c26;--approval-line:#845b48;--error:#efad9d;--error-line:#8d5b4c}}.header-actions{display:flex;align-items:center;gap:18px}.section-nav{display:flex;align-items:center;gap:6px}.section-nav a{color:var(--muted);font-size:13px;font-weight:650;text-decoration:none;border-radius:7px;padding:9px 11px}.section-nav a:hover,.section-nav a[aria-current=page]{color:var(--ink);background:var(--user-surface)}.section-nav a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.settings{display:grid;gap:22px;max-width:680px}.settings .intro{margin:0 0 4px}.settings-card{display:grid;gap:12px;padding:22px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.settings-card button{justify-self:start}.settings-card .hint{max-width:56ch}.setup-actions{display:flex;gap:10px}.setup-actions button{flex:1}.save-key{display:flex;align-items:center;gap:9px;font-weight:500;margin:4px 0}.save-key input{accent-color:var(--accent);width:17px;height:17px}.text-button{border:0;background:transparent;color:var(--muted);padding:2px 0;min-height:28px;justify-self:start;text-decoration:underline;text-underline-offset:3px}@media(max-width:700px){.header-actions{gap:7px}.section-nav{gap:0}.section-nav a{padding:8px}.identity span:last-child{display:none}}@media(max-width:420px){.setup-actions{flex-direction:column}.topbar{flex-wrap:wrap}.header-actions{width:100%;justify-content:space-between}.settings-card{padding:18px}})PRISM";

inline constexpr char kPrismAiJs[] =
    R"PRISM(import {addWebUiListener} from 'chrome://resources/js/cr.js';

const $ = (id) => document.getElementById(id);
let pendingAction = null;
let busy = false;
let sessionActive = false;
const stateNames = ['submitted','denied','awaiting approval','started','completed','failed','cancellation requested','cancelled'];
const reasonNames = ['none','AI disabled','Incognito','capability not granted','invalid target','redaction unavailable','sensitive target','approval required','user rejected','stopped','browser failure','unknown action'];

function showView(focusHeading = false) {
  const settings = location.hash === '#settings';
  $('settings-view').hidden = !settings;
  $('setup').hidden = settings || sessionActive;
  $('workspace').hidden = settings || !sessionActive;
  $('nav-settings').setAttribute('aria-current', settings ? 'page' : 'false');
  $('nav-assistant').setAttribute('aria-current', settings ? 'false' : 'page');
  document.title = settings ? 'Prism AI · Settings' : 'Prism AI';
  if (focusHeading) {
    $(settings ? 'settings-title' : sessionActive ? 'conversation-title' : 'setup-title').focus();
  }
}

try {
  const savedModel = localStorage.getItem('prism.defaultModel');
  if (savedModel && savedModel.length <= 128) {
    $('model').value = savedModel;
    $('default-model').value = savedModel;
  }
} catch (_) {
  $('settings-status').textContent = 'Profile preferences are unavailable.';
}
showView();
window.addEventListener('hashchange', () => showView(true));

function setBusy(value) {
  busy = value;
  $('send').disabled = value;
  $('prompt').disabled = value;
  $('session-state').textContent = value ? 'Working' : 'Ready';
}

function addMessage(kind, value) {
  const empty = $('messages').querySelector('.empty');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = `message ${kind}`;
  item.textContent = value;
  $('messages').append(item);
  item.scrollIntoView({block: 'nearest'});
}

function renderAudit(entries) {
  const list = $('audit');
  list.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement('li');
    const state = stateNames[entry.state] || 'unknown';
    const reason = reasonNames[entry.reason] || 'unknown';
    item.textContent = `#${entry.id} ${entry.tool}: ${state}${reason === 'none' ? '' : ` · ${reason}`}`;
    list.append(item);
  }
}

function onEvent(event) {
  if (event.kind === 'ready') {
    setBusy(false);
  } else if (event.kind === 'text') {
    addMessage('assistant', event.text);
  } else if (event.kind === 'error') {
    addMessage('error', event.text);
    setBusy(false);
  } else if (event.kind === 'approval') {
    pendingAction = event.action_id;
    $('approval-details').textContent = event.details;
    $('approval').hidden = false;
    $('approve').focus();
    $('session-state').textContent = 'Awaiting approval';
  } else if (event.kind === 'stopped') {
    pendingAction = null;
    $('approval').hidden = true;
    $('stop').disabled = true;
    setBusy(false);
    $('session-state').textContent = 'Stopped';
    sessionActive = false;
    showView();
    $('grant-read').checked = false;
    $('grant-navigate').checked = false;
    $('grant-interact').checked = false;
    $('save-key').checked = false;
  }
  chrome.send('prismAudit');
}

addWebUiListener('prism-event', onEvent);
addWebUiListener('prism-audit', renderAudit);
addWebUiListener('prism-credential', (message) => {
  $('credential-status').textContent = message;
  $('storage-status').textContent = message;
  $('settings-key-status').textContent = message;
});
addWebUiListener('prism-started', (ok) => {
  if (!ok) {
    $('credential-status').textContent = 'Session could not start in this window.';
    return;
  }
  sessionActive = true;
  showView();
  $('stop').disabled = false;
  $('session-model').textContent = $('model').value.trim();
  $('prompt').focus();
});

$('start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const model = $('model').value.trim();
  const key = $('api-key').value.trim();
  if (!model || !key) {
    $('credential-status').textContent = 'Enter a model ID and an API key.';
    return;
  }
  const save = $('save-key').checked;
  $('api-key').value = '';
  chrome.send('prismStart', [model, key, save]);
});
$('start-saved').addEventListener('click', () => {
  const model = $('model').value.trim();
  if (!model) {
    $('credential-status').textContent = 'Enter a model ID first.';
    $('model').focus();
    return;
  }
  $('credential-status').textContent = 'Checking the system vault…';
  chrome.send('prismStartSaved', [model]);
});
$('remove-key').addEventListener('click', () => chrome.send('prismRemoveKey'));
$('settings-remove-key').addEventListener('click', () => chrome.send('prismRemoveKey'));
$('settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const model = $('default-model').value.trim();
  if (!model || model.length > 128) {
    $('settings-status').textContent = 'Enter a model ID of at most 128 characters.';
    return;
  }
  try {
    localStorage.setItem('prism.defaultModel', model);
    $('model').value = model;
    $('settings-status').textContent = 'Default model saved in this profile.';
  } catch (_) {
    $('settings-status').textContent = 'Profile preferences are unavailable.';
  }
});
$('prompt-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy) return;
  const text = $('prompt').value.trim();
  if (!text) return;
  chrome.send('prismSend', [text]);
  addMessage('user', text);
  $('prompt').value = '';
  setBusy(true);
});
$('prompt').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('prompt-form').requestSubmit();
  }
});
for (const [id, capability] of [['grant-read','read'],['grant-navigate','navigate'],['grant-interact','interact']]) {
  $(id).addEventListener('change', (event) => chrome.send('prismGrant', [capability, event.target.checked]));
}
$('stop').addEventListener('click', () => chrome.send('prismStop'));
$('approve').addEventListener('click', () => {
  if (pendingAction === null) return;
  chrome.send('prismApprove', [pendingAction]);
  pendingAction = null;
  $('approval').hidden = true;
  $('session-state').textContent = 'Working';
});
$('reject').addEventListener('click', () => {
  if (pendingAction === null) return;
  chrome.send('prismReject', [pendingAction]);
  pendingAction = null;
  $('approval').hidden = true;
  $('session-state').textContent = 'Working';
});
chrome.send('prismReady');)PRISM";

}  // namespace prism::ui

#endif  // PRISM_UI_WEBUI_RESOURCES_H_
