# Prism active tab shape

2026-10-20. The active horizontal tab currently borrows Chromium's detached
highlight path. Its cool material and original close/new-tab controls read as
Prism, but the active body is not yet a Prism-owned shape.

## Decision

Use a small path builder under `prism/ui/native/` for the active body and its
border in ordinary Linux/Windows Prism windows. The shape is a quiet floating
panel: 11 DIP top corners, 8 DIP bottom corners, a one-DIP top/bottom inset,
and a one-DIP side inset. Radii clamp to the available width and height. Keep
the existing tab colors, paint order, title/favicon/close layout, selection
animation and Chromium hit path. Pinned, grouped, split, closing, dragged,
custom-themed, maximized hit-test and vertical tabs retain their existing
geometry. Use the existing resolved Prism color guard, so other Chromium
branding and themes are unaffected.

The upstream delta adds one guarded source pair to the existing horizontal
tab target and one guarded call in `HorizontalTabStyleViews::GetPath` for the
already-selected floating active-tab branch. The helper receives computed
pixel bounds and returns a path relative to the tab origin, with the same
render-unit conversion as upstream. It does not own tab commands or input.

## Verification plan

`gn gen` made 36,683 targets, `gn check` passed for the horizontal-tab
implementation, and the pinned Linux `chrome` target linked with `-j1` in
17.04 seconds (three actions). Reviewed three-tab captures at 1280 px in
dark/light/forced contrast and at 700 px in dark show a distinct active
floating panel without collisions with title, favicon, close or New Tab.
The capture harness exercised `Ctrl+Tab` and returned to the second tab.
Native New Tab and close-button smokes passed, as did ordinary-page/Prism
WebUI, F12 and side-panel smoke tests. All 19 patches remain idempotently
applied. No tab hit path or tab input callback was changed.

Windows, grouped/split/vertical tabs, pinned and dragged transitions, touch,
OS theme changes, reduced-motion behavior and screen-reader behavior remain
unverified. The forced-contrast screenshot validates the browser chrome at
the top; Xvfb left the web-content region black in that capture.
