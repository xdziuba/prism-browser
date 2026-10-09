# Responses tool contract

Status: source integration in progress, 2026-10-09. No API request has been sent.

Prism exposes only implemented tools to the OpenAI Responses API:
`browser_tabs_list`, `browser_tabs_open`, `browser_tabs_close`,
`browser_tabs_activate`, `browser_page_snapshot`, and `browser_page_find`.
Their API names use underscores; internal audit names keep the dotted form.
Each function has a strict JSON schema with all fields required and
`additionalProperties: false`. The decoder also rejects unknown names,
extra arguments, incorrect types, and oversized arguments locally before
the tool broker sees them. Approval and grants remain browser-owned.

The output serializer switches on typed `ToolOutput` variants and emits an
allowlist of fields. It strips URL paths and queries to an HTTP(S) origin,
bounds arrays and text, and never serializes an execution ticket. Unavailable,
denied, stopped, or failed actions return a status/reason only. The model
transport must pause on `kAwaitingApproval` and wait for the trusted UI; it
must not fabricate approval from a model response.

`OpenAIResponsesClient` uses the Responses API with `store: false` and
manual replay of every returned output item, including reasoning and function
call items, before appending `function_call_output` with the matching `call_id`.
See [official function calling documentation](https://developers.openai.com/api/docs/guides/function-calling)
and [official conversation state guidance](https://developers.openai.com/api/docs/guides/conversation-state).
