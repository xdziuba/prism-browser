# Prism AI native panel controls

2026-10-19. The Prism AI panel header has original icons, but its pin and
close controls still use Chromium's generic button surface. Give these two
controls Prism-owned native button classes while retaining the controller's
callbacks, pin state, tooltips, accessibility description, element IDs, focus
behavior, and layout. Other side panels continue to use Chromium buttons.

## Decision

Add an `ImageButton` and `ToggleImageButton` subclass under
`prism/ui/native/`, selected only for `kPrismAi` on Linux and Windows. Use the
existing 20-unit Prism vectors and Chromium color IDs for their glyphs. Each
class paints a centered rounded 28-ish DIP surface behind the glyph: opaque
dark `#364954` or light `#EBF3F6` at rest, stronger fill on hover and press,
and a one-pixel rim. State feedback is immediate. The resolved Prism toolbar
color gates these fills so a custom theme cannot receive mismatched paint.
For forced contrast and unknown palettes, paint a one-pixel state outline in
the resolved header-icon color, leaving the center transparent. The classes
disable the generic ink drop because it can obscure the original glyph in
forced contrast. Keep Chromium's focus ring and minimum hit target.

This is a surface treatment, not an imitation of backdrop blur. The panel
does not refract page content. Reduced transparency therefore needs no
separate rendering branch. Touch and narrow layout retain Chromium sizing.
The smallest upstream changes are conditional construction in
`side_panel_header_controller.cc` and a guarded GN source list; both remain
in patch `0003`.

## Verification

Build the side-panel target and browser on Linux with one job. Exercise real
pin, close, restart, reopen, and unpin clicks in dark, light, and forced
contrast. Review idle and hover screenshots, ordinary page/WebUI, DevTools,
and a non-Prism side panel. Check patch replay. Windows, touch, RTL, narrow
layout, and screen-reader announcements remain unverified until tested.

## Linux result

The side-panel GN target and full browser linked with one job. In dark,
light, and forced contrast, real native X11 clicks pinned the panel, closed
it, reopened it from the persistent toolbar action after restart, and unpinned
it. Idle captures show the new surfaces in dark/light; hover captures show
immediate fill feedback in dark and a transparent outlined fallback in forced
contrast. The forced-contrast glyph remains visible under hover. The regular
page, Prism WebUI, F12, and panel lifecycle smokes passed. Native keyboard
navigation focused the close control after Tab/Shift+Tab; Enter closed the
panel, and the focus ring was visible in dark and forced contrast. All 19 Chromium
patches remained idempotent. Windows and the other checks above are still
open.
