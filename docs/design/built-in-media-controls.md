# Planned built-in media controls

Status: product requirement captured 2026-10-13; implementation architecture and distribution terms require a later decision before code import.

## User requirement

Prism should ship SponsorBlock functionality as part of the browser, with settings for whether it runs and how each segment category is handled. It must not require installing SponsorBlock from the Chrome Web Store. Prism should also ship a configurable ad blocker. YouTube playback and anti-adblock behavior must be tested on the source-built browser; a permanent claim that blocking cannot be detected is not supportable because the site can change its checks.

## Candidate implementation sequence

1. Review redistribution of the upstream [SponsorBlock source](https://github.com/ajayyy/SponsorBlock) and use of its [API and database](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License). The repository states GPL-3.0-or-later for its code; the API/database page states CC BY-NC-SA 4.0 unless permission is granted. Record Prism's distribution model and required notices before importing code or relying on the hosted data in a release.
2. Pin an upstream SponsorBlock revision. Prototype it as a Chromium **component extension bundled with Prism**, not a Store-installed extension. Chromium describes component extensions as browser features bundled with the binary, normally absent from `chrome://extensions`; this provides an isolated renderer and a small upstream patch surface. The user-facing controls belong in Prism settings: global enable, category-specific auto-skip/manual/disabled behavior, an undo action, and per-site or per-channel overrides as supported by the pinned upstream version. Confirm which settings can be mapped without forking large parts of SponsorBlock. See [Chromium's component-extension design](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/component_extensions.md).
3. Keep the SponsorBlock request path scoped to video segment lookups, with no browser cookies or AI credentials. Prefer the upstream [hashed-prefix lookup](https://github.com/ajayyy/SponsorBlock/wiki/K-Anonymity) so a lookup need not reveal the exact video ID. Validate response bounds, category settings, timeline changes, seek/undo, SPA navigation, and disabled/incognito behavior in the built browser.
4. Implement ad blocking as a separate Prism-owned browser feature with local filter rules, explicit on/off and per-site controls, rule provenance and updates, and a way to diagnose broken pages. Preserve ordinary Chromium extension compatibility. Test ordinary ad resources, YouTube playback, account states, and any anti-adblock interstitial on each pinned Chromium and rule-set revision. Treat a detected blocker or broken playback as a failed compatibility test and adjust rules after diagnosis. Do not advertise an undetectable mode.

## Phase and patch boundaries

This is an added product requirement after the Phase 1 shell and Phase 2 read-mode foundation. SponsorBlock skips creator-inserted video segments; ad blocking handles network/page advertisements, so their behavior and settings remain distinct. Implement the smallest working slice of each, then add coverage. Before a Chromium change, write a focused ADR, list every upstream file in `docs/upstream-patches.md`, and verify a build and browser smoke test. No SponsorBlock code, database, or filter lists are vendored in this planning slice; no new upstream Chromium file is modified.

## Open gates

- Redistribution and API/data-use terms for Prism's intended distribution.
- Exact SponsorBlock revision, category/settings mapping, attribution, and update strategy.
- Native Linux and Windows integration, resource overhead, and YouTube behavior under current detection checks.
- Ad filter source, update trust, false-positive handling, and per-site UX.
