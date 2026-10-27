# Prism overflow menu navigation icons

2026-10-27. The native overflow trigger is a Prism control, but its Forward
and Home rows still use Chromium's stock vectors. When those actions move out
of the narrow toolbar, their identity should remain visually continuous.

## Decision

Move the original Prism Back, Forward and Home vector definitions into one
small Prism-owned header. Use the same Forward and Home glyphs in the
responsive overflow menu on Linux/Windows. Leave Profile, Incognito, pinned
actions, menu text, enablement, callbacks, metrics, separators, item bounds,
focus and native menu behavior unchanged. Other platforms retain their
upstream icons. The new header is only a vector definition; it adds no runtime
service or painting layer.

The menu's icon image does not mirror the Forward path automatically in RTL.
Choose Prism's left-pointing path for that row when `base::i18n::IsRTL()` is
true; the Home path is symmetric enough to use in both directions.

The upstream change is limited to `overflow_menu.cc`: select the two icons
from the shared Prism header under a platform guard. The existing toolbar
target already compiles Prism navigation and Home buttons. Record this file
and its rebase risk in `docs/upstream-patches.md`.

## Verification plan

Regenerate GN and build `chrome` with one job. On the pinned Linux binary,
open the real overflow menu at a narrow width, exercise Forward and Home
where possible, and review dark, light, forced-contrast and RTL captures.
Run ordinary-page/WebUI, F12 and panel smoke tests. Keep Windows and
screen-reader output unverified until tested on those surfaces.
