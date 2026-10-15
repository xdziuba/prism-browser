# Native Prism shell: floating active tab

2026-10-15. Phase 1 follow-up under ADR 0002. The existing native color mixer
and rim distinguish Prism from stock Chromium, but the active horizontal tab
still uses Chromium's connected-to-toolbar silhouette.

## Decision

Use Chromium's existing detached rounded tab path for the active tab's fill and
stroke in an ordinary Prism Linux/Windows window. Keep the original hit-test
path and all tab layout dimensions, so clicking, dragging, maximized-window
top-edge targeting, and close-button placement are unchanged. Keep split,
pinned, closing, and dragging tabs on the upstream path. The guard checks the
Prism color tokens and excludes image themes; custom themes, high contrast,
forced colors, app windows, and non-Prism builds retain their existing path.

This creates one floating material layer above the opaque frame and toolbar.
The existing muted stroke is the optical rim; no additional shadow, animated
blur, or transparent web content is introduced. A later platform-specific
backdrop study is required before claiming true translucency. Follow the
Apple Design Skill's two-layer, restraint, and accessibility guidance and the
local liquid-glass skill's fill/rim/boundary anatomy. Use the existing
high-contrast fallback, not a simulated blur when the compositor cannot
provide one.

## Patch and verification

Change only `chrome/browser/ui/views/tabs/common/horizontal_tab_style_views.cc`
in patch `0011`. Record its rebase risk in `docs/upstream-patches.md`. Relink
the pinned Linux browser with `-j1`, capture identical light/dark windows with
several tabs, inspect the active shape and text contrast, and exercise tab
switching, keyboard focus, narrow widths, standard DevTools, Prism WebUI, and
the native component. Windows rendering and OS transparency are separate
unverified gates.

## Observed result

The pinned Linux `chrome` target built with one job. The light/dark 1280 px,
light 700 px, and forced-contrast captures in `docs/evidence/` show a detached
active tab only in the ordinary Prism palette. Ctrl+Tab selected the next tab;
the ordinary page, Prism WebUI, F12, and native component smoke tests passed.
The final build and local page/WebUI smoke passed after optimizing the guard
to avoid a color lookup on hit-test paths. True transparency and Windows
rendering remain unverified.
