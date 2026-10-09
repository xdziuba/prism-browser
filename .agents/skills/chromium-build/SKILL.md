---
name: chromium-build
description: Reproduce and verify Prism Browser builds from its pinned full Chromium source on Linux or Windows.
---

# Chromium build

Read `chromium.lock.json` and `docs/phase-0-plan.md`. Run `scripts/phase0/preflight.py`, then the platform bootstrap script with an external work directory. Confirm `git -C <workdir>/chromium/src rev-parse HEAD` matches the lock before building. Follow the pinned source's platform build instructions for dependencies, then use GN and `autoninja` to build `chrome`. Capture OS, compiler, GN args, source/tool hashes, duration, binary version, and failures in `docs/feasibility-report.md`. A packaged Chromium binary never counts as build evidence. Do not silently change the lock or discard a dirty checkout.
