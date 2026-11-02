# Phase 2: ask about the active page

The AI panel adds **Ask about page** beside the ordinary Send action. It uses
the text currently in the composer as the user's question, then reads a fresh
bounded and redacted accessibility snapshot of the active HTTP(S) tab in the
browser process. The panel does not send its local preview text to the model.
The browser checks the tab and navigation again immediately before dispatch.

The question is limited to 2 KiB and the page text to 16 KiB. The request
labels the page text as untrusted, asks the model to answer from that text,
and states when context is partial. It uses the read-only Responses turn
introduced for page summaries, so no browser tools are offered. A normal
Send action keeps its existing chat and permission behavior.

The question stays in the composer if extraction fails. On successful
dispatch, the panel clears it, shows the user's question in the conversation,
and allows Stop Agent to cancel the request. Incognito, internal URLs, empty
questions, missing sessions, changed navigation, and overlapping reads must
fail closed. The existing page-content redaction is best-effort; the panel
explains that this action sends readable text to OpenAI. A real model answer
remains subject to the independent live API gate.
