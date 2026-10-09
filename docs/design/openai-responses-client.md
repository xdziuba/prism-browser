# OpenAI Responses client

Status: browser-process source implementation, 2026-10-09. No API key is configured and no request has been sent.

`OpenAIResponsesClient` is a one-task network client owned by the browser
process. A trusted credential provider gives it a key in memory when a task
starts. It uses Chromium's URL loader, posts only to the fixed
`https://api.openai.com/v1/responses` endpoint, rejects redirects, omits
browser cookies, and caps request and response size. Stop destroys the loader,
clears in-memory history and the task key, and reports cancellation. HTTP
errors and bodies are not logged.

Every request has `store: false`, `parallel_tool_calls: false`, a fixed
instruction that treats page tool outputs as untrusted data, and an explicit
`reasoning.encrypted_content` include. The client
manually replays prior user/tool inputs and every item in each response's
`output` array, including encrypted reasoning items, before appending a
`function_call_output` with the matching `call_id`. It does not use
`previous_response_id`, which expects server-side response state. This follows
the [OpenAI Responses conversation guidance](https://developers.openai.com/api/docs/guides/conversation-state)
and [function-calling flow](https://developers.openai.com/api/docs/guides/function-calling).

The client parses model output into text and function-call metadata and can
submit a bounded batch of function outputs for a single response. The
`ChromiumToolCodec` decodes function arguments and serializes typed browser
results. The `AiSessionService` mediates every call through the browser
permission broker and trusted UI approval. The client itself cannot grant a
capability or approve an action.

Production credential storage and the browser UI entry point remain separate
work. Until secure OS-backed storage is wired, the client can use only a
transient key supplied by trusted caller code; it never persists that key.
