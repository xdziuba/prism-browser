# Chromium page read path

Status: source and GN integration, 2026-10-09. Browser build deferred by user.

The read-only `browser.page.snapshot` and `browser.page.find` tools take a session tab ID. Inspection
requires an active task, a READ grant, a regular profile, a live tab in the
current window, and an HTTP(S) committed page. It returns a typed
`PageContextSnapshot` or a bounded `PageFindOutput`, never a raw accessibility tree or DOM document. Find searches the redacted snapshot text and returns at most 20 short snippets.

Chromium requests one AX tree snapshot with a 1,000-node cap, a three-second
timeout, and `kSameOriginDirectDescendants` to exclude cross-origin frames.
The callback checks Stop, tab lifetime, membership in the window, and the
committed navigation entry again. A callback dropped by Chromium must still complete the
broker ticket with failure, so a later task is not blocked forever.

An independent converter traverses only the snapshot's root-linked nodes.
It drops invisible, ignored, protected, editable, and text-field subtrees.
Only static text, headings, and a small whitelist of interactive role names
reach `PageContextExtractor`; AX field values and arbitrary attributes never
cross this boundary. The extractor applies its existing size limits, token
redaction, and snapshot-scoped semantic references. Page titles are omitted
until their exposure and redaction are reviewed. References are invalidated
when a later snapshot replaces them or a tab-close request is dispatched.

The browser process owns the adapter and completion callback. No model
transport, page script, extension, or renderer can invoke grants or approvals.
Host tests cover hidden/protected/editable subtrees, unreachable nodes,
duplicate IDs, and output bounds. GN generation and header dependency checks
pass. Real AX shape, same-origin behavior, timeout, navigation races, and
output redaction remain browser-test gates after the deferred build.
