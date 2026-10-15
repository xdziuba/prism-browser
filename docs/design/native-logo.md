# Native Prism logo, first resource slice

2026-10-14. Phase 1 product shell under ADR 0002.

## Decision

Create an original Prism mark as a simple faceted triangular aperture inside a
dark rounded square. Its geometry must remain legible at 16 px, with no blur,
gloss, simulated refraction, animation, or dependence on a gradient. Use the
same silhouette for dark and light browser UI. Keep the mark separate from the
larger liquid-glass shell: the icon identifies the app and should stay stable
when a user changes the shell theme.

Store the SVG master and generated PNG sizes in this repository. Stage only
Prism-owned icon files into the pinned Chromium checkout, then change the
ordinary unbranded Linux/Windows GRIT logo resource paths. Gate the GRIT
paths with a Prism-specific build define so Chrome for Testing retains its
upstream art. This slice covers resource-pack icons used by the browser and
WebUI. Executable, installer, desktop-entry, and Windows shell icons require
separate packaging work and must not be claimed as replaced here.

## Version-page identity follow-up

The first resource slice does not own `chrome://version` art: its logo and
favicon come from `components/resources/version_ui_scaled_resources.grdp`.
Add a compact Prism wordmark and matching 16 px favicon to that resource set,
in normal and white text variants. Reuse the original mark without visual
effects. Put the generated 1×/2×/3× assets under the Prism-owned overlay and
gate the GRIT paths with the same ordinary-build condition. Keep the page's
technical Chromium version and attribution visible. Verify the rendered page
in light and dark modes after the resource build.

## Verification

Check the source SVG and PNG dimensions/alpha at 16, 32, 64, 128, and 256 px.
After staging and applying the narrow GRIT patch, build `chrome` at `-j1` on
the pinned Linux checkout. Inspect the 16 px browser icon and an internal
WebUI logo in an isolated profile. Run ordinary-page, Prism WebUI, F12, and
native-component smoke. Record incomplete platform surfaces explicitly.
