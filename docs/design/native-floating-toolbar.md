# Native floating toolbar surface

2026-11-02. Phase 1 continues under ADR 0002. The navigation controls and
active tab are already Prism-owned, but the toolbar still reads as a full-width
blue slab. Give it a distinct functional surface without moving controls or
claiming page backdrop sampling.

## Decision

Extend the existing Prism-owned `PrismNavigationRailBackground` painter. For
ordinary Prism dark/light tokens, paint the frame color into the existing
toolbar background path, then draw a capsule inset 4 DIP from the horizontal
edges and 3 DIP from the top. Use one vertical tonal gradient, a low-contrast
outline, a single top highlight and a 1 DIP lower shadow. Preserve Chromium's
background path for window corners, the current navigation rail, child view
layout, hit regions, focus, and native frame buttons. Avoid new compositor
layers, theme overrides, animations, or blur.

Only use this treatment when the normal Prism toolbar token resolves and the
native theme does not request increased contrast, forced colors, or reduced
transparency. In those modes, let the existing Chromium background and Prism
navigation controls paint as before. No page or DevTools content is changed.
The capsule must remain readable at 700 px and in both color schemes. This is
an optical glass surface. Real backdrop blur needs a later layout design that
places meaningful pixels behind browser chrome without obscuring web content.

## Verification

Capture baseline and changed dark/light/forced-contrast browser chrome on the
same isolated X11 display. Compare pixels within the bar and check unchanged
forced-contrast rendering. Run the single-job toolbar target and browser link,
then ordinary page/WebUI, F12, native Back/Forward, and narrow-window smokes.
Windows, OS-driven reduced transparency, custom theme variants, and actual
backdrop sampling remain open.

## Observed Linux result

The Prism-owned toolbar painter compiled and `chrome` relinked with `-j1` in
two actions. In 1280 px captures, the dark bar gains a frame-colored margin
and a lighter capsule; the light bar gains a pale frame gap and white surface.
At `(500, 40)`, dark changed from `#82929B` to the frame token `#1C2932`,
and light from `#FFFFFF` to `#E2EBF0`. At `(700, 42)`, the surface changed
from `#46525A` to `#3C4C56` in dark and `#FCFDFE` to `#D2DFE6` in light.
The same 5,250-pixel top strip changed zero pixels under forced contrast.
The 700 px dark capture keeps navigation, address, avatar, and menu controls
inside the bar without clipping.

`browser_smoke.py`, `devtools_f12_smoke.mjs`, and
`native_navigation_button_smoke.mjs` passed on the relinked browser. Captures
are `docs/evidence/prism-floating-toolbar-{dark,light,forced-contrast}-1280-linux-20261102.png`
and `prism-floating-toolbar-dark-700-linux-20261102.png`. This is a sharper
optical material, not a tested backdrop blur.
