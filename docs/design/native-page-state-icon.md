# Prism warning icon in the page-state chip

2026-10-29. The page-info chip now has a Prism-owned surface, but its warning
glyph still comes from the generic omnibox vector set. This slice replaces
only the visible warning glyph with an original thin-stroke alert mark.

## Decision

When an ordinary Linux/Windows Prism window is showing the current page icon
at Chromium's `WARNING` security level, supply a Prism-drawn 20-unit
triangle and exclamation mark in the existing resolved security-chip
foreground color. Keep the `DANGEROUS` level and its red icon, all other
levels, editing/search icons, extension/page favicons, custom themes and
forced-contrast palettes on Chromium's current icon path. The selected icon
must not affect the security level, localized label, tooltip, bubble, click,
focus or accessibility semantics. The mark is a symbol, not a claim that the
connection has changed state.

The vector lives in `prism/ui/native/`; the smallest upstream surface is the
existing `LocationBarView::GetLocationIcon()` selection and the same GN source
list. Patch `0012` already owns those files. This follows ADR 0002 while the
independent Windows, Store update and live OpenAI gates remain open.

## Verification plan

Build the pinned Linux browser with `-j1` after GN check. Inspect normal
dark/light and forced-contrast captures, click the actual warning chip to
verify the page-info bubble, and run ordinary-page/WebUI, F12 and Clear all
smokes. Verify a genuinely dangerous certificate or Safe Browsing state and
Windows rendering separately before claiming those paths.

## Linux result

The pinned component build compiled and linked with `autoninja -j1` on
2026-10-29. A pixel comparison against the preceding page-info-chip build
found 89 changed pixels inside the warning glyph in dark mode and 87 in light
mode, confined to screen coordinates `(130, 56)`–`(145, 68)`. The adjacent
localized label did not change. The forced-contrast top bar was pixel-identical
to the preceding build, confirming the fallback path for that capture. A
native X11 click still opened the Chromium page-info bubble, and ordinary
page/WebUI, F12 and omnibox Clear all smoke tests passed on the linked binary.

The captured `data:` page exercised the displayed warning state. A dangerous
certificate or Safe Browsing interstitial, OS-driven contrast, custom themes,
Windows, touch, and screen-reader announcements remain unverified.
