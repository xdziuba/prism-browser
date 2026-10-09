---
name: chromium-upstream-sync
description: Update Prism's Chromium baseline while tracking patch conflicts and preserving product behavior.
---

# Upstream sync

Before changing `chromium.lock.json`, inventory `docs/upstream-patches.md` and record the old and proposed SHAs. Use an isolated checkout. Reapply each product patch explicitly; for every conflict record affected files, resolution, and behavior tests in an ADR or sync report. Never make a conflict disappear by deleting product behavior. Update the pin only after Linux and Windows builds and relevant extension/browser smoke tests pass, or keep the gate open with a clear failure report. Compare performance against the prior pinned revision using the same build configuration.
