---
name: devtools-feature
description: Add Prism developer features while preserving standard Chromium DevTools and limiting upstream changes.
---

# DevTools feature

Start with a design note identifying the user workflow and the smallest extension or browser-service boundary. Prefer a bundled DevTools component extension over forking the DevTools frontend. Keep F12 and standard panels functional. Test against the built Chromium revision with a real page and real network/console events; mocks alone are insufficient. Record any changed upstream file and rebase risk. Treat developer-power tools as permissioned and redact secrets from network/console output exposed to AI.
