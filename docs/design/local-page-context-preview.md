# Phase 2: local page-context preview

2026-10-15. The read-only page adapter and permission broker are linked into the
Linux browser, but their output has not been exercised against a live page.

## Decision

Add a user-invoked preview to the Prism AI side panel. It reads only the active
HTTP(S) tab in the same regular browser window, through the existing
`ChromiumBrowserToolService` and an explicit task-scoped READ grant. It uses the
same bounded accessibility snapshot, redaction, and cancellation path that a
model tool call would use. The panel displays a capped text excerpt with
`textContent`; it never persists or sends the excerpt to OpenAI. The preview
works before an API session starts, so a key is not needed for this test.

The preview is absent from the full-tab AI page, where the active tab is the
AI WebUI itself. The browser process resolves the active tab; the renderer
cannot provide a tab ID or a URL. No snapshot is returned for Incognito,
non-HTTP(S) pages, an empty tree, or a tab that navigates during extraction.
Closing the panel cancels the preview service. A second click while a read is
in flight is ignored; another click after completion starts a fresh snapshot.

The first live test found that the AX tree contains ignored layout wrappers
above visible text. The extractor previously dropped those entire subtrees.
Traverse ignored wrappers but omit their own labels; still prune hidden,
editable, protected, and text-field subtrees. Test an `aria-hidden` fixture as
well as the form value to confirm those boundaries.
When a heading's name exactly matches its static-text child, retain one copy
of that text in the bounded snapshot.

## Security review

The WebUI asks to preview without supplying a URL or tab ID. The browser
process derives both from the owning window, excludes Incognito and internal
pages, and routes the read through the permission broker with a fresh READ
grant. The broker records the action without recording page data. A panel hide
stops the read. The test page contains a synthetic inline API key, an
Authorization header, a Cookie header, an editable value, and an `aria-hidden`
subtree; none may appear in the panel output. The UI uses `textContent`, so
page text is not executed as markup. The preview performs no OpenAI request.
The scanner recognizes only known secret patterns, and arbitrary page text
remains untrusted; the user should review it before allowing a later AI task
to read the page. Network and console tools remain disabled until they have
separate structural redaction.

## Verification

Build `chrome` incrementally with one job. In an isolated source-built browser,
open a synthetic HTTP page with visible text and credential-looking content,
then invoke the preview in the native panel. Confirm visible text and origin,
redacted secrets, excluded editable values, and an explicit failure on a
browser-internal page. Check a fresh preview after navigation and no horizontal
overflow. Run the ordinary-page, F12, and side-panel regression smokes. This
does not establish live OpenAI summarization or arbitrary site coverage.
