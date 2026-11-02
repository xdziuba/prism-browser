# Phase 2: explicit page summary

The Prism AI side panel gains a **Summarize active page** action after a model
session starts. The browser process resolves the active HTTP(S) tab, obtains a
fresh accessibility snapshot through the existing read permission broker, and
checks the tab and committed navigation again before sending any content. The
UI never supplies the page text for the model request.

The request contains at most 16 KiB of the already redacted visible text and a
bounded origin. It labels the text as untrusted and asks for a concise summary
with an explicit partial-context caveat when needed. It is sent only after the
user presses the action. A read-only model turn omits browser tools; any
unexpected tool call in its response fails the turn. The next ordinary chat
turn can use the normal scoped tool broker again. Stop Agent and panel closure
cancel both extraction and any in-flight model request.

The browser must refuse Incognito, internal URLs, missing/empty snapshots,
changed navigation, a missing session, and overlapping requests. No page text,
API key, or model response is persisted in the profile. The action is distinct
from the local preview so users can inspect context without uploading it.

## Security review and verification

- Source text remains untrusted, including instructions that look like user or
  system messages. The model instructions and request wrapper say to summarize
  it as data only; the read-only request has no browser tools.
- Protected form values and known credential patterns are removed by the
  existing context extractor. This is best-effort redaction; page text may
  contain other private information. The button and panel text disclose that
  the summary sends readable text to OpenAI.
- Verify redaction, navigation freshness, no request before the button press,
  and cancellation in an isolated browser with a local synthetic page. A live
  OpenAI summary still requires the separate developer-key gate.
