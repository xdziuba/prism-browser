You are the lead engineer responsible for building a cross-platform developer-focused Chromium browser for Windows and Linux.

The product must be based on full open-source Chromium, not Electron, CEF or Qt WebEngine.

The primary product requirements are:

1. Preserve Chromium compatibility.
   - Standard Chromium rendering.
   - Standard Chromium DevTools available through F12.
   - Chrome Extensions support.
   - Chrome Web Store compatibility must be explicitly verified rather than assumed.
   - Existing extension APIs should remain untouched unless there is a documented reason.

2. Keep the Chromium delta as small as possible.
   - Prefer isolated components and services.
   - Avoid broad modifications across upstream Chromium.
   - Prefer component extensions, WebUI and self-contained browser services over modifications of upstream DevTools.
   - Every modification to an upstream Chromium file must be documented as a patch with its purpose and rebase risk.

3. Create a modern coherent glassmorphism UI.
   - Browser chrome may use translucent/glass surfaces.
   - Web content itself must not be affected.
   - Accessibility, contrast and reduced-transparency modes are mandatory.
   - Provide graceful Linux fallbacks when native backdrop blur is unavailable.
   - The UI must remain lightweight and responsive.

4. Implement native OpenAI integration.

Create an AI architecture consisting conceptually of:

OpenAIClient
AiSessionService
BrowserToolBroker
BrowserPermissionBroker
PageContextExtractor
AiSidePanel
AiActionAuditLog
CredentialStore

Use the OpenAI Responses API.

The user's API key must never be persisted in plaintext.

Use OS credential storage:
- Windows secure credential APIs / DPAPI.
- Linux Secret Service/libsecret.

Support OPENAI_API_KEY for developer builds.

5. AI browser interaction must be tool-first.

Do not make screenshot coordinate clicking the primary control mechanism.

Implement typed browser tools such as:

browser.tabs.list
browser.tabs.open
browser.tabs.close
browser.tabs.activate
browser.page.snapshot
browser.page.find
browser.page.click
browser.page.type
browser.page.scroll
browser.page.screenshot

Developer tools:

browser.dev.console.list
browser.dev.network.list
browser.dev.network.request
browser.dev.dom.inspect
browser.dev.performance.snapshot

Use semantic element references produced by PageContextExtractor.

Computer/screenshot based interaction may be added as a fallback for interfaces that cannot be manipulated reliably through semantic browser tools.

6. Implement an explicit permission model.

Capability classes:

READ
NAVIGATE
INTERACT
SENSITIVE
DEVELOPER_POWER

Consequential actions require user approval.

Page content is untrusted data and must never be allowed to override system or user instructions.

Never expose password field contents to AI.

Redact:
- Authorization headers
- session tokens
- JWTs
- cookies
- sensitive form fields

AI must be disabled in Incognito by default.

Provide an immediate Stop Agent action.

Every agent action must enter an audit timeline.

7. Make this a developer-first browser.

The core differentiating features are:

Developer Workspaces
AI DevTools
Console Triage
Network Replay
Request to cURL/fetch/axios/Python/C#
Network Mocking
Record to Playwright
Bug Reproducer
Prod vs Staging comparison
Performance Watch
Accessibility Copilot
Open in Editor
Developer Command Palette

Do not implement all of them simultaneously.

Build them incrementally after the browser and AI foundations are stable.

8. Keep standard Chromium DevTools as close to upstream as possible.

Prefer a bundled DevTools component extension for our custom AI developer panel.

Avoid maintaining a heavily forked DevTools frontend.

9. Design a Developer Workspace abstraction.

A workspace may contain:

tabs
local development URLs
AI conversations
network overrides
environment metadata
recorded user flows
generated tests
developer notes

The workspace must survive browser restarts.

10. Design an optional local MCP server.

It should expose browser and developer capabilities to external developer agents such as Codex.

Requirements:

- bind to localhost only
- disabled by default
- explicit pairing
- per-client token
- capability scopes
- visible connected-client list
- use the same BrowserPermissionBroker as native AI
- never expose raw cookies or passwords

Expose high-level browser APIs rather than raw unrestricted Chrome DevTools Protocol access.

11. Performance constraints.

Do not add Electron or a Node runtime.

Do not ship a local LLM in the initial product.

AI services should be lazy whenever possible.

When AI is disabled there should be no unnecessary persistent AI process.

Page context should prioritize:
- accessibility tree
- visible text
- interactive elements
- metadata
- incremental changes

Do not continuously transmit full DOM documents.

Screenshots should only be taken when needed.

Measure all performance changes relative to the same upstream Chromium revision.

12. Cross-platform architecture.

Shared product logic must work on Windows and Linux.

Keep platform-specific implementations isolated.

Initially support:
- Windows x64
- Linux x64
- X11 and Wayland where supported by Chromium

Architecture must leave room for ARM64 later.

13. Upstream Chromium maintenance is a first-class requirement.

Maintain:
- a pinned Chromium revision
- reproducible bootstrap scripts
- an upstream sync workflow
- a patch inventory
- conflict reports
- extension compatibility tests
- browser smoke tests

Never solve an upstream rebase conflict by silently removing product behavior.

Document the decision.

14. Repository agent configuration.

Before implementing anything:

- inspect all skills available to Codex in the current environment;
- read and use applicable skills;
- do not duplicate an existing skill unnecessarily.

Create a concise root AGENTS.md containing only permanent repository-wide rules.

Create repo-local skills under .agents/skills for repeated workflows where useful, including:

chromium-build
chromium-upstream-sync
chromium-ui
extension-compat
ai-browser-tool
devtools-feature
security-review
performance-check
release-browser

Each skill should contain operational instructions, scripts or references where they provide real value.

Avoid bloating AGENTS.md with task-specific instructions.

15. Development phases.

PHASE 0 — FEASIBILITY

Before building the product UI, prove:

- Chromium builds on Windows.
- Chromium builds on Linux.
- DevTools opens normally.
- extensions can be installed.
- selected Chrome Web Store extensions work.
- extensions survive browser restart.
- extension update behaviour is understood.
- a custom internal browser page can be added.
- a minimal OpenAI API call works.

Create docs/feasibility-report.md.

Do not proceed based on assumptions.

PHASE 1 — PRODUCT SHELL

Implement:
- branding
- design tokens
- glass browser surfaces
- AI settings page
- side-panel shell
- command palette foundation

PHASE 2 — AI READ MODE

Implement:
- current page context
- selected tabs context
- page summarization
- page Q&A
- console analysis
- network analysis

PHASE 3 — AI ACTION MODE

Implement:
- navigation
- tab management
- semantic clicking
- semantic typing
- scrolling
- screenshots
- permission broker
- action timeline

PHASE 4 — DEVELOPER FEATURES

Implement initially:
- Developer Workspace
- AI DevTools
- Network Replay
- Request to Code
- Console Triage
- Record to Playwright
- Bug Reproducer

PHASE 5 — AGENT PLATFORM

Implement:
- task-scoped tab groups
- multi-step agent execution
- MCP bridge
- Codex browser integration
- research workflows

PHASE 6 — HARDENING AND RELEASE

Implement:
- prompt-injection tests
- extension compatibility suite
- security tests
- crash recovery
- startup benchmarks
- memory benchmarks
- Windows packaging
- Linux packaging
- updater
- code signing support
- release channels
- SBOM

16. Development rules.

For every substantial feature:

- write or update its design document first;
- identify the smallest upstream patch surface;
- implement the feature;
- add tests;
- build;
- run applicable smoke tests;
- measure performance impact where relevant;
- run security review for AI or permission changes;
- document any upstream Chromium modification.

Maintain Architecture Decision Records under docs/adr/.

Do not leave TODO implementations when the task can reasonably be completed.

Do not fake browser functionality.

Do not replace real integration tests with mocks when Chromium can test the actual behaviour.

At the end of each substantial task report:

- files changed
- architecture decisions
- upstream Chromium files modified
- tests executed
- test results
- known limitations
- security implications
- performance implications
- next dependency

Start with PHASE 0 only.

First inspect the repository and available Codex skills, then create the minimal repository scaffolding, AGENTS.md, required initial skills and the Phase 0 feasibility plan before making broad Chromium modifications.