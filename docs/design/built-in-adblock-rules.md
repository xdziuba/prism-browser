# Built-in ad blocking: bounded rule compilation

Status: first isolated implementation slice, 2026-10-13. Chromium integration is pending.

## Decision

Use Prism-owned structured rule input and compile it to a small subset of Chromium Manifest V3 declarativeNetRequest (DNR) rules. DNR evaluates matching rules in the browser without exposing request content to a JavaScript listener. The pinned Chromium revision supports `requestDomains`, `resourceTypes`, and `excludedTopDomains`; a higher-priority or equal-priority `allow` rule can override a `block` rule, but this slice emits only `block`. The browser will later own the source selection, updates, enable toggle, and per-site settings. The page must not supply rule bundles or settings.

The first rule shape is intentionally narrow: numeric ID, one ASCII destination domain, and one or more of `script`, `image`, `xmlhttprequest`, or `sub_frame`. No regular expressions, URL patterns, redirects, header modification, main-frame or media blocking, or imported filter lists are accepted. Input is bounded to 1,000 unique rules. The bundle records a source ID and version for diagnostics; future downloaded updates require a trusted provenance and rollback design before they can be enabled. Global disabled state emits zero rules. Per-site disable is compiled into `excludedTopDomains` on each rule, using validated domain names and a 256-site bound. Invalid input rejects the whole bundle rather than silently broadening its scope. DNR domain conditions include subdomains, so a rule for `ads.example.test` also matches its subdomains but not lookalike hosts.

The first rules are synthetic test data only. This is not a useful filter list yet, and it cannot block first-party or media advertisements on YouTube. A later pinned browser component will load the compiled rules, keep itself disabled in Incognito, expose the global and site controls, show the matching source/rule in a diagnostic view, and test page breakage. Chromium DNR behavior, coexistence with ordinary extensions, YouTube playback, and anti-adblock compatibility must be measured in the source-built browser after that integration. No permanent non-detection claim is possible.

## Security and failure cases

- Reject an untrusted bundle with unknown keys, malformed or duplicate IDs, malformed domains, unsupported resource types, or excessive counts before any rule is installed.
- Keep the user enable switch off by default; a failure to load settings must produce zero rules.
- Do not permit page content to add rules, choose update URLs, or read diagnostics containing browsing URLs.
- Treat rules as able to break sites; a site exclusion and source/ID diagnostic are required before a release.
- No remote rules or update endpoint are included in this slice. A future update path needs signature or other trusted distribution, atomic activation, and rollback tests.

Reference: [Chrome declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
