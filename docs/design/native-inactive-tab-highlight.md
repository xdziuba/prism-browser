# Prism inactive tab highlight

2026-10-27. Ordinary inactive tabs still use Chromium's generic highlight
shape beside Prism's floating active tab. A hover or secondary selection
should make the tab's material legible without making it look active.

## Decision

Extend the Prism-owned tab path helper with a restrained inactive highlight:
two-DIP horizontal and one-DIP vertical inset, 10-DIP top and 8-DIP bottom
corners, clamped to narrow tab bounds. Select it only for the visual
`kHighlight` path of ordinary, ungrouped, unsplit, unpinned Linux/Windows
tabs when Prism's resolved frame palette is active. Give hover and secondary
selection states quiet blue-gray material colors with enough contrast against
the existing inactive text; the upstream hover color otherwise resolves to a
bright system accent that overwhelms the floating active tab. Keep the active
path, Chromium hit path, tab text, separators, selection animation, close
control and drag behavior unchanged. Pinned, grouped, split, closing,
dragged, custom-themed, forced-contrast and other-brand tabs retain their
upstream geometry. No new compositor effect is introduced in this slice.

The upstream changes stay in two already-tracked surfaces:
`horizontal_tab_style_views.cc` for path selection and
`chrome_color_mixers.cc` for colors under the existing Prism palette guard.
The helper stays in the existing Prism-owned path source set, so GN
dependencies do not expand. Update patches `0011` and `0005` and their
rebase-risk entries.

## Verification plan

Build the pinned Linux browser with one job after GN check. Compare inactive
idle, hover and active tabs in dark/light, narrow and forced-contrast windows;
exercise tab selection, New Tab and close. Run ordinary page/WebUI, F12 and
panel smokes. Windows, touch, drag, group/split/vertical and screen-reader
behavior stay unverified until tested.

## Observed on Linux

The first visual pass showed Chromium's bright blue hover fill. With the
guarded Prism recipe, a pixel inside a dark hovered tab resolved to `#31414B`
against the `#1C2932` frame and `#2C3942` active tab; light hover resolved
to `#ECF3F7`. The inactive label contrast is 7.05:1 dark and 6.25:1 light.
The forced-contrast capture retained system colors. The source-built browser
and native tab actions passed; full evidence and limitations are in
`docs/feasibility-report.md`.
