# Phase 2 foundation: redact structured secrets in page context

Status: implemented and host-tested, 2026-10-13. Browser relink and smoke test remain open.

## Problem and decision

`PageContextExtractor` redacts a few inline token assignments before returning visible text, titles, origins, and element labels to the AI path. Its current scanner stops at an opening quote, so `api_key="secret"` can leave `secret` visible. A JSON key such as `"api_key":"secret"` is missed because a quote separates the key from the colon. Header lines with whitespace before the colon can also expose non-Bearer credentials.

Recognize a bounded list of credential field names with ASCII case-insensitive matching and token boundaries. Accept an optional closing quote after a quoted key, horizontal whitespace around `:` or `=`, and quoted or unquoted values. Replace the complete value, including any quoted contents, before applying the existing output caps. A missing closing value quote consumes the rest of that line. Consume quoted Bearer values as one token. Recognize authorization and cookie header names with optional horizontal whitespace before the colon. Continue to omit editable values and protected accessibility subtrees structurally.

This is defense in depth for accidental credential-looking text in the accessibility tree. It is not a general secret detector and cannot make arbitrary page content trusted. Network and console adapters must remove sensitive fields structurally before AI transport. The scanner does not store or log the original value.

## Patch surface and verification

Change only Prism-owned `prism/ai/page_context.cc` and its host test. No upstream Chromium patch or browser UI change is needed. Exercise quoted assignments, JSON, whitespace, malformed quotes, header spacing, case folding, and lookalike field names. Compile and run the host test with warnings enabled; optionally compile the single `//prism/ai:core` target with one job. Do not claim source-built browser behavior for this edit until a later incremental browser relink and smoke test. Memory use on the user's shared machine takes priority over relinking Chromium today.

## Security review

Input is renderer-derived, untrusted page text. The output is a model-facing snapshot, so fail closed on malformed credential syntax, avoid reading past line bounds, preserve UTF-8 truncation behavior, and keep the existing node/text caps. The field-name allowlist can miss unknown credential names; that limitation must remain explicit in `docs/feasibility-report.md`.
