# Native browser branding, first string slice

2026-10-14. Phase 1 product shell under ADR 0002. The pinned Linux browser
already builds and has a guarded native color palette. Windows remains a Phase 0
gate.

## Decision

Use **Prism Browser** as the visible application name and **Prism** where a
short name is needed. Keep the initial upstream surface to the unbranded
Chromium string table. Change the product and short product names, ordinary
window-title suffix, app accessible name, and first-run dialog title. Preserve
the separate Chrome for Testing branch and Chromium's attribution and version
information. Do not rename the executable, profile directory, desktop entry,
installer, or icon in this slice; those need coordinated cross-platform assets
and packaging checks. Do not claim a complete rebrand from these strings.

The localized window-title suffix will use the Prism name even when a locale
has not supplied a Prism translation. The page title placeholder remains
untouched. The product name and accessible name are nontranslatable names.

## Verification

Regenerate resources and relink the pinned Linux `chrome` target at `-j1`.
Launch in a disposable profile and inspect the native window title through
X11 where the display server exposes it, the visible application name in
`chrome://version`, and the app menu's accessible name where automation exposes
it. Run ordinary-page, Prism WebUI, F12, and native-component smoke after the
string change. Record the exact observations and unverified Windows behavior
in the feasibility report.
