# Phase 1 command palette foundation

Status: implemented and smoke-tested on the pinned Linux browser,
2026-10-10. This is a browser-owned WebUI slice under ADR 0002 while Windows
and the live OpenAI gate remain open.

The first palette lives only in `chrome://prism-ai/`. A visible Commands button
opens a native modal dialog. The command list is static and typed in the page:
open Assistant, open AI settings, and Stop agent when a session is active.
Filtering never interprets page content or model output as a command. Search
is case-insensitive and bounded by the input's maximum length. The dialog
returns focus to its opener, Escape closes it, and arrow keys move between
visible commands. Command execution uses the same existing UI functions and
`prismStop` message as the normal controls.

The palette uses the shared light/dark tokens, opaque text, visible focus, and
the same 420-pixel responsive constraint as settings. The browser's global
shortcut and native toolbar entry are separate future integration work; this
slice does not take over Chromium shortcuts or add upstream patches.

The pinned Linux browser relinked after one Prism WebUI object rebuild.
`scripts/phase0/command_palette_smoke.mjs` passed in an isolated persistent
profile: opening, filtering, arrow selection, Escape and focus return,
navigation, disabled Stop before a session, enabled Stop during a session,
and the Stop action ending it. The session used a deliberately fake key and
sent no API request. The 420-pixel dark screenshot is in `docs/evidence/`.
The settings and ordinary WebUI smoke tests still pass. Windows and live AI
behavior remain unverified.
