# Phase 1 shell slice: AI settings and UI tokens

Status: implemented and smoke-tested on the pinned Linux Chromium,
2026-10-10. Windows and a real OpenAI call remain Phase 0 gates.

## Scope

Add a settings view to the existing browser-owned `chrome://prism-ai/` WebUI,
addressed by `#settings`. It contains a default model ID and a control to
remove the API key from the OS credential vault. The assistant remains at
`#assistant`. Both views share one small navigation header, so a running
session keeps its in-memory state while the user checks settings. The API key
is entered only in session setup, cleared immediately when submitted, and is
never copied into local storage.

The default model ID is non-secret profile UI state. It is stored in this
WebUI origin's `localStorage`, bounded to 128 characters, and copied into the
session setup field. This avoids another upstream preference registration for
a setting that only this page reads. Vault operations continue through the
existing browser message handler. The view makes no model request on its own.

## Visual system

Use the existing warm paper and ink direction rather than changing browser
content. Formalize page tokens for background, surface, text, muted text,
border, accent, focus, approval, user message, error, and glass header in both
light and dark schemes. Text stays opaque. Header translucency is the only
glass surface in this slice; it becomes solid when backdrop blur is absent or
reduced transparency is requested. Links, buttons, inputs, and summaries keep
a visible keyboard focus ring. The view must fit a narrow side-panel width
without horizontal scrolling.

This is a WebUI shell slice, not native tab strip branding or side-panel
registration. It changes no upstream Chromium file and leaves DevTools and
extension APIs untouched. The later native chrome and side-panel integration
will get separate design notes and patch inventory entries.

## Verification

The existing `//prism/ui/webui:prism_ai_ui` target compiled and `chrome`
relinked on Linux. `scripts/phase0/settings_smoke.mjs` passed for both URL
hashes, model persistence across restart, a local-storage inventory containing
only the model ID, and no horizontal overflow at a 420-pixel dark viewport.
The standard ordinary-page and WebUI smoke tests also passed. The light and
narrow-dark screenshots are in `docs/evidence/`. Windows behavior, actual
vault removal, and live API interaction remain unverified.

Calculated contrast ratios for the page background are 14.19:1 (light text),
4.87:1 (light muted text), 13.35:1 (dark text), and 7.70:1 (dark muted text).
Accent button text is 5.75:1 in light mode and 6.08:1 in dark mode.
