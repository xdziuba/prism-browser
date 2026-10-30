# Prism toolbar optical material

2026-10-29. The ordinary Linux/Windows Prism toolbar is still a flat fill
between the floating tab and the address capsule. This is the first whole-bar
material pass within Phase 1 under ADR 0002. It is an optical treatment, not
an OS backdrop blur claim.

## Decision

Extend the existing Prism-owned `PrismNavigationRailBackground` painter.
After Chromium paints its normal toolbar shape, clip a low-opacity vertical
light gradient and a narrow top rim to that same shape, then paint the
navigation rail. Keep Chromium's corner geometry, address/extension/button
layout, controls, focus, hit testing, and tab model intact. The whole-bar
light should be visible but quieter than the focused omnibox.

Paint only when the resolved toolbar color is the Prism dark or light token,
the platform does not request high contrast, and Chromium's own glass-frame
mode is not active. This preserves custom themes, forced colors and future
upstream glass behavior. The lower toolbar remains opaque so text and icons
retain contrast. No web content, DevTools, side panel, or window transparency
is altered. The paint path must not create a new composited layer, animate a
blur, or affect the native event path.

The Apple Design Skill's functional-layer hierarchy and restraint guide the
single highlighted toolbar surface. The local liquid-glass skill informs the
top rim, translucent light, and boundary. A platform-specific backdrop study
remains separate: if the window/compositor cannot supply true background
sampling, this opaque treatment is the fallback rather than a fake blur.

## Verification plan

Change only the Prism-owned toolbar background C++ file; no new Chromium
patch. Run source formatting, a single-job incremental Linux `chrome` build,
and isolated X11 captures in dark, light, forced contrast, and a narrow
window. Compare the same screenshot coordinates before/after to prove the
toolbar changed while page content and forced contrast did not. Recheck
ordinary-page/WebUI, F12, native navigation clicks, and tab close. Windows,
compositor blur, theme variants, touch and screen readers remain open.

## Observed Linux result

The Prism-owned source compiled as one toolbar object, and the pinned Linux
browser linked in one action with `-j1`. The dark and light toolbar gained a
visible upper light band and lower cool shade. At screen pixel `(700, 42)`,
dark changed from `#2C3942` to `#46525A`, light from `#F5F9FB` to
`#FCFDFE`. At `(700, 82)`, the dark/lighter lower tones were `#2B3841`
and `#EDF3F7`. The corresponding forced-contrast toolbar crop changed zero
pixels. The ordinary-page/WebUI, F12, Back/Forward and native tab-close
smokes passed. Full screenshot names and platform limits are recorded in
`docs/feasibility-report.md`. The result is opaque optical glass; backdrop
sampling and blur remain unimplemented.
