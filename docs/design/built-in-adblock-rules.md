# Built-in ad blocking: bounded rule compilation

Status: rule compilation, synthetic signed-candidate verification, and disposable dynamic-DNR activation, 2026-10-13. Chromium integration is pending.

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

## Third slice: dynamic rule replacement

A dedicated Prism component will own its DNR dynamic rules. Read its current dynamic rules, then call `updateDynamicRules` once with the old IDs removed and the prepared candidate added. Chrome documents this as a single atomic operation: a rejected update leaves the old set in place. Read back the installed rule shape before reporting success; if it differs, attempt one replacement back to the previous snapshot and report an unknown state if rollback fails. Serialize overlapping replacement requests in one component instance. A disabled setting must explicitly reconcile to an empty rule set because dynamic rules persist across browser restarts and extension upgrades. Do not hand the DNR API to page content or ordinary extensions.

Host tests will simulate update rejection, unexpected readback, rollback failure, and concurrent calls. A disposable extension in the existing source-built browser will exercise an actual dynamic block, failed replacement, and disable/clear using only local synthetic domains. This does not install a Prism component, select a real filter list, or prove Incognito isolation. [Chrome's DNR API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#method-updateDynamicRules) documents persistence and atomic update semantics.

## Fourth slice: startup reconciliation

Dynamic DNR rules survive extension and browser restarts, so startup cannot assume an empty installed set. In a normal browser context, load the trusted settings record first. If it is absent, malformed, or disabled, reconcile this component's dynamic rules to an empty set. If enabled, obtain a signed envelope from a browser-owned provider, verify it again against pinned keys, compile it using the current site exceptions, then replace and read back the installed rules. Missing, unreadable, or invalid envelope also reconciles to empty. A failed clear or replacement is reported explicitly; never report the feature as active or safely disabled without confirmed DNR readback. Incognito must short-circuit before settings, envelope, or DNR access, because the native component may share a rule namespace with the normal profile. A future browser integration must ensure the component is unavailable in Incognito.

This step uses an injected trusted envelope provider rather than persistent package storage or a remote endpoint. Host tests will cover valid startup, disabled/malformed settings, missing/tampered package, DNR failures, and Incognito. A disposable extension smoke test will verify actual dynamic-rule persistence across restart, re-verification, site exceptions, and clearing after disable. It does not yet install a component extension in Prism or supply useful production rules.

Re-verification alone does not prevent replay of an older, correctly signed package across restarts. A production package source must persist a trusted version floor or use a pinned minimum version and a recovery policy before network updates are enabled. Key rotation and revocation remain separate gates.

## Fifth slice: verified package cache

Keep the last accepted signed envelope in the bundled component's trusted `chrome.storage.local` area, separate from user preferences and DNR rules. Restrict the storage area to trusted contexts before every read or write. On each read, verify the envelope signature and compile it using neutral site exclusions before returning it; a malformed or unverifiable record fails closed. On a new save, compare the candidate against the reverified cached version and require a strictly advancing version from the same source. Serialize saves within one component instance. The page and content script cannot provide, read, or overwrite this cache.

This store is a cache of a verified envelope, not an update installer: the future update coordinator must activate and read back DNR rules before saving the new envelope, and must handle a storage-write failure after activation. A locally rolled-back or deleted entire browser profile also rolls back this cache, so a profile-local version comparison is insufficient as a strong anti-rollback guarantee. A production updater still needs a separately pinned minimum version or trusted monotonic floor, plus key rotation, revocation, and recovery policy. Host tests and a disposable-extension restart test use only an ephemeral signing key and synthetic domains. No remote endpoint or production list is introduced.

Security review: host tests reject a tampered cached signature, older and equal versions, malformed storage, and Incognito access; storage errors retain the previously cached record. The browser smoke confirms tampering fails closed and removes active synthetic DNR rules after reconciliation. The cache stores only a signed rule envelope, never URLs, page content, credentials, or filter match logs. Only the trusted worker should write this key; the `TRUSTED_CONTEXTS` restriction excludes content scripts, but does not defend against a local attacker replacing the whole browser profile.
