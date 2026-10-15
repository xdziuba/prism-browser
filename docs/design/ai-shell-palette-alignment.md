# Prism AI shell palette alignment

2026-10-15. Phase 1 WebUI refinement under ADR 0002. The AI settings and
command palette already work in the Linux browser. Their original warm paper
and copper palette now conflicts with the cool native Prism frame and the
original cyan Prism mark.

## Decision

Use the existing native shell's blue-gray family in `chrome://prism-ai/` and
its side-panel variant. Light content keeps a pale blue-gray paper with a
nearly white solid card; dark content uses a deep blue-gray paper with a
lighter opaque card. Cyan appears only on the primary action, focus, and small
section labels. Error and approval states retain their own semantic colors.
Replace the temporary diamond character in the header with the original Prism
mark's exact SVG geometry; adjacent text supplies its accessible name.

Keep the topbar as the only translucent WebUI surface. Text, forms, cards,
dialog, and side-panel content stay opaque. `prefers-reduced-transparency`
and browsers without `backdrop-filter` retain the existing solid fallback.
Do not add movement, gradient wallpaper, or blurred page content. This is a
Prism-owned resource change with no upstream Chromium patch.

Contrast targets before implementation: primary and muted text at least
4.5:1 on their page or card surface, accent button text at least 4.5:1, and
visible form boundaries at least 3:1. Preserve the current keyboard, narrow
layout, settings storage, command palette, and AI permission behavior. Build
the linked browser with one job, review light/dark captures, and run the
settings, command-palette, native-panel, ordinary-page, and F12 smoke tests.

## Linux result

The single-job incremental `chrome` build passed with one C++ object and one
link action. Settings, command palette, native side panel, ordinary-page/WebUI,
and F12 smoke tests passed on isolated X11 display `:101`. The settings smoke
confirmed model persistence, no key in localStorage, and no horizontal overflow
at 420 px. The command palette smoke confirmed focus, filtering, Escape,
keyboard selection, and Stop behavior. Light, narrow dark, and dark command
palette screenshots are in `docs/evidence/` and were reviewed visually.

Calculated card-surface contrast ratios: primary text 13.0:1 light and
11.08:1 dark; muted text 5.68:1 light and 7.25:1 dark; primary button text
6.0:1 light and 9.22:1 dark; form/card boundaries 3.15:1 light and 4.16:1
dark. Windows, OS-driven high contrast, and reduced-transparency rendering
remain to be checked on their platforms.
