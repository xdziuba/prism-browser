# Phase 2: explicit console triage

2026-11-02. The Phase 2 console read starts with a metadata-only capture in
the native Prism AI panel. The user starts capture, reproduces a problem in
the active HTTP(S) tab, then explicitly asks the model to analyze the captured
events. Standard F12/DevTools remain the place to inspect full messages.

## Decision

Observe real browser-process console events for one active tab. Store at most
100 warning/error records, each containing only a fixed severity, a fixed
exception category, and a bounded line number. Count dropped events. Do not
retain console message text, source URLs, stack traces, arbitrary object
values, or cross-origin subframe events. Clear and invalidate capture on a
committed main-frame navigation, tab destruction, panel close, or session
stop. A changed active tab cannot be analyzed.

The model turn is stateless and read-only. It receives the fixed metadata
summary only; no browser tools, prior chat history, or raw console strings.
The UI labels the analysis as limited and asks the user to use DevTools for
details. The separate explicit capture action is the permission to observe
developer data; model access requires a second explicit click. Neither
action runs in Incognito or for internal pages.

## Verification

Unit-test that secret-bearing sample messages cannot appear in the digest.
Build the pinned Linux browser and trigger real `console.warn`/`console.error`
events on a local page after capture starts. Verify severity/category/count,
navigation invalidation, no leaked sample secret in panel output, request
dispatch only after Analyze, expected offline API failure, and F12. This is
metadata triage; full console text analysis and live model quality remain
unverified.
