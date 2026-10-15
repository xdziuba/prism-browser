# Phase 2: selected-tabs context preview

2026-10-15. The active-page preview passed a source-built Linux browser smoke.
This follow-up adds the selected-tabs read path without an AI key or model call.

## Decision

Use Chromium's native multi-tab selection (Ctrl-click tabs). The browser
process reads the selected indices from the owning window; WebUI sends only a
fixed `prismPreviewSelectedTabs` signal and cannot name tab IDs or origins.
Require two or three selected HTTP(S) tabs in a regular profile. Reject the
whole request if any selected tab is internal, missing, or invalid. Capture
the selected tab IDs once, then run sequential `PageSnapshot` calls through a
fresh task-scoped `ChromiumBrowserToolService` with a READ grant. The page
adapter rechecks each tab, origin, and navigation entry before delivering it.
If one read fails, show an error and disclose no partial result.

Render a maximum of 7 KiB of redacted visible text per tab, in tab-strip
order, with an origin label, for no more than 24 KiB total. Label text is
browser-produced; all displayed text uses `textContent`. Keep this local and
ephemeral. A panel hide, WebUI teardown, or Stop clears pending work. A second
preview request during a read is ignored; the UI disables both preview
buttons. The existing single-page preview remains available unchanged.

## Security and verification

Page text is untrusted even after known-pattern redaction. No cross-profile,
Incognito, internal-page, editable field, or secret-bearing raw content may
enter the result. Each snapshot still passes the broker's permission and
audit flow. This feature does not grant a future AI session automatic access
to the selected tabs. A later model feature must ask for its own READ grant.

Build the Prism WebUI target and relink source-built Linux `chrome` with one
job. Smoke-test two selected local HTTP tabs, bounded and redacted output,
single-selection refusal, an internal-tab refusal, and no stale result after
navigation. Repeat the ordinary-page, F12, and side-panel checks. Windows and
live model behavior remain unverified.

## Observed result

The pinned Chromium Linux `chrome` target built with `-j1` after the WebUI
change; `gn check` passed for `//prism/ui/webui:prism_ai_ui`. The isolated
source-built browser smoke passed for two selected tabs, redaction and bounds,
navigation refresh, one-tab and internal-tab refusals, and the four-tab cap.
The page-context, side-panel, ordinary-page/WebUI, and F12 checks also passed.
The screenshot at `docs/evidence/phase2-selected-tabs-preview-linux-20261015.png`
was reviewed visually. Windows and model integration remain unverified.
