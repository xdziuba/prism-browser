# Prism tab audio indicator

2026-10-29. The floating Prism tab and its close button are custom Views,
while the audible/muted status remains a stock vector and button surface.

## Decision

For ordinary Linux/Windows browser windows, construct a Prism subclass of
Chromium's `AlertIndicatorButton`. It owns original speaker and muted-speaker
vectors and an opaque, inset hover/press surface only for the two audio states.
The icon uses Chromium's existing alert color ID, image width, and state
transition. The button keeps Chromium's alert lifecycle, fade, hit-test,
mute permission, event dispatch, metrics, accessibility name and tooltip
delegation. All capture, recording, device, PiP and agent indicators use the
base class's existing image path. Custom themes and forced contrast keep the
stock button surface, with the audio icon resolved in the system color.

The pinned Chromium disables click-to-mute by default through
`media::kEnableTabMuting`; this slice does not turn it on. A dedicated smoke
will enable that upstream feature flag only in a disposable browser to verify
the native click path, then check ordinary/default behavior separately.

Select the subclass in the existing `Tab` construction. The existing
`AlertIndicatorButton::UpdateIconForAlertState` implementation selects the
Prism audio vectors under the same resolved palette guard. This avoids a
virtual method on Chromium's public button header, which caused an 857-action
rebuild in the first attempt; that attempt was stopped without a compiler
failure. The final patch surface is `tab.cc`, `alert_indicator_button.cc`,
their two existing GN targets, and no public Chromium header. Patch `0015`
already owns `tab.cc` and its GN file, so consolidate the new changes there.
This is one visual control, not a change to Chromium audio capture or tab
security. It follows ADR 0002 while Phase 0's Windows, Store update and live
OpenAI gates remain open.

## Verification plan

Run GN generation/check and a single-job pinned Linux browser build. In an
isolated X11 profile, start a local Web Audio oscillator from a user gesture,
inspect the audible and muted glyphs in dark/light and forced contrast,
verify a native click toggles the tab mute state with the feature flag, and
run ordinary-page/WebUI and F12 smokes. Record Windows, touch, inactive/narrow
tabs and screen-reader behavior as open until tested.

## Result

The single-job Linux browser build and dark, light, forced-contrast, and
default-policy X11 captures passed. With `EnableTabMuting` enabled in a
disposable test profile, the native click changed the audible glyph to the
muted glyph. Without the flag, the same click left it audible. The ordinary
page, Prism WebUI, F12, and existing native tab-close smokes passed after the
final link. The test records screenshots for visual review; it does not query
tab mute state through a browser API. Full evidence and remaining platform
gates are in `docs/feasibility-report.md`.
