---
name: chromium-ui
description: Implement Prism browser chrome and WebUI after Phase 0, with small upstream patches and accessible glass surfaces.
---

# Chromium UI

Use only after the Phase 0 gate in `docs/feasibility-report.md` passes. Write a design note with tokens and the smallest Chromium patch surface first. Translucency belongs to browser chrome, never web content. Verify text contrast, keyboard focus, reduced transparency, Linux fallback when backdrop blur is absent, and responsiveness. Keep standard DevTools intact. Record each upstream file and rebase risk in `docs/upstream-patches.md`; build and run browser smoke tests on the changed platforms.
