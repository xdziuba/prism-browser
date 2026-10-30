# Native active-tab material

2026-10-30. Phase 1 follows ADR 0002. The detached active tab already has
Prism geometry, while its body remains one flat color. Give that existing
surface the same restrained light response as the toolbar without changing
the tab model, hit path, or accessible controls.

## Decision

Paint a low-opacity vertical light gradient inside the active tab's existing
fill clip, after its normal color and before icons, title, and stroke. Limit
the treatment to ordinary ungrouped, unpinned, unsplit Linux/Windows tabs
whose resolved active fill is an exact Prism dark or light token. Skip custom
toolbar images, dragging, closing, high contrast, and Chromium GlassFrame.
The gradient must be quiet enough to preserve text contrast and should not
look like a second focus ring. Keep the existing edge stroke as the sole
boundary cue.

Implement the painter in Prism-owned native source and make one guarded call
from Chromium's existing tab-fill function. No new layer, blur animation,
window transparency, or content overlap is introduced.

## Backdrop feasibility boundary

In the pinned Chromium revision, `features::IsGlassFrameEnabled()` returns
false outside macOS 26+, regardless of the feature flag. Its native window
material and `GlassFrameService` paths are Mac-specific. Chromium's generic
`ui::Layer::SetBackgroundBlur()` can blur content behind a composited layer,
but ordinary horizontal tabs and the toolbar sit above the web viewport;
there is no page content behind them in this layout. Linux/X11 also cannot
assume access to other windows' pixels. Real blur will therefore need a
separate platform-aware overlap/compositor design and an opaque fallback. Do
not force-enable upstream GlassFrame on Linux/Windows or call an optical
gradient a tested backdrop effect.

## Verification

Build the affected tab target and relink `chrome` with one job. Review
dark/light active-tab captures alongside earlier captures, verify that
forced contrast keeps its flat styling, inspect a narrow window, and re-run native
New Tab/close, ordinary page/WebUI, and F12 smokes. Windows, touch, grouped
and split tabs, custom themes, and real backdrop blur remain open.

## Observed Linux result

The Prism painter and one guarded upstream call compiled in the horizontal-tab
target; the pinned browser relinked with `-j1`. Dark, light, forced-contrast,
and 700 px captures on an isolated Xvfb display show a
lighter top face on the active tab, legible text, and intact tab geometry. The
forced-contrast capture uses Chromium's flat high-contrast tab treatment.
Three tabs were created, switched, and captured by Playwright; the ordinary
page, Prism WebUI, native New Tab and Close clicks, and F12 also passed their
browser smokes.

The new rootless Mutter/Xwayland display rendered the browser but did not
deliver XTest clicks and F12, so those results were discarded. A locally
extracted, checksum-verified Xvfb package restored the earlier isolated
test setup without system installation. The captured material is optical;
real backdrop blur remains unverified.
