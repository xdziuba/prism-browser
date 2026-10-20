# Prism native toolbar overflow control

2026-10-20. The toolbar now has Prism navigation, utility buttons and a
shared navigation rail. Chromium's responsive overflow control is still its
stock chevron when actions no longer fit.

## Decision

Subclass `OverflowButton` under `prism/ui/native/` for the ordinary
Linux/Windows Views toolbar. Use an original two-chevron vector pointing
toward the logical trailing side and the shared inset Prism control surface.
Keep the existing button size, menu controller, tooltip, accessible popup
semantics, focus ring, overflow decision and menu model. Mirror the glyph in
RTL. The visual surface uses the same resolved Prism toolbar palette guard as
the other utility controls; forced contrast and custom themes keep native
background behavior. This component is dormant until Chromium's layout
actually overflows.

The upstream delta is a guarded class selection in the already-patched
`toolbar_view.cc` and two source entries in the existing toolbar GN target.
No overflow model, extension action, command or responsive priority changes.

## Verification

The pinned Linux browser relinked in 34.84 seconds with three single-job
steps after `gn gen` (36,683 targets) and toolbar `gn check` passed. At a
500 px native window, the control appeared at the trailing toolbar edge in
dark and light palettes. A native XTest click opened Chromium's actual
overflow menu with Forward, Home and Profile entries; Escape dismissed it.
The forced-contrast capture retains the glyph and native flat background.
`browser_smoke.py`, F12, side-panel and native Back/Forward smoke tests passed
on the final binary. The 19-patch checker reports the patch already applied.

The menu rows still use Chromium's presentation. Windows, touch, RTL,
keyboard focus traversal, assistive announcement, custom themes and menu-row
restyling remain unverified.
