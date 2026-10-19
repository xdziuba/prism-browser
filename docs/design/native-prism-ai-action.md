# Native Prism AI action icon

2026-10-19. The Prism AI side-panel action is registered and works on the
pinned Linux browser, but its `ChatSpark` icon is Chromium's generic artwork.
The browser chrome should identify this first-party feature with Prism's own
mark when users pin the action to the toolbar or find it in the side-panel
menu.

## Decision

Use a 20-unit monochrome vector derived from the original Prism triangle:
an outer triangular outline and a smaller inner facet. Keep the action
label, tooltip, side-panel callback, pinnable state, accessible name, focus
ring, badge behavior, and color ID unchanged. The icon follows
`ui::kColorIcon`, so dark, light, and forced-contrast themes choose its color.
No tint, blur, or decorative background is added to the compact action. The
existing Prism mark used by the AI WebUI remains the visual reference.

The path lives in `prism/ui/native/prism_ai_action_icon.h`. A guarded source
entry in `chrome/browser/ui/BUILD.gn` and one icon selection in
`chrome/browser/ui/browser_actions.cc` extend existing patch `0003`. This
avoids changes to the side-panel implementation and to Chromium's generic
pinned-toolbar control. Check the pinned action and panel opening in the
source-built Linux browser, inspect dark/light/forced colors, and rerun the
standard WebUI and F12 smoke checks. Windows visual behavior remains
unverified until tested.
