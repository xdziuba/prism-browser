# Prism native page-info chip

2026-10-27. The leading page-state chip in the Prism address field still uses
Chromium's generic pill while the surrounding controls use Prism-owned shapes.
It conveys security state, so its meaning and warning colors must stay intact.

## Decision

Use a `PrismLocationIconView` subclass for ordinary Linux/Windows browser
windows. Chromium continues to supply the security level, icon, localized
label, tooltip, click and drag actions, bubble, ink drop, focus behavior and
accessibility properties. Prism owns the visible nine-DIP corner shape and
quiet boundary and upper light line for a labeled, ordinary chip. Its own
painter supplies an opaque cool fill without changing other omnibox chips. Do not
draw Prism effects over dangerous-state backgrounds, a hidden background,
custom themes, or increased/forced contrast. Editing and popup states retain
Chromium's behavior and do not show the Prism rim.

The upstream delta is limited to the existing location-bar construction and
GN source list. The subclass and painting live under `prism/ui/native/`; no
security decision or command handler is replaced. The normal chip text must
remain at least 4.5:1 against its fill in dark and light modes. This follows
ADR 0002: the remaining Phase 0 gates stay open.

## Verification plan

Build the pinned Linux `chrome` target with one job after GN check. Inspect
dark, light, narrow and forced-contrast captures, then click the actual
page-info chip to confirm Chromium's bubble opens. Run ordinary-page/WebUI,
F12 and representative native toolbar tests. Windows, touch, real HTTPS
security transitions and screen-reader announcements remain unverified until
those environments are exercised.

## Observed on Linux

GN generated 36,683 targets and the location-bar header check passed. The
first single-job compile caught an outdated `BrowserWindowInterface` method;
using its `GetType()` fixed construction, and the final Linux `chrome` link
passed. A final revision moved the fill into the chip's own painter; its
source rebuilt and the browser relinked. A real X11 click on the labeled chip opened Chromium's page-info
bubble. Reviewed dark, light, forced-contrast and 500-pixel captures show the
Prism rim only in the normal palette and a readable narrow label. Screenshot
pixel samples measured 7.54:1 dark and 14.34:1 light contrast for the chip's
text against its solid fill. Ordinary-page/WebUI, F12, omnibox Clear all and
native navigation smokes passed again on that binary on 2026-10-29.

The earlier Clear all patch hunks and this control were consolidated into one
per-file location-bar patch so patch replay remains idempotent. Windows,
touch, real HTTPS state changes and screen-reader announcements remain open.
