# AI session orchestration

Status: source integrated into GN, 2026-10-09. Chromium compilation, UI binding, and a live API request are pending the deferred browser build.

`AiSessionService` owns one window's `ChromiumBrowserToolService` and one
in-memory `OpenAIResponsesClient`. Trusted browser UI supplies a transient
credential, starts a task, grants capabilities, sends messages, approves or
rejects a specific action ID, and invokes Stop. None of these control methods
is exposed as a model function. The model can request only the six currently
implemented typed browser functions.

The session replays each Responses API turn, decodes tool arguments with the
strict codec, submits each call through the permission broker, and sends only
the codec's allowlisted JSON result back as `function_call_output`. It pauses
on `kAwaitingApproval` and exposes the typed call and action ID to the trusted
UI for review. Tool completion arrives asynchronously for accessibility
snapshots. Calls are processed sequentially, with at most 32 tool calls per
task. A model request, invalid tool name, malformed arguments, or unsafe
serialization failure stops the session with an error event.

Stop cancels the network loader, marks browser tickets cancelled, drops
pending approvals, clears the task key and response history, and prevents
late callbacks from resuming the session. Completed browser actions cannot be
undone by Stop. The session's event observer is a browser-process integration
point; a future WebUI handler must authenticate the source and keep grant and
approval controls separate from page content and extension content.

`store: false` and replay of all response output items follow the
[OpenAI conversation-state guidance](https://developers.openai.com/api/docs/guides/conversation-state).
The request explicitly includes encrypted reasoning content for compatibility
with stateless reasoning models. The function-call handshake follows the
[official function-calling guide](https://developers.openai.com/api/docs/guides/function-calling).
