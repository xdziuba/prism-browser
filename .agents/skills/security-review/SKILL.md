---
name: security-review
description: Review Prism AI, credential, permission, extension, and MCP changes for concrete browser security risks.
---

# Security review

Review trust boundaries from page/extension content to browser services and OpenAI requests. Verify that password fields, cookies, authorization headers, JWTs, and sensitive form fields cannot reach AI logs or prompts. Check Incognito default-off, immediate cancellation, per-action audit records, and approval for consequential actions. Credentials belong in Windows secure credential APIs/DPAPI or Linux Secret Service; `OPENAI_API_KEY` is developer-only. For an MCP bridge, require localhost binding, default-off, explicit pairing, per-client scoped tokens, visible clients, and the same permission broker. Record concrete attack tests and findings with the feature design note.
