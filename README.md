# Prism Browser

Prism Browser is being built from full Chromium for Windows and Linux. A pinned Linux source build and initial browser smoke tests have passed; Windows and live OpenAI behavior remain unverified. [ADR 0002](docs/adr/0002-feature-work-before-browser-build.md) governs isolated feature work before all Phase 0 gates close.

Start with [the Phase 0 plan](docs/phase-0-plan.md) and [the feasibility report](docs/feasibility-report.md). The pinned upstream revisions are in [`chromium.lock.json`](chromium.lock.json); bootstrap scripts place their large checkouts outside this repository.

The [master plan](docs/Master%20prompt%20dla%20Codexa%20%E2%80%94%20AI%20Developer%20Browser.md) defines the product and phase gates.

The [AI tool foundation](docs/design/ai-tool-foundation.md) has typed tool calls, task-scoped permissions and approvals, cancellation, audit entries, and bounded page-context extraction. Chromium adapters implement [four tab operations](docs/design/chromium-tab-tools.md), [page snapshots and search](docs/design/chromium-page-snapshot.md). The [AI session](docs/design/ai-session-service.md) connects these tools to a stateless OpenAI Responses client through explicit permission and approval gates. A [trusted WebUI](docs/design/prism-ai-webui.md) is wired as `chrome://prism-ai`, with optional [OS credential storage](docs/design/credential-store.md) and a [native AI side panel](docs/design/ai-side-panel-shell.md). These sources build on Linux; the WebUI and panel passed smoke tests, while a real AI conversation has not been verified. [Built-in SponsorBlock and ad blocking](docs/design/built-in-media-controls.md) are planned additions.
