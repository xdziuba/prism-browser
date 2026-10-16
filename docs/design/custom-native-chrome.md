# Custom Prism browser chrome

2026-10-15. User clarification: the glassmorphism overhaul means original
Prism components, layout, icons, and interaction states across browser chrome,
not a palette applied to Chromium controls. The earlier frame/tab/address
changes are a material foundation, not completion of this requirement.

## Component architecture

Keep the browser engine, command dispatch, tab model, omnibox editing,
extension area, DevTools, and platform window controls in Chromium. Build
Prism-owned Views components under `prism/ui/native/`, wired through narrow
Chromium patches. Each component owns its visible geometry, iconography, and
interaction feedback while delegating browser semantics to the existing
model or control. This preserves middle-click, long-press history, keyboard
shortcuts, focus, tab switching, extension APIs, and assistive labels.

Implement the shell in these reviewable slices:

1. Replace back/forward visuals with Prism-owned navigation controls and
   original vector glyphs; retain Chromium's history model and click actions.
2. Give reload/stop, home, and menu buttons the same component language, with
   their native status and menus intact.
3. Design a Prism-owned navigation layout around the editable omnibox and
   page actions, including narrow-window behavior and focus order.
4. Replace the tab presentation (shape, close affordance, new-tab control,
   hover/selected states) with Prism-owned components on the existing tab
   model, including pinned/grouped/vertical/split cases.
5. Unify side panel, menus, and settings surfaces with the same tokens and
   custom controls. Treat platform-specific blur as a separate verified
   enhancement, never as a precondition for legibility.

The style is restrained cool glass: an opaque Linux fallback, a lighter
raised control fill, one edge highlight, and clear focus. The Apple Design
Skill supplies hierarchy, immediate feedback, and spatial consistency; the
local liquid-glass skill supplies fill/rim/boundary anatomy. Do not blur web
content or stack many translucent layers. Respect forced colors, high
contrast, reduced transparency, RTL, and touch dimensions. This follows
ADR 0002 while the Windows, Store update, and live OpenAI gates remain open;
it does not claim Phase 0 completion.

## First component: back and forward

Use `PrismNavigationButton`, a Prism-owned subclass of Chromium's
`BackForwardButton` so the history menu, chained-back tracking, click metrics,
preloading signal, accessible name, command IDs, and tooltips remain intact.
Provide original 20-unit thin-stroke arrow glyphs and a rounded inset control
with distinct idle, hover, and pressed states. Preserve the outer button
bounds and focus ring. Enable the visual override only when the resolved
ordinary toolbar has a Prism token on Linux/Windows; upstream theme and
accessibility palettes keep Chromium's control. This is a complete custom
visible button component, not merely a color change.

The upstream patch should touch only `toolbar_view.cc` to select the class and
`toolbar/BUILD.gn` to compile Prism-owned sources. The custom icon remains
recognizably Prism under system themes, while the capsule surface uses the
Prism palette guard. Relink the source-built
Linux browser with `-j1`, inspect dark/light and forced-color captures, and
verify back/forward clicks, history menu, F12, WebUI and ordinary navigation.
Windows rendering and real backdrop blur remain unverified until tested.

## Observed Linux result

Patch `0013` adds only the Linux/Windows class selection in `ToolbarView` and
the two Prism-owned source entries in the toolbar target. `gn gen` and `gn
check` passed; the pinned source-built `chrome` relink passed with `-j1` after
the final platform guard. The X11 native-button smoke clicked the custom Back
and Forward controls on two local HTTP history entries and sent the browser's
Alt+Left key chord; all three navigations passed. Ordinary-page/Prism WebUI,
F12/DevTools, and native side-panel smoke also passed after the final build.

Light, dark, forced-contrast, and 700 px screenshots in `docs/evidence/` were
reviewed. They show the new inset capsules and original arrows in the Prism
palette, no pill painting in forced contrast, and no navigation overflow at
700 px. The icons remain original Prism glyphs in forced contrast while using
the system's icon color. The history context menu, touch behavior, Windows
rendering, compositor blur, and complete toolbar/tab replacement remain
**unverified**.

## Next component: reload and stop

Reuse the same Prism capsule painter for the reload/stop control to keep the
navigation group coherent. Add `PrismReloadButton` over Chromium's existing
`ReloadButton`; retain command dispatch, double-click/stop timing, DevTools
reload menu, accessibility and presentation metrics. Give both visible modes
original Prism vector glyphs and switch them using the existing mode-change
callback. Let Chromium keep its short reload-to-stop transition and focus
ring. Keep the same Prism-palette guard for the custom capsule; system and
forced-contrast backgrounds remain native. The upstream delta remains the
two already-touched toolbar files, and the same Linux/Windows guard.

Verify actual native reload click, stop during a slow local response, mode
icon changes, ordinary navigation, F12 and forced-contrast appearance before
claiming the component works. A context menu with DevTools attached and
Windows/touch rendering are separate gates.

### Observed Linux result

The shared `PrismNavigationSurface` paints all three controls while
`PrismReloadButton` selects original reload/stop vectors through Chromium's
mode-change callback. The source-built Linux `chrome` target linked with one
job; `gn gen`, `gn check`, and the patch applicability checker passed.
`native_reload_button_smoke.mjs` used a local HTTP counter to prove native
reload and an eight-second delayed response to prove Stop cancels loading.
The previously passing back/forward, ordinary-page/Prism WebUI, F12, and
side-panel smokes passed after the final build. Reviewed dark, forced-contrast,
and loading-state captures are `docs/evidence/prism-reload-*-linux-20261016.png`.
The forced-color capture keeps the upstream flat background and accessible
icon coloring. Windows, touch and the DevTools reload context menu remain
**unverified**.

## Tab-strip control: new tab

The first tab-strip slice replaces the visible New Tab control with a
`PrismNewTabButton` subclass of Chromium's `NewTabButton`. It owns an original
plus glyph and an inset, rounded surface with a thin rim and distinct idle,
hover, and pressed fills. The component keeps Chromium's 28 px layout, hit
mask, focus ring, pressed callback, new-tab context menu, accessibility name,
tooltip, and Linux middle-click behavior. It also preserves the existing
transparent background when the experimental glass frame service is active.

Select the class only in the ordinary horizontal tab strip on Linux and
Windows. Guard the custom surface by Prism's resolved frame color so custom
themes and forced colors retain Chromium's native painting; keep the original
glyph color resolved by the tab-strip control. The upstream patch changes only
`horizontal_tab_strip_region_view.cc` and `tabs/BUILD.gn`; the component source
lives under `prism/ui/native/`. A native mouse click must create a new tab,
and the existing F12, ordinary-page and Prism WebUI smoke tests must still
pass. Context-menu, middle-click and Windows behavior remain separate gates
until exercised. This is one component of the complete tab overhaul, not its
completion.

### Observed Linux result

Patch `0014` selects `PrismNewTabButton` in the ordinary horizontal strip and
builds its Prism-owned source with the existing tab control target. GN
generation and header checks passed, and the pinned source-built Linux
`chrome` target linked with one job. A real X11 click on the native plus
control created a second browser tab. Ordinary-page/Prism WebUI and F12
smokes passed after the final build; the patch checker found all 14 patches
already applied. Reviewed dark, light, and forced-contrast screenshots are
`docs/evidence/prism-new-tab-*-linux-20261016.png`. The forced-contrast
capture shows the inherited flat background and system-colored icon. The
context menu, Linux middle-click path, touch behavior, and Windows rendering
are still **unverified**.
