---
name: extension-compat
description: Verify extension installation, persistence, updates, APIs, and Chrome Web Store behavior in Prism builds.
---

# Extension compatibility

Test the built pinned browser, not the system browser. Start with `tests/fixtures/persistence-extension`: load unpacked, save a probe value, restart the same profile, and compare the value. Then select public extensions with distinct permissions. Record listing URL, ID, version, install route, behavior exercised, restart result, and update observation. Test actual Chrome Web Store installation separately from unpacked extension support. Preserve existing extension APIs unless a documented product requirement forces a change. Enter evidence in `docs/feasibility-report.md` during Phase 0.
