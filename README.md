# Prism Browser

Prism Browser is being built from full Chromium for Windows and Linux. It does not yet contain a browser binary. Per [ADR 0002](docs/adr/0002-feature-work-before-browser-build.md), features are being developed before the full browser build; their browser behavior remains unverified.

Start with [the Phase 0 plan](docs/phase-0-plan.md) and [the feasibility report](docs/feasibility-report.md). The pinned upstream revisions are in [`chromium.lock.json`](chromium.lock.json); bootstrap scripts place their large checkouts outside this repository.

The [master plan](docs/Master%20prompt%20dla%20Codexa%20%E2%80%94%20AI%20Developer%20Browser.md) defines the product and phase gates.

The [AI tool foundation](docs/design/ai-tool-foundation.md) has typed tool calls, task-scoped permissions and approvals, cancellation, audit entries, and bounded page-context extraction. Chromium adapters implement [four tab operations](docs/design/chromium-tab-tools.md), [page snapshots and search](docs/design/chromium-page-snapshot.md). The [AI session](docs/design/ai-session-service.md) connects these tools to a stateless OpenAI Responses client through explicit permission and approval gates. A [trusted WebUI](docs/design/prism-ai-webui.md) is wired as `chrome://prism-ai`, with optional [OS credential storage](docs/design/credential-store.md). These sources are included in GN but have no compiled runtime verification yet.
