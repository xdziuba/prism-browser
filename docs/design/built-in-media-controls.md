# Planned built-in media controls

Status: product requirement captured 2026-10-13; a Prism-owned segment-policy foundation is implemented without importing upstream code. Browser integration and distribution terms remain open.

## User requirement

Prism should ship SponsorBlock functionality as part of the browser, with settings for whether it runs and how each segment category is handled. It must not require installing SponsorBlock from the Chrome Web Store. Prism should also ship a configurable ad blocker. YouTube playback and anti-adblock behavior must be tested on the source-built browser; a permanent claim that blocking cannot be detected is not supportable because the site can change its checks.

## Candidate implementation sequence

1. Review redistribution of the upstream [SponsorBlock source](https://github.com/ajayyy/SponsorBlock) and use of its [API and database](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License). The repository states GPL-3.0-or-later for its code; the API/database page states CC BY-NC-SA 4.0 unless permission is granted. Record Prism's distribution model and required notices before importing code or relying on the hosted data in a release.
2. Pin an upstream SponsorBlock revision. Prototype it as a Chromium **component extension bundled with Prism**, not a Store-installed extension. Chromium describes component extensions as browser features bundled with the binary, normally absent from `chrome://extensions`; this provides an isolated renderer and a small upstream patch surface. The user-facing controls belong in Prism settings: global enable, category-specific auto-skip/manual/disabled behavior, an undo action, and per-site or per-channel overrides as supported by the pinned upstream version. Confirm which settings can be mapped without forking large parts of SponsorBlock. See [Chromium's component-extension design](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/component_extensions.md).
3. Keep the SponsorBlock request path scoped to video segment lookups, with no browser cookies or AI credentials. Prefer the upstream [hashed-prefix lookup](https://github.com/ajayyy/SponsorBlock/wiki/K-Anonymity) so a lookup need not reveal the exact video ID. Validate response bounds, category settings, timeline changes, seek/undo, SPA navigation, and disabled/incognito behavior in the built browser.
4. Implement ad blocking as a separate Prism-owned browser feature with local filter rules, explicit on/off and per-site controls, rule provenance and updates, and a way to diagnose broken pages. Preserve ordinary Chromium extension compatibility. Test ordinary ad resources, YouTube playback, account states, and any anti-adblock interstitial on each pinned Chromium and rule-set revision. Treat a detected blocker or broken playback as a failed compatibility test and adjust rules after diagnosis. Do not advertise an undetectable mode.

## First implementation slice: segment policy

Build a Prism-owned, dependency-free policy module before wiring network access or injecting code into YouTube. It computes a four-hex-character SHA-256 prefix from a validated 11-character video ID. It accepts only a validated SponsorBlock segment response for that exact video ID, known category names, finite start/end times, and bounded entry counts. For a hash-prefix response, never let another candidate's segments affect playback. The policy is disabled by default, including in Incognito. When enabled, only `sponsor` defaults to automatic skipping; every other category defaults to off until configured. Manual segments can be offered to the user and take precedence over an overlapping automatic skip. Consecutive automatic ranges may be merged, but a manual range stops a proposed seek. An undo target is valid only for the same video and shortly after the skip destination. The future playback adapter must consume each undo once and suppress immediate re-skipping after undo.

The policy code is independent of SponsorBlock's GPL source, and its host tests use synthetic responses. This does not yet fetch the API, play or modify a video, appear in Prism settings, or satisfy the requested browser integration. A later slice will connect it through a browser-bundled component with a native settings surface and will test actual behavior. No full Chromium build is needed for this slice.

## Second implementation slice: playback adapter

Add a small Prism-owned adapter around one HTML media element. It receives the current video ID, already validated segments, settings and Incognito state from a future browser component. It listens to media time changes, applies automatic seek decisions, reports manual decisions to a UI callback, and offers explicit manual skip and one-use undo methods. Undo suppresses the same segment IDs while the user plays through them, then resets after leaving their ranges; a video change clears the adapter state. Skipping also requires an explicit `allowPlayback: true` signal so a future site adapter can withhold seeks during advertisements or other non-video playback. The adapter must not fetch data, read page cookies, or inspect unrelated page content. Host tests with a synthetic media element verify seek, undo, manual priority, context replacement, and disabled state. A source-built Chromium smoke test loads the module separately over local HTTP and checks seek and undo on a generated WebM file. Until the component is wired and tested inside Prism, this adapter is not evidence of YouTube playback or native Prism integration.

## Third implementation slice: bounded YouTube page detection

Keep the first site adapter narrow: accept only HTTPS `youtube.com`, `www.youtube.com`, `m.youtube.com`, or `music.youtube.com` `/watch` pages with exactly one valid `v` parameter. Bind only to `video.html5-main-video` inside `#movie_player`. Treat the player's `ad-showing` class as a reason to withhold automatic seeking. Do not read cookies, player globals, captions, or page text. A lookalike host, ambiguous URL, missing player, or missing media element yields no playback context. This pure snapshot is testable with synthetic DOM and does not claim compatibility with YouTube's live markup or single-page navigation; those require a bundled component and browser tests later.

## Fourth implementation slice: temporary playback suspension

The page adapter will observe advertisement and navigation transitions. Such transitions must temporarily stop seek and undo actions without replacing the video context or forgetting an undo suppression. Add a separate playback-availability update to the controller. Only a genuine video identity change may reset the context and suppression map. Host tests should confirm that disabling playback during an advertisement prevents seeks and controls, then restoring playback does not immediately re-skip a segment the user just undid. This remains an isolated module test until the component observes real page transitions.

## Native component boundary

The pinned Chromium checkout registers bundled extensions in `chrome/browser/extensions/component_loader.cc`, checks their identity in `chrome/browser/extensions/component_extensions_allowlist/allowlist.cc`, and maps packaged files through `chrome/browser/resources/component_extension_resources.grd` and `chrome/browser/extensions/chrome_component_extension_resource_manager.cc`. A future implementation will package only the Prism media scripts and a narrowly scoped manifest, then add the minimum registration, allowlist, resource, and build wiring required by that revision. Every changed Chromium file must be recorded in `docs/upstream-patches.md` before a browser relink. Component extensions have broader inherent privilege than an ordinary Store extension, so the manifest and message boundary must accept only YouTube video IDs and validated segment data; page text, cookies, and AI credentials cannot cross it. The component stays dormant in Incognito and with the media feature disabled. No native patch is made while large relinks are paused on this host.

## Phase and patch boundaries

This is an added product requirement after the Phase 1 shell and Phase 2 read-mode foundation. SponsorBlock skips creator-inserted video segments; ad blocking handles network/page advertisements, so their behavior and settings remain distinct. Implement the smallest working slice of each, then add coverage. Before a Chromium change, write a focused ADR, list every upstream file in `docs/upstream-patches.md`, and verify a build and browser smoke test. No SponsorBlock code, database, or filter lists are vendored in this planning slice; no new upstream Chromium file is modified.

## Open gates

- Redistribution and API/data-use terms for Prism's intended distribution.
- Exact SponsorBlock revision, category/settings mapping, attribution, and update strategy.
- Native Linux and Windows integration, resource overhead, and YouTube behavior under current detection checks.
- Ad filter source, update trust, false-positive handling, and per-site UX.
