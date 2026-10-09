---
name: release-browser
description: Prepare a Prism Windows or Linux browser release after the source, security, compatibility, and performance gates pass.
---

# Browser release

Use only after the Phase 6 gates pass. Build from the pinned Chromium commit and reviewed patch inventory. Archive build configuration, smoke and extension results, security review, startup/memory results, SBOM, package hashes, and signing provenance. Verify updater and release-channel behavior on a clean installation and an upgrade. Do not publish an unsigned or untested package as a stable release. Document any platform-specific limitation and rollback path before distribution.
