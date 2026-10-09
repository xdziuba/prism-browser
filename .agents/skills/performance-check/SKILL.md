---
name: performance-check
description: Measure Prism startup, memory, and AI overhead against the same pinned upstream Chromium revision.
---

# Performance check

Build upstream baseline and product variant with identical GN args and hardware. Record source SHA, compiler, platform, test profile, sample count, median startup time, memory, and variability. Test AI disabled and enabled separately; disabled mode should have no unnecessary persistent AI process. Page context should prefer accessibility tree and incremental visible content; screenshots are on demand. Investigate regressions using traces before altering behavior, then report the measurement and remaining uncertainty.
