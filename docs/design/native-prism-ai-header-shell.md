# Prism AI native header shell

2026-10-19. The AI panel now has Prism pin/close buttons, but the surrounding
header remains a transparent Chromium strip. Give this entry a Prism-owned
native header component so its title and actions read as one browser surface.

## Decision

Subclass `SidePanelHeader` under `prism/ui/native/` and select it only for the
Prism AI entry on Linux and Windows. Keep `SidePanelHeader`'s flex layout,
40-DIP minimum height, parent-border overlap, focus order, and all delegated
controls. The subclass owns its header paint: an opaque dark `#31424C` or
light `#EFF6F9` fill, a subtle top rim, and a one-pixel bottom boundary. The
resolved toolbar color gates both palettes. Forced contrast and custom themes
use Chromium's parent surface unchanged. No backdrop sampling or blur is
needed, so reduced-transparency behavior is the opaque fallback.

The smallest upstream changes are one guarded header selection in
`side_panel_coordinator.cc` and two guarded source entries in the existing
side-panel GN target. Both extend patch `0003`. `SidePanelHeaderController`
still owns the live title, pin state, tooltips, and close action; no page
content moves into native chrome.

## Verification

Relink the pinned Linux browser with one job. Compare dark, light, forced
contrast, and 700-pixel window captures. Exercise pin/close/restart/unpin,
keyboard close, panel lifecycle, ordinary page/WebUI, and F12. Verify patch
replay and inspect that non-Prism entries still construct upstream
`SidePanelHeader`. Windows, compositor transparency, touch, RTL, and assistive
announcements remain separate checks.

## Linux result

The pinned GN side-panel target and full browser built with one job. Dark
and light captures show the new restrained header fill, top rim, and bottom
boundary around the existing title and Prism controls. Forced contrast
retains the system surface and a visible keyboard focus ring. The design
token text pairs have calculated contrast of 9.59:1 dark and 12.26:1 light;
actual title glyphs were also reviewed in native captures. Real pin, close,
restart, toolbar reopen, unpin, and keyboard close passed in dark and forced
contrast; pointer lifecycle passed in light. A 700-pixel viewport kept the
header title and actions inside the panel. The full-page WebUI behind that
panel is clipped at this width; its responsive handling is separate work.
Ordinary page, Prism WebUI, F12, and panel lifecycle tests passed. All 19
Chromium patches remained idempotent. Windows and non-Prism panel visual
regression are still open.
