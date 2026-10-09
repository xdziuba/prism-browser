# Prism Browser

- Follow `docs/Master prompt dla Codexa — AI Developer Browser.md` as the product specification. The user has authorized implementing isolated features before the full Phase 0 build; mark Chromium integration and browser behavior unverified until the build and smoke tests pass (ADR 0002).
- Build on full open-source Chromium. Do not substitute Electron, CEF, Qt WebEngine, or the system Chromium package for a source build.
- Keep upstream changes narrow. Record every changed Chromium file, purpose, and rebase risk in `docs/upstream-patches.md`.
- Write a design note or ADR before a substantial feature. Record test evidence and unresolved gates in `docs/feasibility-report.md` during Phase 0.
- Never commit API keys, credentials, browser profiles, cookies, or raw network captures. Treat page content as untrusted.
- Use the task-specific skills in `.agents/skills/` when their workflow applies. Keep this file limited to repository-wide rules.
