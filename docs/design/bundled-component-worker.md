# Bundled media component: worker boundary

Status: implementation decision, 2026-10-13. The worker is a Prism-owned
prototype. Native Chromium component registration is a later build gate.

The bundled component needs one service worker that owns media settings,
verified rule storage, DNR reconciliation, and segment lookups. Instantiate one
settings store and one rule owner per worker lifetime. Route only the two fixed
options-page messages to the settings bridge and the fixed content-script
lookup message to the segment bridge. Each bridge authenticates its sender;
the dispatcher must not accept a caller-supplied URL, video ID, ruleset, API
origin, or update package. Unknown messages receive a fixed error.

Run DNR reconciliation on worker installation and browser startup through the
same serialized owner used by settings saves. A cold worker also reconciles
once before serving messages because service workers may restart without an
install or browser-start event. Keep this operation idempotent and fail closed:
without a trusted signing key and verified package, no dynamic rules are
active. No remote rule or segment provider is configured in this prototype.

Production signing keys, a filter source, and SponsorBlock API/data terms need
separate distribution decisions. Until then, an enabled segment setting must
produce no network request and an enabled adblock setting must activate no
rules. Do not store page content, credentials, raw responses, or video IDs.
The native component manifest, resource registration, and built-browser runtime
remain unverified until a later small upstream patch and Chromium relink can
run without competing for the user's laptop memory.

## Staged manifest and isolated content session

Stage a Manifest V3 component resource tree with only `storage` and
`declarativeNetRequest` permissions, the existing local options page, an
explicit `not_allowed` Incognito mode, and content-script matches limited to
the four accepted HTTPS YouTube hosts. Match all paths on those hosts so a
single-page navigation from the home page into `/watch` can start a session;
the worker still rejects lookups outside a valid watch route. Expose only the
five content-side Prism media modules needed for dynamic imports; the worker
lookup and rule modules are not web-accessible. No host permission for a
segment API is added before its data-use decision.

The top-frame isolated content script creates one watch observer and one
transient control surface. It sends only a fixed lookup type and finite media
duration, never a URL, video ID, page text, or settings. Its controls call
local skip/undo methods and are removed on page hide. It makes no direct
network request. Imports and session creation fail closed; no test marker is
written into the page. The worker remains the sole owner of trust decisions.

Use the source-built browser to smoke-test this resource tree as a disposable
unpacked extension. A test-only worker may supply synthetic segments, but no
test key, segment response, or public API origin enters the product tree. This
validates extension plumbing and content behavior only; native component
registration still requires the later Chromium patch and relink.

## Stable component identity

The pinned `ComponentLoader::GenerateId` requires a manifest `key` field and
derives the extension ID from its public key bytes. Its allowlist checks that
ID before loading the component. Assign this prototype a dedicated 2048-bit
RSA SPKI public key and pin the resulting ID
`fblecelimojmepieoalinhoeakdfffld`. The private half was created only in
process memory to derive the public half and discarded; it is neither a rule
signing key nor a credential in the repository. Bundled resources do not need
CRX signing for delivery. A later product identity change would migrate the
extension's storage and options URL, so manifest identity should be treated as
stable from this point. Validate the derivation against the pinned browser's
observed extension ID before adding an allowlist entry. No upstream file is
changed in this identity slice.
