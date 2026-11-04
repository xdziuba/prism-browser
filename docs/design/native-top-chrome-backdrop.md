# Native top chrome: real glass milestone

2026-11-02. Phase 1 continues under ADR 0002. The current Prism toolbar is an
opaque, rounded painter with a blue-gray gradient. It has no backdrop pixels
to blur: the normal web viewport begins below the top container, and the
organizer tray sits beside it. Calling the current painter “liquid glass”
would overstate what it does.

## Decision

Make the next top-chrome UI milestone a composited, translucent toolbar over
a browser-owned backdrop. Keep page content in its normal viewport; do not
extend the toolbar over arbitrary web pages or copy page screenshots into
browser chrome. Those approaches could hide controls or page text and would
add a capture path to every navigation. The backdrop must instead live in the
same window behind the native toolbar, with the current tab/frame colors and
light variation as its source. A separate Prism toolbar layer may then sample
that backdrop through Chromium's `ui::Layer` background blur. The visible
material needs a translucent base, a restrained specular rim, and a thin
boundary; a strong blue vertical gradient is not the material.

The first implementation slice is a *geometry and compositor proof*: put a
controlled high-frequency pattern behind a bounded toolbar glass layer in an
isolated browser run and show that its pixels actually diffuse inside the
capsule while pixels outside do not. Do not ship the pattern. If the Linux
software compositor cannot provide that effect, retain the opaque Prism
surface there and test a supported composited path before shipping any claim
of blur. Once proven, replace the test pattern with a quiet native backdrop
that responds to active/inactive window state. Keep one blur layer for the
toolbar and avoid nested blur on its buttons or address field.

## Required behavior and evidence

- Preserve toolbar control bounds, hit regions, menus, focus order, tab
  movement, F12/DevTools, and page viewport geometry.
- Apply blur only to ordinary Prism dark/light windows with compositor
  support. Forced colors, increased contrast, reduced transparency, custom
  themes, and unsupported Linux compositors use a solid fallback.
- Capture dark, light, narrow, inactive, and forced-contrast windows, plus a
  controlled before/after blur comparison. A screenshot that merely looks
  translucent is insufficient evidence that backdrop sampling works.
- Check text/icon contrast over the lightest and darkest sampled backdrops,
  keyboard focus, pointer clicks, native navigation, and browser/WebUI pages.
- Record any upstream layout or layer change as a separate narrow patch with
  rebase risk. Windows remains unverified until a Windows build and visual
  smoke pass.

This milestone is still within Phase 1, independent of Phase 2 AI read-mode
features. It will be called complete only after the source-built browser
visibly samples and blurs its native backdrop in a real runtime test.
