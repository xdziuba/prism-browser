# Native Prism shell: location bar material

2026-10-15. Phase 1 follow-up under ADR 0002. The native frame and active tab
already use Prism tokens; the address field still reads as a dark Chromium slab
beside them. This slice gives the existing capsule its own quiet surface.

## Decision

In ordinary Linux/Windows Prism windows, resolve the unfocused location bar to
an opaque cool layer distinct from the toolbar: `#20323C` on dark and
`#FFFFFF` on light. Retain Chromium's rounded geometry, text field, editing,
focus background, suggestion popup, icons, page-security indicators, hit
regions, and keyboard behavior. Give only the unfocused, idle capsule a thin
blue-gray boundary. Never substitute an effect for an actual OS backdrop.

The color mixer must use the same guard as the native frame: no extension
theme, app controller, special frame, high contrast, or forced colors. The
border guard checks the resolved Prism toolbar token and excludes popup mode,
focus, and in-progress input. The system's focus and mismatch borders take
precedence. This is the restrained fill and rim anatomy from the Apple Design
Skill and local liquid-glass skill, with an opaque Linux fallback. A later
platform-specific study must decide whether true translucency is viable.

## Verification plan

Keep the Chromium delta to the existing color mixer and one bounded change in
`LocationBarView::RefreshBackground()`. Rebuild `chrome` with one job. Capture
light/dark, focused, 700 px, and forced-contrast states on the source-built
browser. Check address editing, suggestions, ordinary navigation, WebUI, F12,
and native component smoke. Record Windows and compositor behavior as open
until observed there.

## Observed result

The single-job Linux build, patch check, ordinary-page/WebUI, F12, and native
component smoke passed. Reviewed captures show separate idle and selected
address states, a 700 px fallback, and the upstream forced-contrast palette.
The Playwright page keyboard could not verify typing into browser-owned chrome;
physical address entry remains a manual test gate. The screenshots show opaque
surfaces and do not establish native backdrop blur.
