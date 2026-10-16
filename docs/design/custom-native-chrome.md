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
