# ADR 0002: Implement isolated features before the full browser build

Status: accepted by user, 2026-10-09. Supersedes the Phase 0 gate order in the master plan for development scheduling only.

## Decision

The user chose to stop after a successful shallow Chromium checkout and GN generation because a complete source build is long and resource-intensive. Implement isolated product components now. Defer the full Linux and Windows browser builds, runtime compatibility checks, and release claims until the features are ready for integration.

Every feature still needs a design note, an explicit Chromium integration plan, local checks that do not require the full browser build where practical, and a list of unverified behavior. Do not present host-only checks or uncompiled Chromium glue as proof that Prism works. Do not begin packaging or distribution before the deferred build and smoke gates pass.

## Consequences

The first feature slice is the AI tool permission, audit, and page-context foundation. It contains no browser adapter and makes no network requests. Browser operations, visual UI, extension compatibility, and Windows behavior remain unverified. The full Phase 0 gate matrix remains in `docs/feasibility-report.md` and must be closed before release.
