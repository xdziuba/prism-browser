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

## Tab close affordance

Add a Prism-owned `PrismTabCloseButton` subclass for the ordinary Linux and
Windows tab strip. It retains Chromium's press callback, enlarged hit target,
middle-click forwarding, touch handling, close confirmation behavior, focus
ring and accessible name. The subclass supplies an original thin-stroke cross
and a restrained rounded hover/press surface that is clipped inside the
existing close button bounds. The idle state remains visually quiet. Read
foreground color from `TabCloseButton::GetColors()` to retain selected,
inactive and forced-contrast legibility; only paint the custom hover surface
when the resolved frame has a Prism token. Keep Chromium's native background
for other themes and the platform high-contrast palette.

The current `TabCloseButton::UpdateIcon()` is nonvirtual while `SetColors()`
calls it whenever tab state changes. Make that one existing method virtual,
then override it in the Prism subclass; otherwise an active-tab transition
would silently restore Chromium's icon. Select the subclass in `tab.cc` and
compile its source in the existing `tabs:tab_impl` target on Linux/Windows.
This is a bounded three-file upstream patch plus Prism-owned source. Verify a
real native close click with two tabs, ordinary navigation, F12, and forced
contrast before claiming the component works. Pinned, grouped, split, touch,
and Windows cases remain unverified until exercised.

### Observed Linux result

Patch `0015` introduces the narrow virtual icon update hook, selects the
Prism subclass only for ordinary Linux/Windows browser tabs, and compiles
the Prism-owned source with `tabs:tab_impl`. GN generation and header checks
passed. The first compile identified a missing Views metadata declaration;
after adding it, the source-built Linux browser linked successfully. A final
single-job incremental relink also passed after the ordinary-window guard.
The native X11 smoke clicked the first close control with two tabs open and
confirmed that only the second tab remained. The previous native New Tab
test, ordinary-page/Prism WebUI, F12, and patch checks passed on the final
binary. Reviewed dark idle/hover, light multi-tab, and forced-contrast
captures are `docs/evidence/prism-tab-close-*-linux-20261016.png`. The
middle-click forwarding path, touch interactions, special tab layouts, and
Windows behavior remain **unverified**.

## Toolbar menu control

Use a `PrismBrowserAppMenuButton` subclass for the ordinary Views toolbar on
Linux/Windows. It provides an original three-stroke menu glyph and the shared
Prism navigation surface while keeping Chromium's menu model, severity
notifications, badges, accessibility, focus, keyboard access, labels,
animation, and command tracking. When Chromium expands the menu into a
status chip, leave its icon and background native so urgency colors remain
clear. Only the compact menu control uses the Prism glyph and capsule.
The surface painter already falls back to Chromium for forced colors and
non-Prism themes. Select the subclass in `toolbar_view.cc` and compile it in
the same toolbar target; both files are already in patch `0013`. Verify a
real menu click, visual light/dark/forced-contrast states, and ordinary
navigation/F12 after a Linux build. Menu behavior in special windows,
severity chips, touch, and Windows remains unverified until exercised.

### Observed Linux result

The Prism three-stroke glyph and inset capsule appear on the compact menu
control in dark and light ordinary windows. Forced contrast retains Chromium's
flat surface and uses its resolved foreground color. The source-built browser
opened the native app menu from a real X11 click, closed it with Escape, and
navigated to `chrome://settings/` from its Settings item. Patch `0013` remains
limited to the existing toolbar construction and build files. The menu rows
themselves still use Chromium's styling and product strings; their redesign
is a separate slice. Expanded severity chips, touch, and Windows rendering
remain unverified.

## Profile control

Use a `PrismAvatarToolbarButton` subclass for the ordinary Linux/Windows
toolbar. Keep Chromium's profile image, avatar ring, sign-in and guest states,
profile switcher, menu callbacks, labels, accessibility, and focus behavior.
Only the compact button gets Prism's shared inset surface; an expanded
identity or warning chip remains native so its text and status colors are
clear. The shared painter already declines non-Prism and forced-contrast
palettes. Select it in the existing toolbar construction point and add the
Prism-owned source to the toolbar target, keeping the patch surface in `0013`.
Verify an actual profile-button click and menu dismissal on Linux, plus
dark/light/forced visual captures, ordinary navigation and F12. Signed-in,
guest, multiple-profile, touch and Windows cases remain unverified.

### Observed Linux result

The compact profile control has the Prism inset surface in dark and light
ordinary windows; the avatar image and its foreground remain controlled by
Chromium. Forced contrast retains the flat native surface. A real X11 click
opened the profile bubble and Escape dismissed it, with the browser's page
unchanged. The bubble still uses Chromium's design and product strings.
Signed-in, guest, multiple-profile, expanded chip, touch, and Windows
behavior remain unverified.

## Optional Home control

When the user enables Home in toolbar settings, construct a
`PrismHomeButton` subclass with an original roof-and-door outline and the
same inset Prism surface used by navigation. Keep Chromium's home command,
middle-click, drag-to-set-home, undo bubble, context menu, accessible name,
tooltip and focus handling. Use the existing toolbar target and construction
patch `0013`; leave other platforms and WebUI-toolbar modes untouched.
Verify a real click on a temporary profile with Home enabled, plus visual
dark/light/forced states and ordinary page/DevTools smoke. Middle-click,
drag-and-drop, touch, custom home URLs, and Windows stay unverified.

### Observed Linux result

The optional Home control shows the Prism roof-and-door glyph and inset
surface when enabled in a temporary profile. A real X11 click navigated an
ordinary tab to `chrome://new-tab-page/`. Light and dark captures retain
the toolbar's control language; forced contrast falls back to a flat native
button with a legible icon. Middle-click, drag-to-set-home, custom home URL,
touch, and Windows behavior remain unverified.

## Bookmark page action

The omnibox bookmark star is a visible page action, and its controller already
chooses separate vector icons for unsaved and saved pages. Keep that controller
and the PageActionView command, bubble, tooltip, accessible name, accent-color
selection, and visibility logic intact. Supply original Prism outline and
filled 20-unit star paths from `prism/ui/native/`; change only the icon
selection in `bookmark_page_action_controller.cc` on Linux/Windows
builds. Declare the Prism header in the existing bookmarks GN target. The
view's foreground/accent colors continue to resolve from Chromium, including
forced contrast. Test actual click on a local page, persisted bookmark URL,
and dark/light/forced visuals. Bookmark editing, drag, animation, and Windows
remain unverified until exercised.

The Linux build, native click and persistence smoke, and dark/light/forced
captures passed. The saved state uses the filled icon and retains Chromium's
bookmark bubble. The outline state is visible in all three captures; its
interaction and color fallback remain Chromium-owned.

## Tab search control

The leftmost horizontal tab-strip control currently uses a generic chevron.
Use a Prism-owned `TabStripFlatEdgeButton` subclass with a compact original
tabs-and-search vector and an inset frame surface. Retain Chromium's action
relationship, tab-search bubble, tooltip, accessibility text, pin context
menu, visibility animation, focus, and hit target. Keep vertical tab-strip
combo controls on their existing implementation until that layout is redesigned
as a whole. Make `UpdateIcon` virtual in the upstream base so action and theme
updates keep the Prism vector; select the subclass only for the horizontal
tab-search element. Paint the Prism surface only when the resolved frame colors
match the Prism palette and the native glass service does not own that window;
forced colors and other themes use the existing background and color IDs.

Verify a real X11 click opens tab search, Escape closes it, and ordinary-page,
WebUI and F12 behavior still pass. Inspect dark, light, forced contrast, and a
narrow window. Pin-menu semantics, vertical tab strip, touch, Windows, and real
backdrop blur require separate verification.

The Linux result passed GN generation/check, the single-job browser build,
native open/Escape smoke, and dark/light/forced/narrow captures. The control
keeps a recognizable icon in forced contrast while its custom surface falls
back to the platform color. The tab-search bubble still uses Chromium's
presentation; pin-menu, keyboard focus traversal, vertical layout, touch,
Windows, and compositor blur remain open.

## Omnibox clear control

The editable omnibox and its trailing actions remain Chromium-owned. Upstream
only exposes Clear all when the virtual keyboard is visible. In Prism's
ordinary Linux/Windows desktop browser, expose it whenever there is in-progress
nonempty input, using an original Prism crossed-stroke glyph in the existing
image button. Keep Chromium's `SetUserText` callback, tooltip, layout insets,
disabled color, keyboard focus,
and touch-specific backspace icon. The glyph is a vector path in
`prism/ui/native/`, selected only for the non-touch branch. This keeps the
change to one existing refresh point and avoids disturbing security chips,
editing, text direction, and page actions. The visual test should include a
typed omnibox, click-to-clear, keyboard focus, narrow layout, and forced
contrast; Windows and touch remain separately unverified until exercised.

### Observed Linux result

The source-built Linux browser now shows Clear all for nonempty in-progress
input. A real X11 click on the Prism glyph cleared the typed text; pressing
Enter afterward kept the original page. The same smoke passed in dark, light,
forced contrast, and 700 px windows. The icon uses Chromium's resolved icon
color in forced contrast and remains inside the omnibox at 700 px. Keyboard
focus order, touch, RTL, Windows, and screen-reader announcement remain
unverified for the larger navigation-layout slice.

## Omnibox clear surface

The clear action now has a Prism glyph but still uses Chromium's generic
`ImageButton` surface. Give it a Prism-owned `ImageButton` subclass with a
compact rounded hover and pressed surface, a one-pixel rim, and immediate
state feedback. Leave its idle surface transparent so the editable text has
the visual priority and the narrow omnibox retains space. Select the subclass
only for the existing Linux/Windows clear action, with the same callback,
tooltip, focus ring, icon color mapping, button insets, and touch backspace
mode. The painter uses the resolved Prism toolbar tokens and falls back to
Chromium's background for other themes and touch UI. In forced contrast, it
draws a thin hover outline in the resolved icon color. The generic ink drop
is disabled for this subclass because its forced-contrast hover overlay
covered the clear glyph in an X11 visual check.

This follows the Apple Design skill's immediate-feedback and spatial-
consistency principles and the local liquid-glass skill's fill/rim anatomy.
There is no animation or compositor blur on this compact control. The source
lives under `prism/ui/native/`; the upstream delta is limited to the existing
location-bar construction and GN target. Verify the real native click and
hover visual in dark/light, forced-contrast fallback, 700 px layout, ordinary
page and Prism WebUI, and F12. Keyboard focus order, Windows, touch and RTL
remain separate gates until exercised.

### Observed Linux result

`PrismOmniboxClearButton` now paints the hover and pressed surface inside the
existing clear action without changing its bounds or callback. The first
forced-contrast hover capture exposed an ink-drop overlay that hid the glyph;
the final version disables that overlay and draws a system-colored outline.
Reviewed dark, light, forced-contrast, and 700 px captures show the glyph and
hover state inside the address bar. Real X11 click-to-clear and subsequent
Enter passed in all four modes. The ordinary page, Prism WebUI, and F12 also
passed on the final Linux binary. Windows, touch, RTL and focus traversal were
unverified at that point.

### Keyboard traversal check

The source-built Linux browser keeps Chromium's omnibox suggestion behavior:
while the suggestion popup is open, Tab cycles its choices and does not move
focus to the Clear all button. Escape closes the popup without discarding the
typed input. The first Tab then focuses the AI Mode chip, and the second Tab
focuses Clear all with a visible ring. Space activates that button and clears
the input; Enter afterward keeps the original page. The native X11 sequence
passed in dark, light, forced-contrast, and 700 px modes. Reviewed dark and
forced-contrast captures show the ring on Clear all. This verifies one
keyboard route on Linux; screen-reader announcement, Shift+Tab traversal,
touch, RTL, and Windows remain open.
