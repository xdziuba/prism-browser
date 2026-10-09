# AI tool foundation: design note

Status: implementation slice, 2026-10-09. Tab adapter has GN integration; browser behavior pending build and UI wiring.

## Job

Provide a typed contract for browser tools and a single decision point for capability grants, user approval, Stop Agent, and an audit timeline. The model may supply tool arguments only. Browser state, element risk classification, grants, and approval must come from trusted browser/UI code.

## Boundaries

- `ToolCall` is a variant of named, typed operations. Interactive elements use a semantic reference with a tab ID, snapshot ID, and node ID. A later `PageContextExtractor` owns creation and validation of these references.
- `BrowserPermissionBroker` owns task-scoped capability grants. No grant is implicit; calls without a grant are rejected before browser content is inspected. Incognito and disabled AI are denied. `SENSITIVE` and `DEVELOPER_POWER` must be granted separately.
- `BrowserToolBroker` obtains a trusted `Inspection` from its browser adapter. The current tab adapter resolves live session tab IDs, denies Incognito, and classifies opening a URL as consequential. Future page and developer adapters must reject stale/cross-tab element references, classify sensitive targets, and certify redaction before read results are delivered to AI. Missing inspection fails closed.
- Tab closing, semantic clicking, and semantic typing always require a separate one-use approval through a trusted UI call. Any other action marked consequential by the Chromium adapter also requires approval. Approval re-inspects the page before execution.
- `Stop` cancels pending approvals and signals in-flight work. A completion after Stop is audited but its output is withheld from AI. A new task waits until all tickets complete. Adapters must check the cancellation signal during long-running operations and finish tickets on error or timeout.
- `AiActionAuditLog` records action IDs, tool names, capability, state, reason, and time, never arguments, URLs, page text, request bodies, credentials, or outputs. Each attempt, approval, rejection, completion, and cancellation creates an entry.

The current `ToolCall` inputs are typed. Tab operations now return `TabsListOutput` or `ActionAcknowledgement` through a `ToolOutput` variant; the broker rejects a result variant or acknowledgement kind that does not match the invoked tab tool. No arbitrary JSON result enters the broker. The other tools are fail-closed until typed outputs exist for `PageContextSnapshot`/semantic refs, click/type/scroll acknowledgements, screenshots, and redacted developer records. Model transport is not connected. Serialize only after field-level redaction tests.

## Implementation slices

Keep the core in `prism/ai/`, independent of Chromium headers so it can be checked quickly on this host. It defines the full tool name/capability map and a broker driven by an abstract trusted host. It does not execute browser actions without a host implementation.

`PageContextExtractor` accepts a flattened accessibility/visible-content input supplied by the future Chromium adapter. It emits a bounded visible-text summary and interactive elements with semantic references. It never copies editable field values, and omits nodes marked sensitive or password-like. It invalidates prior references when a new snapshot is extracted or a tab is invalidated. This is a safety boundary for the read-mode context path; the adapter must still classify sensitive nodes correctly and invalidate on navigation/DOM replacement.

A Chromium browser-tool service now routes four tab operations and a read-only page snapshot through the same broker. Both adapters are listed in `chrome/browser/BUILD.gn`. The service is not yet constructed by browser UI, so no feature is accessible to users. Typed outputs exist for these implemented tools; a WebUI approval surface and model transport will follow. They will be validated by the deferred full build and real-browser tests.

`prism/ai/BUILD.gn` declares the core as an isolated Chromium source set. `scripts/dev/install_overlay.py` stages only Prism-owned files under a checkout's `src/prism/` directory after checking the pinned revision; it refuses to overwrite divergent files. A nine-line change to `chrome/browser/BUILD.gn` includes the adapters, service, Responses tool codec, and core dependency. GN generation and header dependency checks pass; no Chromium C++ compile has run since this change. The read path uses `content/public/browser/web_contents.h` (`RequestAXTreeSnapshot`) with a bounded asynchronous callback.

## Security review and open integration work

Fail closed if inspection or redaction is unavailable. Deny password and other sensitive field targets. Do not store action arguments in the audit log. Page content is never allowed to grant capabilities or approve actions. Browser adapter code must redact authorization headers, session tokens, JWTs, cookies, sensitive forms, and password fields before forming any output; the current slice has no output path. AI remains off in Incognito.

The current slice cannot prove actual Chromium accessibility-tree mapping, DOM reference validity after arbitrary page mutation, response redaction from browser/network APIs, cancellation inside Chromium APIs, or behavior after tab navigation. Those are browser integration tests, not host-only policy tests. Audit persistence across restarts is also deferred to the workspace service.

## Verification so far

The two host-only C++20 test executables in `tests/ai/` compile with `-Wall -Wextra -Werror` and pass. They cover default denial, capability grants, one-use approval, changed targets, Incognito, redaction readiness, Stop on pending and active calls, task-generation races, revocation, sensitive form suppression, token/header redaction, output bounds, and reference invalidation. `clang-format -style=Chromium --dry-run --Werror` and `gn format --dry-run prism/ai/BUILD.gn` pass. The overlay installer passed a dry run against the pinned checkout. None of these results establish that the code is linked into or works inside Chromium.
