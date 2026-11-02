# Native organizer glass probe

2026-10-30. Phase 1 continues under ADR 0002. This note records a rejected
backdrop-blur candidate so later UI work does not mistake a translucent panel
for glass over page content.

## Decision

The pinned Chromium revision has a generic `ui::Layer::SetBackgroundBlur()`
path, but the organizer tray and normal web viewport are laid out side by
side. Enabling blur on that tray cannot sample the page. Keep the existing
opaque layout. Do not enable Chromium's Mac-only GlassFrame flag on Linux or
Windows. The horizontal tab strip and toolbar also sit above the page
viewport. A meaningful top-chrome backdrop effect requires a deliberate
overlap or a different same-window visual backdrop, with correct page insets,
hit testing, accessibility, reduced-transparency and compositor fallbacks.

## Evidence required

An experimental Prism guard and opacity change compiled and linked in the
Linux browser. An isolated Xvfb capture with `OrganizerPanel` enabled and a
12 px checkerboard page showed the checkerboard starting exactly at the
tray's right edge, x=320 in a 1280 px window. The tray did not overlay page
pixels; no visible page blur was possible. The experimental product change
was removed before commit. GN regenerated and `chrome` relinked in two
single-job actions. The source-built browser then passed ordinary-page,
Prism WebUI, F12, and native navigation smokes. The rejected geometry is
captured in `docs/evidence/prism-organizer-no-backdrop-linux-20261102.png`.
