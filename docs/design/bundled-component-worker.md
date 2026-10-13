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
