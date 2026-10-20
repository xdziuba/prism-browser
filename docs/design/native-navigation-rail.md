# Prism native navigation rail

2026-10-20. Back, Forward and Reload/Stop already have Prism glyphs and
individual capsules. Their shared place in the toolbar should read as one
navigation control while retaining three independent actions.

## Decision

Paint a Prism-owned rounded rail behind the existing native buttons in normal
Linux and Windows toolbars. Use the resolved Prism toolbar palette as the
guard, with an opaque dark `#31444E` or light `#E9F2F6` fill and a thin edge.
Back, Forward and Reload/Stop retain their original bounds, callbacks,
history/reload menus, accessible names, focus rings and tab order. Their
individual idle capsules become transparent within the rail; hover and press
continue to identify the single target. Home, profile and menu retain their
standalone surfaces. A hidden Forward button must not leave an empty slot.

The rail follows the actual child bounds after Chromium's flex layout, so it
also follows RTL order and a narrow toolbar. It paints no web content and
does not intercept input. Custom themes and increased/forced contrast retain
the existing native backgrounds. Linux uses solid colors; compositor blur is
not part of this change.

The upstream delta stays in the existing toolbar construction/build patch:
one background selection and four source entries. The Prism background
subclasses Chromium's corner-aware toolbar background, so other frame
behavior stays intact. Painting and token choices live under
`prism/ui/native/`. This is a bounded navigation-layout slice, not completion
of the toolbar or tab-strip replacement.

## Verification

Relink the pinned Linux browser with `-j1`. Check GN, patch replay, and native
Back/Forward/Reload/Stop behavior. Inspect dark, light, forced contrast,
hidden-Forward and narrow-window captures; verify the full WebUI, ordinary
page, F12 and Prism side panel. Windows, touch and true backdrop blur remain
open until tested.

## Linux result

GN generated 36,683 targets and its toolbar header check passed. The first
implementation would have touched the public `ToolbarView` header and caused
thousands of dependent recompiles; it was interrupted before completion.
Moving the paint into a Prism-owned subclass of the existing toolbar
background kept the final incremental build to ten steps. The first compile
of that version caught a private Back getter; explicit button registration
removed the dependency. The final pinned `chrome` link passed in 51.30
seconds with one job. All 19 patches remained idempotent.

On isolated X11, actual Back, Forward and Alt+Left navigation passed, and
Reload and Stop changed/cancelled a slow local request. Reviewed dark, light,
forced-contrast, 700-pixel, hidden-Forward and hover captures are
`docs/evidence/prism-navigation-rail-*-linux-20261020.png`. The rail followed
the visible child bounds, and the forced-contrast palette stayed native. The
first hidden-Forward single-tab capture briefly lacked tab text at four
seconds; a ten-second capture displayed it normally, so the retained evidence
uses that settled frame. Ordinary-page/Prism WebUI, F12 and side-panel smokes
passed on the final binary. Windows, touch and compositor blur remain open.
