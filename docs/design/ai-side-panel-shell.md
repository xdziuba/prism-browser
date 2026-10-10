# Phase 1: native AI side panel

Status: implemented and smoke-tested on Linux, 2026-10-10. Windows verification remains open.

## Decision

Register a dedicated global Prism side-panel entry in Chromium's existing side-panel registry. Host the existing Prism assistant assets and message handler in a separate `TopChromeWebUIController` at `chrome://prism-ai-panel/`. Keep `chrome://prism-ai/` available as a full-tab view. The panel is created only when opened, using Chromium's `SidePanelWebUIViewT`; it must not add a persistent AI process.

Use the browser embedding context supplied by `SidePanelWebUIView` to bind the AI session to the owning window. Check that the context profile matches the WebUI profile and reject incognito. The full-tab view retains its existing tab lookup. Hiding or switching away from the panel stops its in-memory AI session and clears the key; closing the panel also destroys the handler. Reopening starts fresh. The Stop action remains available inside the panel.

Register an action named Prism AI for the entry and make it available in Chromium's side-panel UI. Reuse Chromium's side-panel layout, keyboard behavior, and icon color system rather than building another native frame. The existing WebUI layout already supports 420-pixel width, dark mode, visible focus, and a solid Linux fallback when blur is unavailable. Browser web content and DevTools stay unchanged.

The full-tab assistant also exposes a **Toggle side panel** button. Its WebUI message verifies the calling tab, owning window, profile, and off-the-record state before asking Chromium's side-panel service to show or close the Prism entry. This gives the user a direct native entry point without a second toolbar patch.

The tab and panel have separate WebUI origins. Their current `localStorage` model defaults therefore remain separate profile-local values; a shared profile preference is a later integration change. This panel slice does not imply that changing the model in one surface updates the other.

## Patch surface

The Prism-owned controller, config, and view factory live under `prism/ui/`. Upstream edits are limited to: side-panel entry/action IDs and metrics variant; one action registration; one global-entry registration; one side-panel GN dependency; and one WebUI config registration. Each changed file is listed in `docs/upstream-patches.md`. Avoid modifying extension APIs or the DevTools frontend.

## Verification

Build the side-panel and WebUI targets and relink `chrome` from the pinned full Chromium source. In an isolated X11 browser, open Prism AI through the native side-panel UI, verify the rendered page and model-setting persistence, start and stop a session with a fake key without sending an API request, close and reopen the panel, and confirm the session has ended. Recheck F12 and an ordinary page. Record exact results and failures in `docs/feasibility-report.md`; Windows and live OpenAI behavior remain separate gates.

## Security review

The panel receives a browser context only from Chromium's side-panel embedder. The handler compares that browser's profile with the WebUI profile and rejects off-the-record profiles; the entry itself is not registered in incognito. Hiding the panel calls the same session Stop path as the visible button, cancelling requests and tool calls and wiping the in-memory API key. A weak handler reference avoids a dangling pointer while the WebUI is destroyed. Page and extension content cannot invoke the privileged WebUI message handler. The smoke test will exercise the profile binding and hide/stop transition; redaction and approval behavior remain governed by the existing broker and need their own live action tests.
