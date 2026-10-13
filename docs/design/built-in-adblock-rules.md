# Built-in ad blocking: bounded rule compilation

Status: rule compilation and synthetic signed-candidate verification, 2026-10-13. Chromium integration is pending.

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

## Second slice: signed candidate updates

Before any remotely sourced rules can be considered, verify an envelope with a browser-pinned Ed25519 public key. The envelope contains only `keyId`, base64url-encoded raw JSON `payload`, and base64url-encoded `signature`. Verify the signature over the exact decoded payload bytes before parsing JSON. Bound the payload to 1 MiB and reject noncanonical encoding, unknown keys, malformed signatures, invalid UTF-8, unsupported rule shapes, source changes, and a version that does not advance. The trusted key map is supplied by browser-owned code, never by a page or the envelope. A successful result is only a **candidate** DNR ruleset with provenance and a content digest. On any failure, return the previous candidate unchanged with a fixed error tag.

This slice uses ephemeral test keys and synthetic rules only. It does not choose a real list provider, ship a production public key, fetch updates, persist a last-known-good package, or call `updateDynamicRules`. Browser integration must later apply rule replacement in a way that preserves the previous active rules if DNR installation fails, and must handle key rotation/revocation and rollback of a bad-but-valid update. Ed25519 Web Crypto import and verification follow the [Web Cryptography Level 2 specification](https://www.w3.org/TR/WebCryptoAPI/#ed25519).
