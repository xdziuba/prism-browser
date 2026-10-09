# ADR 0001: External Chromium checkout and pinned baseline

Status: accepted for Phase 0, 2026-10-09.

## Decision

Keep the Prism product repository small. Pin a full upstream Chromium commit and a `depot_tools` commit in `chromium.lock.json`. Bootstrap the source and tool checkout in a user-selected directory outside this repository. Do not vendor the Chromium tree or use a system Chromium binary as build evidence.

Phase 0 can begin with an unmodified Chromium build. Any later product delta must be represented as a reviewable patch, with the touched upstream files and rebase risk listed in `docs/upstream-patches.md`. Prefer isolated components, browser services, WebUI, and a DevTools component extension in later phases.

## Consequences

Build evidence must record the exact source SHA, tool SHA, GN args, OS, and smoke-test results. A separate Windows x64 host is required to prove that platform. The source checkout is large and dependency sync can take substantial time and disk space. Source revision updates require an explicit ADR or report entry and renewed feasibility tests.
