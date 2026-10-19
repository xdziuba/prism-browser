# Prism AI native panel header icons

2026-10-19. The Prism AI side panel already has a working native title,
pin/unpin action, and close action. Their Chromium glyphs are visually
unrelated to the new Prism toolbar mark. This slice gives those two controls
original glyphs while keeping Chromium's button instances, callbacks,
tooltips, accessibility properties, focus and pin state updates.

## Decision

Create three 20-unit monochrome vectors under `prism/ui/native/`: a pin, a
slashed unpin, and a close cross. Select them only when the active side-panel
entry is Prism AI on Linux or Windows. The existing
`kColorSidePanelHeaderButtonIcon` and disabled variant supply all colors;
forced contrast and other side-panel entries keep their normal control
semantics. A small guarded source entry in the side-panel GN target and icon
selection in `side_panel_header_controller.cc` extend existing patch `0003`.

Verify pin and unpin persistence through the native header after a Linux
relink, close/open from a real X11 click, dark/light/forced contrast captures,
and ordinary page, Prism WebUI, F12, and side-panel lifecycle smoke tests.
Windows rendering, narrow layout, touch, RTL, and assistive announcement
remain separate checks. Custom header layout and button surfaces are later
work; this slice changes iconography only.

## Linux result

The GN target and browser built with one job. Native X11 runs in dark, light,
and forced contrast each pinned the Prism AI panel from its header, closed
it, restarted the browser, reopened it from the toolbar, and unpinned it.
The original pin/unpin and close vectors were reviewed in full-window
captures. The forced-contrast hover highlight briefly obscured the pin glyph;
moving the pointer away showed the glyph clearly in its idle state. No panel
behavior or accessibility path was replaced. Windows and assistive-technology
verification remain open.
