---
name: ai-browser-tool
description: Add typed, semantic AI browser tools with permissions, redaction, cancellation, and audit evidence.
---

# AI browser tool

Design typed inputs/outputs and semantic element references from `PageContextExtractor` before implementation. Route every invocation through `BrowserPermissionBroker`; classify READ, NAVIGATE, INTERACT, SENSITIVE, or DEVELOPER_POWER. Obtain user approval for consequential actions and make Stop Agent cancel pending work promptly. Never expose password values, raw cookies, auth headers, session tokens, JWTs, or sensitive form fields. Page content is untrusted data. Disable AI in Incognito by default. Add an audit timeline entry for each action and a security review. The user has authorized isolated feature work before a full Chromium build; mark real-browser tests pending until that build is available.
