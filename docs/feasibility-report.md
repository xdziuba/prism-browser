# Phase 0 feasibility report

Updated: 2026-10-20. Baseline: Chromium `d5556885f34d231a63b3138269bc245aa6f6a408`, `depot_tools` `3de62e5b4fe72ecae5eff72356d0527eccb3b8c0`.

## Current environment

The repository initially contained only a README and the master prompt. The current host is CachyOS Linux x86-64 with 11.4 GiB RAM, 11.4 GiB swap, and about 423 GiB free disk at the repository path. Python 3.14.7 and Git 2.55.0 are available. A packaged Chromium 153.0.8010.52 is installed, but `depot_tools`, GN, and `autoninja` were not present at initial inspection. The packaged browser is **not** evidence of a source build or Web Store compatibility of Prism. Windows is not available on this host.

On this host, the Phase 0 bootstrap completed with a shallow Git checkout and DEPS sync. `git rev-parse HEAD` confirmed both locked hashes. The source and dependency checkout occupied about 29 GiB after hooks; `depot_tools` occupied about 1.1 GiB. `gn gen out/PrismFeasibility --args='is_debug=false is_component_build=true symbol_level=0'` succeeded and generated 36,678 targets. A `chrome` build was attempted with `autoninja -j4` and stopped at the user's request after 737 completed actions and no compiler failures. It produced no browser binary. `gn clean` removed partial build artifacts, and a fresh `gn gen` passed again. At that point this was only configuration evidence; the later full build passed as recorded below.

## Gate matrix

| Requirement | Status | Evidence / next action |
| --- | --- | --- |
| Chromium builds on Linux x64 | **Passed** | Pinned full-source `chrome` build succeeded on 2026-10-09; an incremental `chrome` build with the native Prism media component passed on 2026-10-14. `out/PrismFeasibility/chrome --version` reports `Chromium 157.0.8095.0`; ordinary page and Prism WebUI smoke tests pass. External logs: `/home/pawel/coding/prism-chromium-work/build-linux.log` and `build-linux-20261014.log`. |
| Chromium builds on Windows x64 | Not tested | Run the Windows bootstrap and build on a Windows x64 host. |
| Standard DevTools opens with F12 | **Passed** | XTest sent F12 to the built browser on an isolated X11 display. A `DevTools` target opened and the docked Elements and Console tabs rendered; see `docs/evidence/devtools-f12-linux-20261010.png` and `scripts/phase0/devtools_f12_smoke.mjs`. |
| Extensions can be installed | **Passed** | The fixture installed via the `chrome://extensions` developer-mode button and native folder chooser, without `--load-extension`; `chrome.developerPrivate.getExtensionsInfo()` reported it enabled. See `scripts/phase0/extension_ui_install.mjs`. |
| Selected Chrome Web Store extensions work | **Passed** | uBlock Origin Lite and Dark Reader installed with location `FROM_STORE` and survived restart. Dark Reader changed `https://example.com/`; uBlock redirected an advertising script to its own replacement resource before and after restart. See `scripts/phase0/store_compat.mjs`. |
| Extensions survive browser restart | **Passed** | The normally installed fixture remained enabled and its `chrome.storage.local` UUID survived restart without load flags. Both public Store extensions also remained enabled at the same versions after restart. |
| Extension update behavior understood | **Passed for a controlled CRX; Store update unverified** | A normally installed, signed CRX fetched a local update feed and newer CRX, changed from `1.0.0` to `1.0.1`, retained `chrome.storage.local`, and survived restart. See `scripts/phase0/extension_update_smoke.mjs` and `docs/evidence/extension-update-linux-20261010.png`. An actual Chrome Web Store version change has not been observed. |
| Custom internal page can be added | **Passed** | `chrome://prism-ai/` loaded in the pinned browser with its CSS and JS and no page errors; see `scripts/phase0/browser_smoke.py` and `docs/evidence/prism-ai-linux-20261009.png`. |
| Minimal OpenAI Responses API call works | Not tested | Run `openai_probe.py` with a developer key; record status without secrets. |

The Linux build, standard DevTools launch, normal extension installation and persistence, controlled CRX update, selected Store extension behavior, and custom internal page have passed. Windows build, an actual Store version update, and the OpenAI call remain open. The source and tools pins were read directly from their official Git remotes on 2026-10-09. The OpenAI probe was not run because `OPENAI_API_KEY` is not set on this host.

The user subsequently authorized isolated feature implementation before the full browser build (ADR 0002), then authorized resuming the full build on 2026-10-09. Browser integration is now proven for an ordinary page and the Prism WebUI on Linux; AI service behavior and the other gates retain the statuses above.

At 15:33 CEST, the Linux `chrome` build started from the pinned checkout with `is_debug=false is_component_build=true symbol_level=0` and `autoninja -j4 -C out/PrismFeasibility chrome`. The user-level systemd service was `prism-build-linux-20261009.service`; its log is `/home/pawel/coding/prism-chromium-work/build-linux.log`. The source and `depot_tools` HEADs matched `chromium.lock.json`, and the overlay and upstream patches were in place. The host was CachyOS Linux x86-64 and the pinned checkout used bundled Clang 24.0.0git.

The first full attempt ended at 21:51 CEST after 22,628 seconds, with 52,872 completed actions and one failed Prism object: `credential_store_linux.o`. Chromium's bundled libsecret header requires an enum constant for the schema terminator, and `base::NoDestructor` rejects the trivially destructible dynamic-loader holder. Both were corrected in Prism-owned code. Incremental compilation then exposed Chromium Clang-plugin style errors in the host-only broker header, an `override` omission, the pinned revision's renamed `base::DictValue` and `base::ListValue` APIs, an updated `SimpleURLLoader` callback type, and incomplete type and namespace qualifications. The revised `//prism/ai:core`, `//prism/ai:chromium`, `//prism/ui/webui:prism_ai_ui`, and `//prism/credentials:credentials` targets compile, and `gn check` passes for the latter three. The incremental `chrome` build succeeded at 22:51 CEST in 55m42s with 4,014 further actions. Its final WebUI fix relinked successfully, and `python3 scripts/phase0/browser_smoke.py /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed for both an ordinary local page and `chrome://prism-ai/`. The WebUI uses a regular `DefaultWebUIConfig` because `DefaultInternalWebUIConfig` is gated behind Chromium's developer-only debug-page switch; it serves its three generated assets through `WebUIDataSource::SetRequestFilter`. An immediate first navigation to the custom URL can race Chromium's startup registration in headless mode, so the smoke probe opens `chrome://version/` first and then navigates to Prism.

The Store candidates are [uBlock Origin Lite](https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh?hl=en), observed at version `2026.1006.1931`, and [Dark Reader](https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh?hl=en), observed at version `4.9.133`. Their upstream sources identify an MV3 [declarativeNetRequest manifest](https://github.com/gorhill/uBlock/blob/master/platform/mv3/chromium/manifest.json) and an MV3 [content-script manifest](https://github.com/darkreader/darkreader/blob/main/src/manifest-chrome-mv3.json). On 2026-10-10, `DISPLAY=:100 node scripts/phase0/store_compat.mjs <built chrome>` passed: the built browser installed both from their real Store listings through **Add to Chrome** and its permission prompt. `chrome.developerPrivate.getExtensionsInfo()` reported `ENABLED`, `FROM_STORE`, the expected IDs and those versions. The same profile reopened with both installed at the same versions. Dark Reader inserted ten matching style elements and changed `https://example.com/`'s root background from `rgb(238, 238, 238)` to `rgb(24, 26, 27)`; styling persisted after restart. uBlock Origin Lite's API reported enabled `easylist` and `easyprivacy` rulesets. A test page requested `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` with a unique query; uBlock returned a 307 redirect to its `chrome-extension://ddkjiahejlhfcafbddmgiahcphecmpfh/web_accessible_resources/googlesyndication_adsbygoogle.js` replacement, which loaded with status 200. The redirect occurred before and after restart. Earlier observations that the script element loaded were therefore insufficient evidence of missing filtering: the extension intentionally supplied a replacement script. A separate controlled MV3 DNR fixture blocked its local script with `net::ERR_BLOCKED_BY_CLIENT`, confirming the browser's basic DNR path as well. Neither public Store extension changed version during the test.

On 2026-10-10, `DISPLAY=:100 node scripts/phase0/extension_update_smoke.mjs <built chrome>` passed twice with newly generated signing keys and disposable profiles. The test packed MV3 `1.0.0` and `1.0.1` with the same key, installed `1.0.0` by a genuine X11 file drag onto `chrome://extensions` and the browser permission bubble, and reported it as `ENABLED` with location `UNKNOWN`, not `UNPACKED`. The **Update** button fetched both the local XML feed and `1.0.1` CRX; `getExtensionsInfo()` then reported `ENABLED` version `1.0.1`. A `chrome.storage.local` marker written before the update was present after the update and a browser restart. The isolated page screenshot shows the new version and Chromium's expected off-Store safety warning. The local test signing key, feed, packages, and profile were deleted by the test; no key or profile was added to Git. This proves the packed-CRX updater path under a manual update request; it does not prove automatic Chrome Web Store update timing or a real Store version transition.

`npm run test:extension-persistence -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed for the in-repo MV3 fixture `cfehneehpnafmkejjgemgigeljbemmhn`: its `chrome.storage.local` value survived a browser restart in the same temporary profile. Playwright's default `--disable-extensions` flag had to be removed, and the test now queries `chrome.developerPrivate.getExtensionsInfo()` instead of assuming a command-line extension has a complete `Preferences` record while running. The fixture was loaded through `--load-extension` on both runs. A separate restart without that flag showed the extension absent, so this command-line result by itself proves storage persistence under reloading, not normal installation persistence. The separate UI and Store tests above close that persistence question.

Starting the built browser with `--auto-open-devtools-for-tabs` produced `devtools://` targets titled `DevTools`. CDP-synthesized F12 did not open the browser window's DevTools, and XTest key events did not reach the Chromium window under this host's Wayland session. An isolated Xvfb display resolved that input-path limitation: `DISPLAY=:100 node scripts/phase0/devtools_f12_smoke.mjs <built chrome>` passed with a native XTest F12 press. The rendered docked frontend shows the test page's DOM in Elements and a visible Console tab in `docs/evidence/devtools-f12-linux-20261010.png`. Console command execution itself has not been tested.

The Xvfb `21.1.25-1.1` package was downloaded from the configured CachyOS repository, matched its repository SHA-256 (`c434cbce97ad397a8a9a14a42f33fc8ded1a01db10f5749411dcc00d7519fbc1`), and extracted only into the external work directory. The test display was started with `/home/pawel/coding/prism-chromium-work/tools/xvfb/usr/bin/Xvfb :100 -screen 0 1600x1200x24 -nolisten tcp -ac`; it did not use or capture the user's desktop. `DISPLAY=:100 node scripts/phase0/extension_ui_install.mjs <built chrome>` passed using the native GTK folder chooser. The fixture's storage UUID survived restart without load flags. The test scripts create and delete temporary browser profiles.

## Isolated Phase 1 progress under ADR 0002

The AI WebUI now has a `#settings` view, shared Assistant/Settings navigation, a saved default model ID, and an OS-vault key removal control. Only the bounded model ID is stored in WebUI `localStorage`; the key stays in the existing OS-vault path and is not stored by the settings view. Light/dark UI tokens cover text, surfaces, borders, accent, focus, approval, errors, and the glass header. The header is solid when backdrop blur is absent or reduced transparency is requested. See `docs/design/product-shell-settings.md`. No upstream Chromium file changed for this slice.

After staging the updated Prism-owned `resources.h`, `autoninja -j4 -C out/PrismFeasibility prism/ui/webui:prism_ai_ui chrome` succeeded in 12 seconds with one C++ compile and one relink. `DISPLAY=:100 node scripts/phase0/settings_smoke.mjs <built chrome>` passed for navigation, model persistence across restart, a local-storage inventory containing only `prism.defaultModel`, and no horizontal overflow in a 420-pixel dark viewport. `python3 scripts/phase0/browser_smoke.py <built chrome>` still passed for an ordinary page and `chrome://prism-ai/` with no asset or page errors. See `docs/evidence/phase1-ai-settings-linux-20261010.png` and `docs/evidence/phase1-ai-settings-narrow-dark-linux-20261010.png`. Actual OS-vault removal, OpenAI interaction, Windows rendering, and native browser chrome branding remain unverified or unimplemented; side-panel integration was subsequently tested below.

The same WebUI now has an in-page command palette with static Assistant, Settings, and Stop commands. It does not intercept global Chromium shortcuts. A one-object incremental relink passed. `DISPLAY=:100 node scripts/phase0/command_palette_smoke.mjs <built chrome>` passed for filtering, arrow-key selection, Escape/focus return, navigation, and a 420-pixel dark viewport without horizontal overflow. In a regular temporary profile, a session started with a deliberately fake key, the Stop command became enabled, and it ended the session; no API request was sent. The renderer key input cleared on submit. The settings and ordinary WebUI smoke tests passed again afterward. See `docs/design/command-palette-foundation.md` and `docs/evidence/phase1-command-palette-linux-20261010.png`. A browser-wide shortcut and native toolbar entry are future integration work.

The native Prism AI side panel is integrated through Chromium's global side-panel registry and a dedicated Top Chrome WebUI. See `docs/design/ai-side-panel-shell.md` and `docs/upstream-patches.md`. `gn gen`, `gn check` for the Prism WebUI and side-panel targets, and the incremental `chrome` relink passed on the pinned Linux checkout; the last layout relink completed in 12 seconds (external log: `/home/pawel/coding/prism-chromium-work/prism-panel-layout-build.log`). `DISPLAY=:100 node scripts/phase0/side_panel_smoke.mjs <built chrome>` passed in an isolated profile: opening from the full-tab button rendered the native panel without horizontal overflow, a fake-key session cleared its input, the model default survived closing and reopening, the session and key did not, and incognito could not open the panel. No real API request was sent. See `docs/evidence/phase1-ai-side-panel-linux-20261010.png`. After integration, `settings_smoke.mjs`, `command_palette_smoke.mjs`, `devtools_f12_smoke.mjs`, and `browser_smoke.py` also passed on the source-built binary. The panel and full-tab pages use separate WebUI origins, so their model defaults do not yet synchronize. Windows rendering, a live OpenAI call, and browser-wide keyboard access remain unverified.

## Lightweight Phase 2 read-mode hardening, 2026-10-13

The page-context redactor could leak a credential value from quoted assignments or JSON, such as `api_key="value"`, and from authorization/cookie header lines with whitespace before the colon. A new adversarial host test first failed against the old scanner, then passed after handling quoted and unquoted values, optional key quotes, whitespace, quoted Bearer values, malformed closing quotes, and additional credential field names. See `docs/design/page-context-secret-redaction.md`. `g++ -std=c++20 -O0 -Wall -Wextra -Werror -I. tests/ai/page_context_test.cc prism/ai/page_context.cc -pthread -o /tmp/prism-page-context-test && /tmp/prism-page-context-test` passed. The source was copied into the pinned Chromium overlay and `/home/pawel/coding/prism-chromium-work/depot_tools/autoninja -j1 -C out/PrismFeasibility prism/ai:core` passed with one C++ compilation step in 2.45 seconds. `clang-format --dry-run --Werror` passed using the Chromium style. At the user's request to conserve RAM while other work runs on this host, `chrome` was **not relinked**; the existing browser binary does not include this edit, and browser runtime behavior for it is unverified. Unknown credential names and secrets without a recognizable field remain possible; network and console data require structural redaction before future AI exposure.

### Local current-page read preview — 2026-10-15

`docs/design/local-page-context-preview.md` records a user-invoked, local-only
preview in the native Prism AI panel. It resolves the active HTTP(S) tab in the
browser process, passes its read through the existing task-scoped permission
broker, and displays the bounded, redacted accessibility snapshot without an
API key or OpenAI request. The first browser smoke returned an empty snapshot:
ignored AX layout wrappers were pruning visible descendants. Traversing those
wrappers while still pruning hidden, editable, protected, and text-field
subtrees fixed the read path. A separate duplicate-heading correction removes
an identical static-text child when the parent heading already supplies it.

The C++ host accessibility test compiled with `-Wall -Wextra -Werror` and
passed, including the new ignored-wrapper and heading cases. The pinned Linux
`chrome` target relinked with `-j1`; the final incremental pass completed in
12.45 seconds with one C++ compile and one link. In an isolated X11 browser,
`scripts/phase0/page_context_preview_smoke.mjs` passed for visible text and
origin, redaction of a synthetic inline key, Authorization and Cookie header
lines, omission of a form value and an
`aria-hidden` subtree, fresh content after navigation, a refusal on
`chrome://version/`, and no panel overflow. `side_panel_smoke.mjs`,
`browser_smoke.py`, `devtools_f12_smoke.mjs`, and
`command_palette_smoke.mjs` passed after the first fix; the final heading
change was rechecked by the dedicated preview smoke. The reviewed capture is
`docs/evidence/phase2-page-context-preview-linux-20261015.png`. This proves a
local current-page read on synthetic content only. Selected-tab context,
model summarization and Q&A, live OpenAI API, arbitrary-site fidelity, Windows,
console/network analysis, and the independent Phase 0 gates remain open.

The user also requested first-party SponsorBlock functionality with configurable settings and a built-in ad blocker. `docs/design/built-in-media-controls.md` records the staged approach and distribution, privacy, and YouTube compatibility gates. No SponsorBlock code, ad-blocking rules, or Chromium integration was added in this planning slice.

## Lightweight built-in media policy foundation, 2026-10-13

`prism/media/segment_policy.mjs` is a Prism-owned, dependency-free policy module for SponsorBlock-compatible segment data. It computes a four-hex-character SHA-256 lookup prefix, selects only the exact requested video ID from a prefix response, rejects malformed or oversized data, applies opt-in category settings, keeps Incognito off, respects manual segments when proposing automatic seeks, and bounds undo to the same video and a recent seek destination. No SponsorBlock source code, API response, database, or filter rules were imported. The module performs no network request and cannot affect playback until wired to a browser component.

`npm run test:segment-policy` passed six host tests covering the prefix, exact-ID response selection, malformed/ambiguous data, default and Incognito behavior, overlapping manual/automatic ranges, and undo scope. `node --check` passed for the module and test; `git diff --check` passed. No Chromium source changed and no browser build was run, to conserve RAM while the user works on this host. Integrated browser playback, settings integration, hosted API terms, actual Store extension version change, Windows build, OpenAI API call, and the separate built-in ad blocker remain unverified or unimplemented as applicable.

The second slice added `prism/media/playback_controller.mjs`, a one-video adapter that applies policy decisions to an HTML media element and exposes manual skip and one-use undo. It requires explicit permission for main-video playback and Incognito=false, and suppresses immediate re-skipping after undo. `npm run test:segment-policy` now passes nine host tests. `npm run smoke:media-browser -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed on the source-built Linux Chromium binary: the module loaded over isolated local HTTP, automatically sought across a segment in a generated three-second WebM, and undo returned to the original point without immediately re-skipping. The test server needed HTTP byte-range support for media seeking. This exercises a real `HTMLVideoElement` but the module is not yet bundled into Prism or connected to YouTube. No Chromium relink or large build ran; native integration, live segment lookup, settings UI, API/data terms, and YouTube behavior remain open.

The third slice added `prism/media/youtube_site_adapter.mjs`, limited to exact HTTPS YouTube `/watch` routes and the main player video element. It rejects duplicate or invalid video IDs and lookalike hosts, and withholds seeking while the player's `ad-showing` class is present. `npm run test:segment-policy` passed eleven host tests, including strict route cases. The source-built browser smoke test passed again with a synthetic YouTube-like DOM: an advertisement state produced no seek, then the main-video state sought across the segment and undo returned to the prior time. The test does not access live YouTube or establish compatibility with its current DOM, single-page navigation, Shorts, or Music playback. The module is loaded over local HTTP rather than bundled into the browser; no Chromium source, build output, or upstream patch changed.

The fourth slice separated temporary playback availability from video identity in `prism/media/playback_controller.mjs`. An advertisement or other non-video state can now suspend automatic seeks and manual/undo controls without clearing the undo suppression for the current segment. A true context replacement still resets it. `npm run test:segment-policy` passed twelve host tests, including suspension across an undo. The local source-built Chromium smoke passed after exercising the availability toggle on a real media element. This is not a live YouTube advertisement test; the component still is not bundled, and no Chromium build or relink was run.

The fifth slice added a conservative page observer to `prism/media/youtube_site_adapter.mjs`. It publishes only video-ID, media-element, and playback-availability changes; navigation start suspends playback immediately, a reused media element remains suspended after a video-ID change until new metadata arrives, and a newly mounted ready element may resume. It watches DOM child replacement and only the main player's class attribute, with a 50 ms coalescing timer. `npm run smoke:media-browser -- <source-built chrome>` passed for synthetic navigation events, reused and replaced media, advertisement class changes, and observer cleanup, alongside seek and undo on a real `HTMLVideoElement`. `npm run test:segment-policy` still passed twelve host tests; `node --check` and `git diff --check` passed. This does not prove live YouTube event timing, page compatibility, or native Prism integration. No live API call, source import, Chromium patch, or large build was performed.

The sixth slice added `prism/media/segment_lookup.mjs` with a caller-selected origin boundary and a bounded hashed-prefix response reader. It never sends the exact video ID, refuses disabled/Incognito/all-off requests, omits credentials and referrer, refuses redirects, limits response bytes before JSON parsing, supports cancellation, and passes the decoded data through exact-ID validation. The origin is not selected by page content; HTTP is accepted only for loopback host tests. A local synthetic HTTP server exercised the request path, exact-ID selection, 404, bad JSON, oversized data, HTTP failure, redirect refusal, pre-abort, and in-flight cancellation. `npm run test:segment-policy` passed 18/18 host tests; `node --check` and `git diff --check` passed. No public SponsorBlock request or data import occurred. The official [API/database terms](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License) still need a distribution decision before a production origin is configured. Native component wiring, live service behavior, YouTube playback, and this source change in the built browser remain **unverified**; no Chromium relink was run while the user shares this laptop.

The first built-in ad-blocking slice added `prism/blocking/rule_compiler.mjs` and `docs/design/built-in-adblock-rules.md`. It compiles an opt-in, bounded, structured local bundle into DNR `block` rules with source/version provenance and per-site exclusions. It rejects malformed domains, unsupported resource types, duplicate IDs, arbitrary URL filters, and oversized input. `npm run test:adblock-rules` passed 4/4 host tests. `npm run smoke:adblock-rules -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed against a disposable unpacked fixture in the pinned source-built Linux browser: a synthetic script loaded without the fixture, was blocked by the compiled rule on one local test site with `net::ERR_BLOCKED_BY_CLIENT`, and loaded on an excluded local test site. The script used local DNS mappings and removed its temporary extension and profiles. No imported filter list, remote update, or Chromium source change was involved. This proves the compiled DNR shape in a test extension; **native Prism integration, Incognito isolation, settings UI, filter provenance/update trust, real ad blocking, YouTube playback and anti-adblock compatibility remain unverified**. No browser relink or large build ran while the user shares this laptop.

The second ad-blocking slice added `prism/blocking/signed_rule_update.mjs`. It verifies a bounded synthetic JSON bundle against a caller-pinned Ed25519 public key before parsing and compiling, records the key ID and SHA-256 digest, rejects tampering, unknown keys, noncanonical base64url, invalid UTF-8/rules, source changes, and version rollback, and keeps the prior in-memory candidate on failure. No production key or list is present. `npm run test:adblock-rules` passed 9/9 host tests, including ephemeral-key signing and adversarial packages. `npm run smoke:signed-rule-update -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed: Web Crypto in the pinned source-built browser verified the synthetic bundle and rejected a malformed signature while retaining the previous candidate. This is candidate preparation, **not** a remote update or an atomic DNR installation. A real list provider, key rotation/revocation, persistent last-known-good storage, failed-install rollback, native integration, bundled Prism runtime, and YouTube behavior remain unverified. No large build or relink ran.

The third ad-blocking slice added `prism/blocking/rule_activation.mjs` and final-shape validation for compiled rules. It serializes replacement requests, reads existing dynamic rules, performs one remove-and-add update, verifies readback, and attempts to restore the snapshot if readback differs. Host tests covered successful replacement/disable, invalid candidate, API rejection, mismatch recovery, rollback failure, and overlapping calls; `npm run test:adblock-rules` passed 14/14. `npm run smoke:dynamic-adblock-rules -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in a disposable unpacked extension: a synthetic script loaded before activation, was blocked after dynamic rule installation, loaded on an excluded site, remained blocked after an invalid candidate, and loaded after disabling/clearing the rules. Chromium documents `updateDynamicRules` as atomic on rejection; the host test simulates that failure path, while the browser smoke exercised successful and invalid-candidate paths. No real list, public update, production signing key, or Chromium source patch was added. Native Prism integration, persistence and recovery across restart, Incognito isolation, real ad filtering, and YouTube compatibility remain **unverified**; no large build or relink ran.

The fourth media slice added the versioned settings store in `prism/settings/media_controls_store.mjs` for both segment and ad-blocking preferences, with the decision in `docs/design/built-in-media-settings.md`. Both features default disabled; saved values are limited to validated category actions, toggles, and up to 256 excluded domains. The store calls `chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'})` before access, requires explicit non-Incognito context, rejects malformed/future records, and serializes writes. `npm run test:media-settings` passed 6/6 host tests, including failures, malformed values, and concurrent saves. `npm run test:segment-policy` passed 18/18 and `npm run test:adblock-rules` passed 14/14 after reusing the domain validator. `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed with a disposable unpacked extension and profile: enabled preferences survived browser restart, and a synthetic page content script was denied storage access before and after restart. The temporary profile was removed. This verifies an extension-context storage prototype, **not** a bundled Prism settings UI or native component. No Chromium source or binary changed, and no large build ran. Runtime behavior of eventual Prism integration, live YouTube playback, a real ad list, Windows behavior, hosted SponsorBlock API terms, and the Phase 0 open gates remain unverified.

The next media-settings slice added `prism/settings/media_controls.html`, its local stylesheet, and a trusted options-page controller. It edits both global toggles, all eight segment category actions, and ad-blocking site exclusions through the validated settings store. The revised `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in a disposable MV3 extension: both toggles defaulted off, keyboard entry added a normalized domain, malformed and duplicate domains were rejected, values survived browser restart, a site removal persisted, a malformed saved record locked the form, and a content script remained unable to read storage. The dark 420-pixel layout had no horizontal overflow; see `docs/evidence/media-controls-linux-20261013.png`. The page uses no remote assets or page-visible injection, and its domain labels use DOM text nodes. **This is an extension options-page prototype, not a Prism-native settings entry.** Changes currently take effect after component restart; immediate DNR reconciliation, real filter packages, live YouTube behavior, native Linux/Windows integration, and remaining Phase 0 gates are unverified. The built Chromium binary was unchanged and no large build ran.

The following settings slice added a fixed, authenticated save notification to the MV3 worker. The options page sends no settings payload; the worker checks its own extension ID, the exact options URL, top frame, active document, and regular profile, then reloads trusted settings and the signed package before serial DNR reconciliation. `npm run test:media-settings` passed 10/10 host tests, including forged senders, extra payloads, Incognito and overlapping signals. The revised `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed on the unchanged source-built Linux binary in a disposable extension: saving enabled a synthetic signed DNR rule immediately, blocked a locally served script, honored and removed a site exclusion, survived browser restart, rejected a content-script signal, reported a missing-package apply failure and cleared DNR, and cleared rules when disabled. Temporary keys, profile and fixture were deleted. **Native Prism component registration, coordination with startup/update rule mutations in one worker, production filter packages, live YouTube behavior, Windows, and the remaining Phase 0 gates remain unverified.** No Chromium build or relink ran.

The next ad-blocking slice added `prism/blocking/adblock_rule_owner.mjs`, one queue for startup reconciliation, authenticated options-page saves, and signed update installation. The settings message bridge now invokes only this owner; no page message accepts an update envelope. `npm run test:adblock-rules` passed 33/33 host tests, including a held DNR update with startup/update/settings operations queued together, recovery after a rejected package, and Incognito short-circuit. `npm run test:media-settings` passed 10/10. Both `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` and `npm run smoke:adblock-startup -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in disposable extension fixtures on the unchanged Linux binary. The first exercises an authenticated worker message and immediate local DNR effect; the second routes synthetic startup and package update through an owner in the trusted extension control context. **One production worker instance, native component registration, cross-profile isolation, real filter packages, live YouTube behavior, Windows, and the remaining Phase 0 gates remain unverified.** No Chromium build or relink ran.

The following ad-blocking slice added `prism/blocking/rule_diagnostics.mjs` and a read-only status query through the authenticated options-page message boundary. It compares trusted settings, a reverified signed package and current DNR rules after queued mutations, returning only state, count and signed source/version when active; it does not expose matched requests or browsing URLs. The options page shows this state on load and after save. `npm run test:adblock-rules` passed 36/36 host tests, including active-versus-drift comparison, missing package, disabled state, Incognito, and a status query queued behind a held update. `npm run test:media-settings` passed 11/11, including a forged status query. `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed with a disposable MV3 worker: the UI showed Off, Active with synthetic signed version and one installed rule, Unavailable after package removal, and Off again after disable. `npm run smoke:adblock-startup -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` also passed after the owner gained its read-only status method. The narrow dark screenshot at `docs/evidence/media-controls-linux-20261013.png` shows the diagnostic without horizontal overflow. **Native Prism component integration, real filter source, matched-rule diagnostics for broken sites, live YouTube compatibility, Windows, and Phase 0 open gates remain unverified.** No browser relink or large build ran.

The fifth ad-blocking slice added `prism/blocking/startup_reconciliation.mjs`. In a normal context it loads the trusted settings, re-verifies a supplied signed package using pinned keys, compiles it with the current site exclusions, and reconciles persisted dynamic DNR rules. Disabled/malformed settings and missing/tampered packages clear the rules with readback; DNR failure reports an unknown state. Incognito returns before storage, package, or DNR access. `npm run test:adblock-rules` passed 19/19 host tests. `npm run smoke:adblock-startup -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in a disposable extension on the pinned source-built browser: signed synthetic rules blocked a local script, the exclusion allowed it, rules and settings survived restart, startup re-verification kept them active, a tampered signature cleared them, a valid package restored them, and disabling cleared them. The profile, temporary signing key, and fixture were deleted. This proves the prototype's restart behavior in an extension context. **Prism component installation, persistent signed-package provenance and replay protection, real rules, Windows behavior, Incognito DNR isolation, and YouTube compatibility remain unverified**. The source-built browser binary was not changed or relinked.

The sixth ad-blocking slice added `prism/blocking/signed_package_store.mjs`, a trusted-context cache that re-verifies the signature and rule shape on every load and requires an advancing source version before replacing its cached envelope. Its decision and limits are in `docs/design/built-in-adblock-rules.md`. `npm run test:adblock-rules` passed 23/23 host tests, including restart-like reload, older/same-version rejection, tampering, serialization, storage failure, and Incognito denial. The revised `npm run smoke:adblock-startup -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed with the synthetic signed envelope in restricted `chrome.storage.local`: it survived browser restart, drove DNR re-verification, rejected a tampered stored signature and cleared DNR, then recovered after an explicit trusted test reset. The temporary key, profile, package, and extension were deleted. This is a cache prototype, **not** a remote updater or strong rollback defense against restoration of an entire older browser profile. Activation-before-cache-commit coordination, key rotation/revocation, production rule source, native Prism installation, Windows, Incognito DNR isolation, and YouTube behavior remain unverified. No Chromium relink or large build ran.

The seventh ad-blocking slice added `prism/blocking/signed_rule_coordinator.mjs` to activate a verified newer ruleset with DNR readback before committing its signed envelope to the cache. A failed activation leaves the cache unchanged; cache commit failure re-reads signed storage and restores previous DNR rules, keeps the new rules if the write actually landed, or clears rules when cache state is unknown. Failed rollback is reported as unknown. `npm run test:adblock-rules` passed 30/30 host tests, including DNR rejection, cache failure, lost write acknowledgement, failed rollback, concurrent updates, and Incognito short-circuit. `npm run smoke:adblock-startup -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in the disposable MV3 fixture: a signed synthetic `1.0.0` package persisted across restart, then a signed `1.1.0` package moved the active DNR block from one local test domain to another and updated the cache version. Tampering and disable still cleared active rules. **This is not a network updater or native Prism component**; production list source, independent rollback floor, key rotation/revocation, a single worker owner for startup/settings/update mutations, Windows, Incognito DNR isolation, and YouTube compatibility remain unverified. No Chromium source, browser binary, or large build changed.

The seventh media slice added `prism/media/segment_message_bridge.mjs`, the narrow worker-side message boundary proposed in `docs/design/built-in-media-controls.md`. It accepts only a fixed lookup request and finite duration from the same extension's active top-frame content script in a regular-profile YouTube tab. It derives the video ID from Chromium's current tab URL, never from request data, and loads settings in the trusted context before calling the hashed-prefix lookup. It bounds concurrent lookups and rate-limits repeat requests before storage or network access. Host tests tried extra fields, forged extension IDs, subframes, Incognito, stale document lifecycle, lookalike domains, duplicate video parameters, unavailable settings, and request floods; `npm run test:segment-policy` passed 25/25. `npm run smoke:segment-message -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed with a disposable MV3 fixture and fresh profile: a locally fulfilled synthetic `https://www.youtube.com/watch` page supplied actual Chromium message-sender fields, the worker returned one synthetic segment, a duplicate-`v` URL was refused, and disabling settings stopped lookups. The browser used a local DNS mapping and no public SponsorBlock request or data. This verifies the extension message path, **not** native component registration, live YouTube page behavior, content-script playback wiring, hosted API rights, or a browser relink. The new Prism source is therefore not present in the built browser binary; its prototype ran as a temporary extension.

The eighth media slice added `prism/media/watch_playback_session.mjs` and a worker response that includes only enabled segment actions, with the decision in `docs/design/built-in-media-controls.md`. The content session requires ready main-video metadata and permitted playback, rejects stale route/media/stop responses, validates action annotations, retries a rate-limited lookup at most once, and exposes manual skip and undo methods for a future control surface. Player-class mutations now update playback permission without the tree-mutation delay. `npm run test:segment-policy` passed 32/32 host tests, including stale responses, URL changes, Incognito, conflicting action tags, advertisement suspension, undo, manual action, and retry cancellation. `npm run smoke:segment-message -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in a disposable MV3 fixture: a locally fulfilled synthetic YouTube watch route with a generated three-second WebM received a validated worker response, sought past the synthetic segment, withheld seeking while `ad-showing`, and resumed afterward. The test generated and removed its temporary extension, profile, and media file; the test-only DOM decision marker is not product behavior. **Native Prism component registration, live YouTube behavior, public SponsorBlock data/API rights, a real settings control surface, Windows, Store update, and the OpenAI call remain unverified.** This JavaScript was loaded through the temporary extension into the previously built Chromium binary; no Chromium source was changed or browser relink run on the shared laptop.

The ninth media slice added `prism/media/playback_controls.mjs`, a transient shadow-root button for a validated manual Skip or recent automatic Undo decision. Fixed category labels, a screen-reader announcement, visible focus, an opaque 44-pixel control, a ten-second Undo visibility limit, and removal on suspension or stop keep the prototype bounded. `npm run test:segment-policy` passed 32/32. The revised `npm run smoke:segment-message -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed in a disposable extension on the unchanged source-built Linux browser: the synthetic auto segment showed Undo, ad suspension removed the control, resuming sought past the segment, Undo returned to the earlier position without an immediate repeat, a manual segment showed Skip and sought only after click, and disabling the feature showed no control. The test used only a generated local WebM and synthetic segment response; temporary files and profile were deleted. **Live YouTube layout, native Prism component registration, real SponsorBlock API/data rights, Windows, and Phase 0 open gates remain unverified.** No large build or browser relink ran.

The bundled-component worker slice added `prism/component/worker_runtime.mjs` and an inert entry point at `prism/component/worker.mjs`, following `docs/design/bundled-component-worker.md`. One worker now owns a shared settings store, signed-package store, serialized DNR rule owner, authenticated options-page message handler, and bounded media lookup handler. It reconciles DNR state on cold worker start and lifecycle events before answering known messages. Unknown message types receive a fixed error; no message can install a rule package or select a lookup origin. The product entry point contains no production signing key or segment provider, so these paths remain inactive without later distribution decisions. `npm run test:component-worker` passed 4/4 host integration tests for cold cleanup, authorized dispatch, synthetic hashed-prefix lookup, and Incognito fail-closed behavior. The existing `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed after its disposable fixture began loading this shared worker: options-page saves still applied synthetic signed DNR rules immediately, honored exclusions, survived restart, and rejected content-script storage and settings access. `npm run test:media-settings` passed 11/11, `npm run test:adblock-rules` 36/36, and `npm run test:segment-policy` 32/32. **The entry point is not yet registered as a native Prism component; its production runtime, real rule and segment providers, live YouTube behavior, Windows, Store update, and OpenAI API gate remain unverified.** The browser binary and Chromium sources were unchanged; no large build or relink ran.

The staged component-resource slice added `prism/component/manifest.json` and `prism/component/content_script.js`, with the scope decision in `docs/design/bundled-component-worker.md`. The MV3 manifest names only four HTTPS YouTube hosts, disables Incognito, declares the existing local options page, and makes only five content-side media modules web-accessible. The isolated top-frame script creates one watch session and transient controls, sends only the fixed lookup type plus duration, and removes its UI on page hide; it has no direct API origin or page-visible test marker. `npm run smoke:bundled-component -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed twice during refinement on the unchanged pinned Linux binary. A disposable unpacked copy of the actual product manifest and worker showed both toggles off by default; after opt-in, its unconfigured product worker still installed zero DNR rules, reported no verified package, and showed no segment control. A second disposable copy replaced **only the worker entry point** with a test-only synthetic segment provider: the product content script sought past a local generated WebM segment and its Undo button returned playback. Fixtures, profile, and media were deleted; no public SponsorBlock API or list was used. This proves staged MV3 resource plumbing, **not** native Chromium component registration or live YouTube compatibility. The new files are absent from the built Prism binary until a later Chromium resource patch and relink; production filter provenance, data rights, Windows, Store update, and OpenAI API remain open.

The component identity slice added a dedicated public SPKI key to the staged MV3 manifest and pinned ID `fblecelimojmepieoalinhoeakdfffld` in `docs/design/bundled-component-worker.md`. The pinned Chromium loader requires a manifest public key for native component ID generation; the private half was never written to disk or committed, and this identity is separate from future signed adblock packages. `npm run smoke:bundled-component -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed with both the inert product worker and synthetic test worker; the existing source-built browser reported exactly the pinned ID for both disposable unpacked copies. This proves stable identity calculation and the earlier MV3 smoke behavior, **not** native allowlist/resource registration. No Chromium source was changed, no browser relink or large build ran, and the native runtime gate stays open.

The options page now queries a fixed, authenticated, read-only worker message for segment-provider configuration. It displays a persistent warning for the production worker, a configured indicator for the synthetic provider, and repeats unavailable/unknown status after saving even when ad blocking also fails. The reply contains only a boolean; the options page cannot choose a provider or read its origin. On 2026-10-14, `npm run test:media-settings` passed 12/12 and `npm run test:component-worker` passed 4/4. `npm run smoke:bundled-component -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed for the production and synthetic disposable copies; `npm run smoke:media-settings -- /home/pawel/coding/prism-chromium-work/chromium/src/out/PrismFeasibility/chrome` passed for save, DNR reconciliation, isolation, restart, and narrow dark view. Its updated screenshot is `docs/evidence/media-controls-linux-20261013.png`. An initial bundled smoke exposed that an adblock error hid the segment warning; the save message was corrected before the passing run. This indicator proves only that a trusted worker supplied a provider callback. Remote availability, native component registration, live YouTube, and the new code inside a rebuilt Prism binary remain **unverified**. No browser relink or large build ran.

The native registration preparation added `patches/chromium/0004-prism-media-component.patch` for four narrow upstream files, following `docs/design/bundled-component-worker.md`. It stages the tested MV3 tree as 26 GRIT resources, allowlists the manifest resource ID, and registers the component only for regular Linux/Windows profiles in Chromium's background-component loader. `node scripts/component/check_native_resources.mjs /home/pawel/coding/prism-chromium-work/chromium/src` passed for resource/source/GN parity and manifest references; the patch checker reported all four patches already applied to the pinned checkout. `gn gen out/PrismFeasibility` succeeded with 36,683 targets, and `gn check out/PrismFeasibility //chrome/browser/extensions:extensions` passed. A single-job `autoninja -j1 -C out/PrismFeasibility chrome/browser/resources:component_extension_resources` succeeded in 7.27 seconds with three actions; its generated map lists all 26 Prism paths. A dry run for the two changed C++ objects showed 96 prerequisite actions, so their compilation was deferred until the later user-authorized browser build. At this preparation stage, the native smoke script had only passed a syntax check and native runtime behavior was unverified. The disposable extension smoke was evidence for the resource tree only.

On 2026-10-14 at 11:59 CEST, with the same pinned source and tools, `is_debug=false is_component_build=true symbol_level=0`, and bundled Clang 24.0.0git, a user-level service ran `autoninja -j2 -C out/PrismFeasibility chrome` at lower process priority. The incremental build succeeded in 3m20.86s with 500 local actions and no failures; log: `/home/pawel/coding/prism-chromium-work/build-linux-20261014.log`. The binary reports `Chromium 157.0.8095.0`. The first native smoke attempt was blocked by Playwright's default `--disable-component-extensions-with-background-pages` flag, not a browser compilation error. After removing that test-driver flag, `npm run smoke:native-component -- <built chrome>` passed without `--load-extension`: the component options page reported runtime ID `fblecelimojmepieoalinhoeakdfffld`, both settings defaulted off, an isolated Prism content-script world appeared on a locally fulfilled YouTube watch URL, all five content-side modules returned HTTP 200 from the native resource pack, no unverified DNR rules appeared after enabling, and settings survived a browser restart with zero rules. `python3 scripts/phase0/browser_smoke.py <built chrome>` passed for an ordinary page and `chrome://prism-ai/`; `npm run test:extension-persistence -- <built chrome>` passed for a separate unpacked MV3 extension across restart. The native test uses only local synthetic HTML and an unconfigured product worker. **Live YouTube layout/playback, a real segment provider, production rule package, Incognito component behavior, Windows, Store version update, and live OpenAI API remain unverified.**

## Native shell visual slice — 2026-10-14

`docs/design/native-liquid-glass-shell.md` records the design decision and its
Apple Design Skill review basis. Patch `0005-prism-native-shell-colors.patch`
adds a guarded Chromium color mixer for the Linux/Windows browser frame, tab
states, and toolbar. It leaves extension/autogenerated themes, app windows,
forced colors, and high contrast on Chromium's recipes. This is an opaque
color foundation and does **not** claim native backdrop blur.

The first compile failed because the new mixer used an incomplete
`ui::ColorRecipe` type; adding its header fixed the error. The final incremental
`autoninja -j1 -C out/PrismFeasibility chrome` completed two local actions
(object and link) in 11.64 seconds with no failures. On isolated X11 display
`:101`, the dark screenshot at
`/home/pawel/coding/prism-chromium-work/ui-after-focused-20261014.png`
showed the new frame color `#1C2932` and toolbar color `#2C3942`, compared
with the gray baseline at `ui-before-20261014.png`. The planned foreground
and background pairs measure 5.8:1 or better by WCAG relative luminance.
`python3 scripts/phase0/browser_smoke.py <built chrome>` passed for a normal
page and Prism WebUI; `DISPLAY=:101 node scripts/phase0/devtools_f12_smoke.mjs
<built chrome>` opened the standard DevTools target; and
`npm run smoke:native-component -- <built chrome>` passed its native identity,
isolated script, module, inert-provider, and restart checks.

The first screenshot's empty titlebar area still appeared Chromium gray, so
the initial shell slice was visually incomplete. A disposable profile with
`browser.theme.color_scheme2=1` remained visually dark on this host while the
GTK system theme was active. At this point, light-mode runtime was unverified. High
contrast, reduced transparency, native blur, Windows appearance, narrow-window
layout, and focused keyboard styling still need direct visual checks. No
production material effect or complete UI redesign is claimed.

The follow-up `0006-prism-linux-frame-interior.patch` addresses that specific
GTK paint path. The initial shared `FrameBackground` approach was abandoned
after its header change queued a broad rebuild; the final patch changes only
`opaque_browser_frame_view.cc`. `autoninja -j1 -C out/PrismFeasibility chrome`
passed with two final actions in 35.31 seconds. In the isolated `:101` capture,
the previously gray empty top area at pixel (400, 10) changed from
`rgb(53,53,53)` to the Prism frame `rgb(28,41,50)`; the toolbar remained
`rgb(44,57,66)`. The captured crop is
`docs/evidence/native-shell-dark-linux-20261014.png`. The full capture is
external at `/home/pawel/coding/prism-chromium-work/ui-frame-complete-20261014.png`.
`python3 scripts/phase0/browser_smoke.py <built chrome>` passed the ordinary
page and Prism WebUI, `DISPLAY=:101 node scripts/phase0/devtools_f12_smoke.mjs
<built chrome>` passed F12, and `npm run smoke:native-component -- <built
chrome>` passed the native component identity, script, five modules, inert
providers, and restart. `GTK_THEME=Adwaita:light` alone still resolved to the
dark Prism colors because `ThemeServiceAuraLinux::GetBrowserColorScheme()`
follows the system scheme whenever `extensions.theme.system_theme` selects GTK.
With a disposable profile setting that preference to Chromium's default (`0`)
and `browser.theme.color_scheme2` to light (`1`), the light runtime screenshot
showed the planned frame `rgb(226,235,240)` at (400, 10) and toolbar
`rgb(245,249,251)` at (10, 50). Evidence:
`docs/evidence/native-shell-light-linux-20261014.png`. The same light profile
at a 700 px window width kept the tab, new-tab button, omnibox, and menu
visible; the unsupported-flag banner truncated its text without overlapping
its close button. Evidence:
`docs/evidence/native-shell-light-narrow-linux-20261014.png`. These are visual
smoke checks of the built Linux binary, not a complete accessibility audit.
An isolated `--force-high-contrast` launch kept Chromium's own high-contrast
frame and toolbar instead of Prism's palette: frame `rgb(211,227,253)` at
(400, 10), toolbar white at (10, 50), with tab and omnibox controls visible.
Evidence: `docs/evidence/native-shell-forced-contrast-linux-20261014.png`.
This is a command-line contrast smoke, not an OS accessibility-setting test.
Windows appearance, OS-driven high contrast, keyboard focus, reduced
transparency, and actual translucency remain **unverified**.

The next guarded color-mixer refinement uses Chromium's existing active-tab
stroke and toolbar top separator for one partially transparent edge token. It
does not add new geometry or backdrop blur. The `0005` patch was regenerated
with this change in the same upstream file, so the seven-patch sequence still
passes the idempotent patch checker. `autoninja -j1 -C out/PrismFeasibility
chrome` passed with two local actions in 11.75 seconds. The reusable
`scripts/phase0/native_shell_capture.mjs` created isolated dark, light, and
forced-contrast captures. The dark and light top-bar crops are
`docs/evidence/native-shell-edge-dark-linux-20261014.png` and
`docs/evidence/native-shell-edge-light-linux-20261014.png`; the forced-contrast
probe kept Chromium's colors. Frame/toolbar pixels remained the intended
`#1C2932`/`#2C3942` dark and `#E2EBF0`/`#F5F9FB` light. The edge is subtle at
normal scale; the screenshots were reviewed visually. Ordinary-page/WebUI,
F12, native-component, and branding smoke passed after this relink. Linux
fallback remains opaque, and actual translucency remains unverified.

### Floating active tab material — 2026-10-15

`docs/design/native-floating-tab-material.md` scopes a small native geometry
change. Patch `0011-prism-floating-active-tab.patch` reuses Chromium's detached
rounded highlight path for the active horizontal tab fill and stroke in the
ordinary Prism palette. The hit-test path, layout, pinned/split/grouped/closing
and dragging tabs, image themes, and non-Prism/high-contrast paths are left on
their existing geometry. The patch checker reported all eleven patches
already applied. The final `autoninja -j1 -C out/PrismFeasibility chrome`
incremental build passed in 15.03 seconds with one C++ object and one link.

With three synthetic tabs in an isolated X11 browser, the capture helper
switched tabs by Ctrl+Tab and produced reviewed light and dark captures at
1280 px, a narrow light capture at 700 px, and a forced-contrast capture:
`docs/evidence/native-floating-tabs-{light,dark,narrow,forced-contrast}-linux-20261015.png`.
The active tab is visibly detached from the toolbar in the ordinary light and
dark palettes, labels and controls remain legible at 700 px, and the
forced-contrast palette retains the upstream connected appearance. The
planned active-tab text/surface color pairs calculate to 12.65:1 light and
10.91:1 dark. This is a visual check, not a full accessibility audit. On the
built browser, ordinary-page/Prism WebUI, F12/DevTools, and native media
component smoke tests passed; ordinary-page/WebUI smoke passed again after
the final no-behavior guard optimization. True backdrop blur, compositor
behavior, OS reduced-transparency handling, Windows geometry, and a complete
native UI redesign remain **unverified**.

### Location-bar capsule material — 2026-10-15

`docs/design/native-location-bar-material.md` scopes an opaque second surface
for the existing rounded address field. The regenerated mixer patch `0005`
sets its ordinary dark/light fill to `#20323C`/`#FFFFFF`, and patch `0012`
adds an idle-only blue-gray rim in `LocationBarView::RefreshBackground()`.
Chromium's focus, in-progress input, popup, and high-contrast branches take
precedence. The patch checker reported all twelve patches applied. The pinned
Linux `chrome` target built with `-j1` in 29.35 seconds: two C++ objects and
one relink, with no compiler or linker failure.

On isolated X11 display `:101`, the capture helper produced and visually
reviewed ordinary light/dark 1280 px, light 700 px, forced-contrast, and
selected-address dark captures in
`docs/evidence/native-location-{light,dark,narrow,forced-contrast,focused}-linux-20261015.png`.
The unfocused capsule is distinct from the toolbar, its text and controls
remain legible in the narrow capture, the selected address retains Chromium's
focus outline, and forced contrast retains Chromium's palette. These are
visual observations, not measured contrast or true backdrop translucency.
`browser_smoke.py` passed ordinary page and Prism WebUI; `devtools_f12_smoke.mjs`
passed F12; native component smoke passed identity, isolated script, five
modules, inert providers, and restart. A Playwright keyboard-only attempt to
type through the browser-owned address field timed out; it did not establish
whether physical address entry works. Direct address-bar typing, Windows
rendering, system reduced-transparency behavior, and actual OS backdrop blur
remain **unverified**.

## Native branding string slice — 2026-10-14

`docs/design/native-branding.md` scopes the first name change, and patch
`0007-prism-native-name.patch` changes only `chrome/app/chromium_strings.grd`.
It sets the non-Chrome-for-Testing product and short names, ordinary window
title suffix, first-run title, and app accessible name to Prism. It does not
rename the binary or profile directory, replace the icon, rewrite Chromium's
attribution, or constitute a complete rebrand.

`autoninja -j1 -C out/PrismFeasibility chrome` succeeded with 230 local
resource actions in 1m29.95s; the executable was not relinked because the
string resources are loaded from the rebuilt `.pak` files. The disposable
profile test `node scripts/phase0/branding_smoke.mjs <built chrome>` passed:
the Polish `chrome://version` page labeled the application **Prism Browser**.
The captured application/version row is
`docs/evidence/native-branding-version-linux-20261014.png`.
`python3 scripts/phase0/browser_smoke.py <built chrome>` passed its ordinary
page and Prism WebUI, `DISPLAY=:101 node scripts/phase0/devtools_f12_smoke.mjs
<built chrome>` passed F12, and `npm run smoke:native-component -- <built
chrome>` passed identity, isolated script, five modules, inert providers, and
restart. On isolated Xvfb, X11's `WM_NAME` and `_NET_WM_NAME` remained the
generic `chrome`, so the native window-title suffix itself is **unverified**
there. First-run text, app-menu accessible name, icon, desktop integration,
and Windows appearance are also **unverified**.

## Native logo resource slice — 2026-10-14

`docs/design/native-logo.md` records the original faceted Prism mark and the
limited resource-pack scope. `branding/prism-logo.svg` is the master. The
generated PNGs are 16/32 px at 1×, 2×, and 3×, plus 64/128/256 px unscaled;
`magick identify` confirmed their dimensions. The icon remains clear as a
two-facet silhouette at 16 px. `scripts/dev/install_overlay.py` stages these
files under `chrome/app/theme/` without overwriting unrelated upstream art.
Patch `0008-prism-native-logo-resources.patch` changes three GRIT/GN files and
uses a condition that excludes branded Chrome and Chrome for Testing.

`scripts/dev/apply_chromium_patches.py` reported all eight patches already
applied. The single-job `chrome` command regenerated its Ninja graph and
reported thousands of downstream actions; it was interrupted after three
successful resource actions to respect the current limit on large builds.
There was no compiler failure. The isolated single-job GRIT targets
`chrome/app/theme:theme_resources` and
`chrome/app/theme:chrome_unscaled_resources` then succeeded. The subsequent
`autoninja -j1 -C out/PrismFeasibility chrome` finished successfully in 4.56
seconds, executing three resource-pack actions; the executable itself was not
relinked. Direct inspection of the final `chrome_100_percent.pak` and
`resources.pak` confirmed exact 16/32/128 px Prism PNG bytes and, after gzip
decompression, the Prism SVG. Ordinary-page/Prism WebUI, F12, native-component,
and `chrome://version` naming smoke all passed afterward. An isolated Xvfb
launch displayed a normal browser window, but the X11 window lacked a
`_NET_WM_ICON` property in that environment, so the displayed window-manager
icon is **unverified**. The new-tab favicon still showed Chromium art because
it uses a separate `IDR_NTP_FAVICON` theme resource. WebUI display of the patched
SVG, executable icon, installer/desktop integration, and Windows appearance
also remain **unverified** for this logo change.

## Version-page logo follow-up — 2026-10-15

`docs/design/native-logo.md` records the follow-up decision. The original
Prism mark now has compact 128×32 wordmarks with dark and white text variants,
and 16 px favicons, each rasterized at 1×/2×/3×. Patch
`0009-prism-version-logo.patch` changes only
`components/resources/BUILD.gn` and
`components/resources/version_ui_scaled_resources.grdp`; the GRIT condition
excludes Chrome-branded and Chrome for Testing builds. The overlay stages the
assets under `components/resources/default_*_percent/prism/`.

`autoninja -j1 -C out/PrismFeasibility chrome` passed after GN regeneration:
four local actions in 11.30 seconds, with the remaining graph skipped; no
browser executable relink was required. Final 100% and 200% packs contain the
exact Prism logo, white logo, and favicon PNGs. The generated 300% components
pack also matches, but this Linux `chrome` build does not package a final
`chrome_300_percent.pak`. In the built browser,
`scripts/phase0/version_logo_smoke.mjs` passed in both light and dark mode:
`chrome://version` displayed a 128×32 wordmark and the **Prism Browser** label.
The light and dark page crops were reviewed visually:
`docs/evidence/version-logo-light-linux-20261015.png` and
`docs/evidence/version-logo-dark-linux-20261015.png`. The page still shows
Chromium attribution. Ordinary-page/Prism WebUI smoke passed after the pack
update. At that point the new-tab favicon, installer/desktop icons, native
window-manager icon, Windows appearance, and genuine high-contrast behavior
remained separate, **unverified** branding surfaces.

## New-tab favicon follow-up — 2026-10-15

The decision is appended to `docs/design/native-logo.md`. The original Prism
16 px mark now also provides `IDR_NTP_FAVICON` at 1×/2×/3× in the existing
theme resource patch `0008` (regenerated because it owns the same upstream
file). `scripts/dev/apply_chromium_patches.py` reports all nine patches already
applied. `autoninja -j1 -C out/PrismFeasibility chrome` passed with four local
resource actions in 6.10 seconds and no executable relink. Final 100% and 200%
packs contain exact Prism PNG bytes for the new-tab icon. An isolated headed
Linux session loaded `chrome://new-tab-page/`; visual evidence at
`docs/evidence/new-tab-prism-icon-linux-20261015.png` shows the Prism mark in
the tab. Ordinary-page and Prism WebUI smoke passed afterward. Native
window-manager/desktop and Windows icons remain **unverified**.

## Decisions and limitations

### Custom native navigation controls — 2026-10-16

`docs/design/custom-native-chrome.md` records the user's requirement for
original Prism chrome components, including the navigation bar, buttons,
icons, tabs, and interaction states. The existing palette and active-tab shape
were only a visual foundation. Patch `0013-prism-navigation-button.patch`
wires the first actual Prism-owned Views control on Linux/Windows: custom
back/forward arrow paths and painted idle, hover, and pressed capsules over
Chromium's preserved history actions, accessible labels, and focus behavior.

The pinned Linux `chrome` target relinked with `-j1`; `gn gen` and `gn check`
passed. `native_navigation_button_smoke.mjs` used X11 input to click Back and
Forward through two local HTTP pages and sent Alt+Left; all passed. The
ordinary-page/Prism WebUI, F12/DevTools, and native side-panel smoke tests
passed after the final build. Reviewed dark, light, forced-contrast, and
700 px captures are `docs/evidence/prism-navigation-*-linux-20261016.png`.
Forced contrast uses the upstream flat background, while the new glyphs use
the system icon color. The history context menu, touch behavior, Windows
rendering, true backdrop blur, and the rest of the custom chrome remain
**unverified**. Phase 0's Windows, actual Store update, and live OpenAI gates
remain open.

### Custom native reload and stop — 2026-10-16

The next decision in `docs/design/custom-native-chrome.md` extends the
Prism-owned navigation family to Reload/Stop. The original icon paths and
shared capsule painter live in `prism/ui/native/`; the existing Chromium
`ReloadButton` still controls loading, double-click timing, DevTools menu,
accessibility and metrics. Updated patch `0013` selects the component on
Linux/Windows and adds its Prism-owned sources to the toolbar target.

`gn gen`, `gn check`, patch applicability, and the pinned Linux `chrome`
single-job build passed. `native_reload_button_smoke.mjs` passed a real X11
reload click on a local HTTP page and a Stop click that canceled an eight
second delayed navigation. The back/forward and Alt+Left smoke, ordinary
page/Prism WebUI, F12, and side-panel smokes passed after the build. Reviewed
dark, forced-contrast, and in-flight Stop captures are
`docs/evidence/prism-reload-*-linux-20261016.png`.
The DevTools reload context menu, touch behavior, Windows rendering, and true
translucency remain **unverified**.

### Custom native New Tab control — 2026-10-16

The next documented component decision in
`docs/design/custom-native-chrome.md` puts an original plus glyph and a
Prism-owned inset surface in the horizontal tab strip. Patch
`0014-prism-new-tab-button.patch` changes two Chromium files to select
`PrismNewTabButton` on Linux/Windows. It subclasses Chromium's `NewTabButton`
so the existing callback, menu implementation, focus ring, accessibility
name, tooltip, hit mask, and Linux middle-click flag remain wired. The custom
surface is only painted for Prism's resolved frame colors; forced contrast
and custom themes use Chromium's background. The experimental glass-frame
service retains its transparent path.

`gn gen` made 36,683 targets; `gn check` passed for the New Tab and horizontal
strip targets. The final `autoninja -j1 -C out/PrismFeasibility chrome` build
succeeded in 49.53 seconds with three local actions. The dedicated
`native_new_tab_button_smoke.mjs` used a real X11 click at the browser-owned
control and observed a second tab at `chrome://new-tab-page/`. The ordinary
page and `chrome://prism-ai/` asset smoke, F12/DevTools smoke, and the
idempotent 14-patch check passed after that build. Reviewed dark, light, and
forced-contrast captures are
`docs/evidence/prism-new-tab-*-linux-20261016.png`. A first visual capture
showed an overly tall fill; centering it into a 25 px square corrected the
geometry and was included in the final build and test. The context menu,
Linux middle click, touch and Windows behavior were **unverified** then, as are
the remaining custom tab and toolbar components and true backdrop blur.

On 2026-10-19, the extended New Tab smoke sent a real X11 right-click to the
Prism control. Chromium's context menu opened with New Tab, group, and split
view entries; the menu region changed by 22,014 pixels. Escape restored the
same region to its baseline (zero changed pixels), and the active page and tab
count were unchanged. The check passed two sequential runs after waiting
for Chromium's startup UI to settle; the ordinary left-click New Tab path
passed again. Reviewed evidence:
`docs/evidence/prism-new-tab-context-menu-linux-20261019.png`. An early
comparison raced the startup security infobar and failed despite the menu
closing; the stable test excludes the address row and waits for startup.
No browser source changed, so no rebuild was needed. The menu's style,
middle-click path, touch, and Windows remain **unverified**.

### Custom native tab close affordance — 2026-10-16

The documented next slice in `docs/design/custom-native-chrome.md` adds an
original Prism cross and a restrained hover/press surface for ordinary
Linux/Windows tabs. Patch `0015-prism-tab-close-button.patch` changes three
Chromium files: it makes `TabCloseButton::UpdateIcon()` virtual so selected
and inactive tab color updates retain the Prism icon, selects the subclass
for normal browser windows, and compiles the Prism-owned source in
`tabs:tab_impl`. Chromium still owns close callbacks, the enlarged hit target,
middle-click forwarding, gesture handling, focus ring, and accessible name.
The new surface is guarded by Prism frame colors; forced contrast keeps the
native background and uses the resolved icon foreground color.

`gn gen` made 36,683 targets and `gn check` passed for `tabs:tab_impl`.
The first compilation failed on a missing Views class metadata declaration
in the new subclass; that was added. The full incremental build then passed,
and the final ordinary-window guard relink succeeded with `autoninja -j1`
in 34.23 seconds (two local actions). On that final binary,
`native_tab_close_button_smoke.mjs` clicked the first close control in a
two-tab browser and verified that the second tab stayed open. The native New
Tab smoke, ordinary-page/Prism WebUI, F12/DevTools, idempotent 15-patch
check, script syntax checks, and Chromium-style formatting checks passed.
Reviewed dark idle/hover, light multi-tab, and forced-contrast captures are
`docs/evidence/prism-tab-close-*-linux-20261016.png`. Middle-click
forwarding, touch, pinned/grouped/split/vertical tab behavior, Windows,
and real backdrop blur remain **unverified**.

### Custom native app-menu control — 2026-10-16

The next design decision in `docs/design/custom-native-chrome.md` adds a
Prism-owned compact menu glyph and the shared inset toolbar surface while
retaining Chromium's `BrowserAppMenuButton` menu model, status updates,
keyboard behavior, accessibility, and command dispatch. Updated patch `0013`
only selects the subclass and adds its sources to the existing toolbar target
on Linux/Windows. Expanded status chips keep their upstream appearance.

`gn gen` produced 36,683 targets; `gn check` passed for `toolbar:impl`; and
`autoninja -j1 -C out/PrismFeasibility chrome` passed in 59.41 seconds with
three local actions. `native_app_menu_button_smoke.mjs` clicked the actual
X11 menu button, measured 203,814 changed pixels in the menu region, closed
it with Escape (zero changed pixels from baseline), reopened it, and selected
Settings, which navigated to `chrome://settings/`. Ordinary-page and Prism
WebUI smoke plus F12/DevTools passed on the same binary. Reviewed dark,
light, forced-contrast, and open-menu captures are
`docs/evidence/prism-app-menu-*-linux-20261016.png`. The forced-contrast
surface falls back to Chromium's flat background. The menu rows and product
strings still use Chromium's design. Expanded severity chips, touch,
Windows, and real backdrop blur remain **unverified**; the Phase 0 gates
remain open.

### Custom native profile control — 2026-10-16

`docs/design/custom-native-chrome.md` records the compact profile-button
decision. A `PrismAvatarToolbarButton` subclass adds the shared inset Prism
surface in ordinary Linux/Windows toolbars. Chromium continues to supply
the avatar image, profile/sign-in state, labels, accessibility, menu callback,
and focus behavior. Updated patch `0013` only changes the existing toolbar
source list and construction point.

`gn gen` made 36,683 targets, `gn check` passed for `toolbar:impl`, and
`autoninja -j1 -C out/PrismFeasibility chrome` passed in 58.56 seconds with
three local actions. `native_avatar_button_smoke.mjs` clicked the real X11
profile button, measured 91,978 changed pixels in the bubble region, and
closed the bubble with Escape (zero changed pixels from baseline). Ordinary
page/Prism WebUI, F12/DevTools, and the previous native app-menu smokes passed
on that binary. The patch checker, JavaScript syntax, Chromium-style
formatting, and diff checks passed. Reviewed dark, light, forced-contrast,
and open-bubble captures are
`docs/evidence/prism-avatar-*-linux-20261016.png`. Profile menu contents
and product strings still use Chromium's styling and names. Signed-in,
guest, multiple-profile, expanded-chip, touch, Windows, and true backdrop
blur behavior remain **unverified**; Phase 0 gates stay open.

### Custom optional Home control — 2026-10-16

The documented Home decision in `docs/design/custom-native-chrome.md` adds
`PrismHomeButton` with an original vector outline and shared inset toolbar
surface. The subclass preserves Chromium's command callback, menu,
middle-click trigger, drag-to-set-home path, undo bubble, tooltip, focus,
and accessible name. Updated patch `0013` only adds sources and selects the
control when the user enables Home in the ordinary Linux/Windows toolbar.

`gn gen` made 36,683 targets, `gn check` passed for `toolbar:impl`, and
`autoninja -j1 -C out/PrismFeasibility chrome` passed in 55.97 seconds with
three local actions. The first Home smoke run stopped on a test callback
mistake (`URL` object treated as a string); fixing the test, without a browser
source change, produced a pass: a real X11 click in a temporary profile
with Home enabled navigated to `chrome://new-tab-page/`. Ordinary-page,
Prism WebUI, and F12/DevTools smokes passed on that binary. Reviewed dark,
light, and forced-contrast captures are
`docs/evidence/prism-home-*-linux-20261016.png`. The forced-contrast button
uses Chromium's flat surface. Middle-click, drag-to-set-home, custom Home
URLs, touch, Windows, and true backdrop blur remain **unverified**; Phase 0
gates stay open.

### Custom bookmark page action — built 2026-10-16, checked 2026-10-18

`docs/design/custom-native-chrome.md` records the original outline/filled
Prism star choice. Patch `0016` changes only the icon selected by Chromium's
bookmark page-action controller on Linux/Windows and declares its header in
the existing bookmarks target. The page-action model, click command, bubble,
tooltip, accessible name, color source, and visibility stay upstream-owned.

`gn gen` completed with 36,683 targets; `gn check` passed for
`//chrome/browser/ui/views/bookmarks:impl`; and single-job `chrome` build
passed in 27.21 seconds with two local actions. On isolated X11 display
`:101`, `native_bookmark_action_smoke.mjs` clicked the actual address-bar star
and found the local URL in the temporary profile's Bookmarks file after exit.
The test passed again on 2026-10-18. The reviewed saved-state screenshot is
`docs/evidence/prism-bookmark-bubble-linux-20261016.png`; dark, light, and
forced-contrast outline-state screenshots are
`docs/evidence/prism-bookmark-{dark,light,forced}-linux-20261016.png`.
The outline is visible in each mode and the filled icon is visible with the
Chromium bookmark bubble. Ordinary-page, Prism WebUI, and F12/DevTools smokes
passed on the same binary on 2026-10-18. All 16 patch files were detected as
already applied; JavaScript syntax, Chromium-style C++ formatting, and diff
checks passed.

The bookmark bubble still uses Chromium styling. Removal/editing, persistence
across a second browser launch, touch, animation, Windows appearance, and
full native-chrome redesign remain **unverified**. The independent Phase 0
gates remain open.

### Custom native tab-search control — 2026-10-18

The design note in `docs/design/custom-native-chrome.md` selects a Prism-owned
horizontal tab-search button with an original tabs-and-search glyph and inset
frame surface. Patch `0017` adds the subclass to the existing shared tab-strip
target, selects it only for the horizontal tab-search element on Linux/Windows,
and makes the base icon-update method virtual. Chromium retains the action,
bubble, pin context menu, visibility animation, label, accessibility, focus,
and hit target. Vertical combo controls retain their upstream class.

`gn gen` completed with 36,683 targets; `gn check` passed for
`//chrome/browser/ui/views/tabs/shared:impl`. The first dependency check
identified a missing direct dependency on the existing glass-frame service;
the GN file was corrected before building. A preliminary build was stopped
after its action count was inspected, with no compiler failure. The final
`autoninja -j1 -C out/PrismFeasibility chrome` passed in 1m58s with eight
local actions. `native_tab_search_button_smoke.mjs` clicked the actual X11
control: opening changed 52,411 pixels in the bubble region, and Escape
restored the baseline exactly. Ordinary-page and Prism WebUI smoke plus
F12/DevTools passed on that binary. JavaScript syntax, Chromium-style C++
formatting, diff checks, and the idempotent 17-patch check passed.

Reviewed captures are `docs/evidence/prism-tab-search-{dark,light,forced,narrow,open}-linux-20261018.png`.
The original icon is visible in dark/light/forced contrast and at 700 px; the
custom surface falls back in forced contrast. The tab-search bubble remains
Chromium-styled. Pin-menu behavior, keyboard focus traversal, vertical tab
strip, touch, Windows, real backdrop blur, and complete native-chrome redesign
remain **unverified**. Phase 0 gates remain open.

### Native omnibox Clear all — 2026-10-18

The decision in `docs/design/custom-native-chrome.md` extends the existing
editable omnibox control without replacing its text editor or security/page
actions. Chromium formerly displayed Clear all only when a virtual keyboard
was visible. Patch `0018` shows the existing button for nonempty in-progress
input in ordinary Linux/Windows desktop windows and selects a Prism-owned
crossed-stroke vector for the non-touch state. Its callback, tooltip, color
IDs, border insets, and touch icon remain Chromium-owned.

`gn gen` made 36,683 targets; `gn check` passed for the location-bar target.
The first single-job Linux browser build passed in 49.44s. A real X11 test
revealed the virtual-keyboard-only visibility condition, so that test failed
before the visibility change. After the correction, a second single-job build
passed in 52.14s. An initially intermittent click test exposed a timing race:
the AI page action appeared after the screenshot and shifted the clear button
before the click. The test now lets that layout settle before locating the
glyph. The clean final source was rebuilt on 2026-10-19 (`chrome -j1`, 55.34s,
2 actions). `native_omnibox_clear_smoke.mjs` then passed in dark, light,
forced contrast, and 700 px modes, plus a repeated dark run: X11 typed a probe
into the address bar, clicked its visible Clear all control, and Enter left
the original page unchanged. A source-formatting-only follow-up relink passed
in 51.84s (2 actions); Clear all, ordinary-page/Prism WebUI, and F12 passed
again on that exact binary. The captured pre-click images were reviewed at
`docs/evidence/prism-omnibox-clear-{dark,light,forced,narrow}-linux-20261018.png`.
The glyph is legible in all four and does not overflow at 700 px. The
18-patch idempotence check, Python compile check, JavaScript syntax check,
and `git diff --check` also passed.

Keyboard focus traversal, touch behavior, RTL, screen-reader announcement,
Windows rendering, real backdrop blur, and the complete navigation layout
remain **unverified**. The Windows build, real Store version update, and live
OpenAI API call remain independent Phase 0 gates.

### Prism omnibox Clear all surface — 2026-10-19

The decision in `docs/design/custom-native-chrome.md` adds a Prism-owned
`ImageButton` subclass for the existing clear action. Patch `0019` changes
only its Linux/Windows construction and the location-bar GN source list;
the callback, tooltip, insets, icon color mapping, text editor,
and touch-specific backspace icon remain on Chromium's existing paths.

`gn gen` produced 36,683 targets and `gn check` passed for
`//chrome/browser/ui/views/location_bar:impl`. The first `chrome -j1` build
passed in 57.17s (3 actions). Its forced-contrast hover screenshot showed the
generic ink-drop layer obscuring the glyph. After disabling that layer for
this subclass and adding a system-colored hover outline, the final single-job
`chrome` relink passed in 22.77s (2 actions). The intermediate relocation of
the two upstream hunks also passed a `chrome -j1` relink in 54.61s; all 19
patches then passed the idempotence checker.

On the final binary, `native_omnibox_clear_smoke.mjs` passed in dark, light,
forced contrast, and 700 px modes. A real X11 click cleared typed text and
Enter kept the original page. Reviewed hover captures are
`docs/evidence/prism-omnibox-clear-hover-{dark,light,forced,narrow}-linux-20261019.png`.
The forced-contrast glyph stays visible within a thin outline; the narrow
control does not overflow. Ordinary-page/Prism WebUI and F12/DevTools smokes
passed on the same binary. JavaScript syntax and diff checks passed.

Keyboard focus traversal, screen-reader announcement, touch, RTL, Windows,
and the complete navigation layout remained **unverified** at that point.
The independent Windows build, real Store version update, and live OpenAI API
call remain Phase 0 gates.

### Native omnibox Clear all keyboard route — 2026-10-19

The source-built Linux browser's omnibox popup intercepted Tab for suggestion
navigation in a real X11 probe, so a direct Tab sequence did not reach Clear
all. Escape closed the popup while preserving typed text. One Tab focused the
AI Mode chip; a second focused Clear all with a visible ring. Space cleared
the text, the glyph disappeared, and Enter kept the original page. The
extended `native_omnibox_clear_smoke.mjs` passed that route in dark, light,
forced-contrast, and 700 px modes. The reviewed focus captures are
`docs/evidence/prism-omnibox-clear-focus-{dark,forced}-linux-20261019.png`.
An initial parallel run of light and forced-contrast tests on the same Xvfb
display interfered with both windows and failed; each test passed when run
sequentially, which is the valid isolation for native-focus verification.

This closes the tested Linux keyboard route without changing browser source
or rebuilding it. Shift+Tab traversal, screen-reader announcement, touch,
RTL, Windows, and the complete navigation layout remain **unverified**.

### Native Prism AI action mark — 2026-10-19

`docs/design/native-prism-ai-action.md` records the decision to replace the
generic ChatSpark glyph on the existing pinnable side-panel action with a
monochrome Prism triangle. The label, native toggle, pin state, tooltip, and
icon color ID remain on Chromium's existing action path. Prism owns the vector
in `prism/ui/native/prism_ai_action_icon.h`; the two upstream hunks are folded
into patch `0003` and listed in `docs/upstream-patches.md`.

The overlay sync and all 19 Chromium patch idempotence checks passed. `gn gen`
made 36,683 targets, `gn check` passed for `browser_actions_impl`, and
`autoninja -j1 -C out/PrismFeasibility chrome` succeeded in 58.82 seconds with
one C++ compile and one link action. On isolated X11 display `:101`,
`native_prism_ai_action_smoke.mjs` seeded the action into a disposable
profile's pinned-toolbar preference, captured the real native toolbar, and
clicked the action to open and close `chrome://prism-ai-panel/`. Dark, light,
and forced-contrast runs passed; reviewed captures are
`docs/evidence/native-prism-ai-action-{dark,light,forced}-linux-20261019.png`
and `docs/evidence/native-prism-ai-panel-dark-linux-20261019.png`. The first
light-mode run opened the target but raced its close transition; waiting for
the native panel to render made the repeated light run pass. Ordinary-page and
Prism WebUI asset smoke, F12/DevTools, and the existing panel lifecycle,
model-persistence, and Incognito-exclusion smoke all passed on the final
binary. `node --check`, `clang-format --dry-run --Werror`, and diff checks
passed.

`native_prism_ai_pin_smoke.mjs` then exercised the separate user path without
seeding a preference: the native panel header's pin button persisted
`kActionSidePanelShowPrismAi`, the pinned toolbar action reopened the panel
after a browser restart, and the same header button removed the preference.
The reviewed native capture is
`docs/evidence/native-prism-ai-pinned-linux-20261019.png`. This additional
test changed no browser source and needed no relink.

The seeded and manual pin paths are checked on Linux. Accessibility
announcement, narrow toolbar overflow, touch, RTL, Windows, and live model
interaction remain **unverified**. The
independent Windows build, real Store version update, and live OpenAI API
call remain Phase 0 gates.

### Prism AI native panel header glyphs — 2026-10-19

`docs/design/native-prism-ai-panel-header.md` limits original pin, unpin,
and close vectors to the Prism AI side-panel entry. Existing native buttons,
tooltips, accessibility names, focus, and callbacks remain in control. The
vectors live in `prism/ui/native/prism_side_panel_header_icons.h`; two narrow
upstream hunks extend patch `0003` and are inventoried in
`docs/upstream-patches.md`.

Overlay sync and all 19 patch idempotence checks passed. `gn gen` made 36,683
targets, `gn check` passed for the side-panel target, and
`autoninja -j1 -C out/PrismFeasibility chrome` succeeded in 15.61 seconds
with one C++ compile and one link action. On isolated X11 display `:101`,
`native_prism_ai_pin_smoke.mjs` passed in dark, light, and forced contrast:
the header control pinned Prism AI, the close control hid its panel, the
toolbar action reopened it after restart, and the header control unpinned it.
Reviewed captures are
`docs/evidence/native-prism-ai-header-{dark,light,forced}-linux-20261019.png`.
In forced contrast the hovered pin button's opaque highlight obscured the
glyph; moving the pointer away showed the idle glyph clearly. Ordinary-page
and Prism WebUI asset smoke, F12/DevTools, and the existing panel lifecycle,
model-persistence, and Incognito-exclusion smoke passed on the final binary.
JavaScript syntax, C++ formatting, and diff checks passed.

Windows rendering, touch, narrow panel layout, RTL, assistive announcement,
and a complete custom panel-header layout remain **unverified or future
work**. The independent Windows build, real Store version update, and live
OpenAI API call remain Phase 0 gates.

### Prism AI native panel pin and close surfaces — 2026-10-19

`docs/design/native-prism-ai-panel-controls.md` defines Prism-owned native
button classes for only the Prism AI header pin and close controls. Their
existing callbacks, tooltip/accessibility text, focus behavior, hit target,
and pin state remain in Chromium's controller. The new
`prism/ui/native/prism_side_panel_header_button.{h,cc}` paints opaque Prism
dark/light rounded surfaces with immediate hover/press feedback; unknown
palettes and forced contrast receive a transparent hover outline. The generic
ink drop is disabled for these two controls so it cannot cover their glyphs.
The guarded source entries and conditional construction extend patch `0003`.

`gn gen` created 36,683 targets, `gn check` passed for the side-panel target,
and `autoninja -j1 -C out/PrismFeasibility chrome` passed in 17.75 seconds
with two C++ compiles and one link. Overlay sync and all 19 patch idempotence
checks passed. On isolated X11 `:101`, real native pin, close, restart,
toolbar reopen, and unpin clicks passed in dark, light, and forced contrast.
Reviewed idle captures are
`docs/evidence/native-prism-ai-controls-{dark,light,forced}-linux-20261019.png`;
reviewed hover captures are
`docs/evidence/native-prism-ai-controls-hover-{dark,forced}-linux-20261019.png`.
Native Tab/Shift+Tab navigation focused the close button, and Enter closed
the panel in dark and forced contrast; reviewed focus captures are
`docs/evidence/native-prism-ai-controls-focus-{dark,forced}-linux-20261019.png`.
The forced-contrast pin glyph remains visible on hover. Ordinary-page and
Prism WebUI assets, F12/DevTools, and panel lifecycle/model-persistence/
Incognito-exclusion smokes passed on the final binary. JavaScript syntax and
diff checks passed.

Windows rendering, touch, narrow layout, RTL,
screen-reader announcements, and non-Prism panel visual regression remain
**unverified**. The independent Windows build, real Store version update,
and live OpenAI API call remain Phase 0 gates.

### Prism AI native header shell — 2026-10-19

`docs/design/native-prism-ai-header-shell.md` defines a Prism-owned
`SidePanelHeader` subclass for only the Prism AI entry. It paints an opaque
dark/light material with a subtle top rim and bottom boundary around the
existing title and original pin/close controls. Forced contrast and custom
themes keep the inherited parent surface. The existing flex layout, native
focus order, callback and panel lifecycle remain in Chromium. Patch `0003`
now contains one guarded constructor selection in
`side_panel_coordinator.cc` and two source entries in the side-panel GN target;
`docs/upstream-patches.md` inventories both upstream files.

`gn gen` made 36,683 targets, `gn check` passed for the side-panel target,
and `autoninja -j1 -C out/PrismFeasibility chrome` succeeded in 23.40 seconds
with two C++ compiles and one link. All 19 patch idempotence checks passed.
On isolated X11 `:101`, native pin, close, restart, toolbar reopen, and unpin
passed in dark, light, and forced contrast. Dark and forced runs also used
Tab/Shift+Tab and Enter to close with a visible focus ring. Reviewed native
captures are `docs/evidence/native-prism-ai-header-shell-{dark,light,forced}-linux-20261019.png`,
`docs/evidence/native-prism-ai-header-shell-narrow-native-linux-20261019.png`,
and the corresponding `hover`/`focus` dark and forced captures. A native
700-pixel window kept the header title and controls inside the panel, while
the full-page WebUI reflowed into the remaining width. The earlier fixed
Playwright viewport capture caused artificial clipping and was superseded.
The dark and light design-token text pairs calculate
to 9.59:1 and 12.26:1 contrast, respectively. Ordinary-page/Prism WebUI,
F12/DevTools, and native panel lifecycle/model-persistence/Incognito-exclusion
smokes passed on the final Linux binary. JavaScript syntax and formatting
checks passed.

Windows rendering, non-Prism panel visual regression, touch, RTL, assistive
announcements, and platform blur remain **unverified**. The independent
Windows build, real Store version update, and live OpenAI API call remain
Phase 0 gates.

### Prism native navigation rail — 2026-10-20

`docs/design/native-navigation-rail.md` records a Prism-owned shared surface
behind the existing Back, Forward and Reload/Stop controls. The corner-aware
background subclass and painter live under `prism/ui/native/`; the controls
retain separate hit regions, callbacks, menus, accessible names, focus and
hover/press feedback. A hidden Forward button leaves no empty slot. The rail
is opaque in Prism dark/light palettes; forced contrast and custom themes
retain native painting. Patch `0013` adds one guarded background selection and
four GN source entries; the upstream inventory records both changed files.

An initial public-header approach was interrupted before its several-thousand
dependent C++ compiles finished. The background-subclass approach compiled
after fixing a private-getter call by registering the existing button pointers
at construction. `gn gen` generated 36,683 targets, `gn check` passed for the
toolbar target, and the final `autoninja -j1 ... chrome` passed in 51.30
seconds with ten steps. The checker reported all 19 patches already applied.
The isolated X11 server used a 1.05 MiB user-local `Xvfb` package whose
SHA-256 matched the host's package database; no system package or repository
dependency was added.

On that isolated display, `native_navigation_button_smoke.mjs` passed real
Back/Forward clicks and Alt+Left; `native_reload_button_smoke.mjs` passed
Reload and Stop cancellation of a slow local response. The reviewed
`docs/evidence/prism-navigation-rail-*-linux-20261020.png` captures cover
dark, light, forced contrast, 700 px, hidden Forward and hover. One initial
hidden-Forward single-tab capture showed incomplete tab paint at four seconds;
the ten-second capture settled with normal tab paint and is the retained
evidence. `browser_smoke.py` passed ordinary page and Prism WebUI assets,
`devtools_f12_smoke.mjs` opened F12, and `side_panel_smoke.mjs` passed panel
lifecycle/model persistence/Incognito exclusion on the final binary.

Windows rendering, touch, RTL behavior, custom themes, compositor blur and
assistive announcements remain **unverified**. The Windows build, actual
Chrome Web Store version transition and live OpenAI API call remain Phase 0
gates.

### Prism native overflow control — 2026-10-20

`docs/design/native-overflow-control.md` records a Prism-owned subclass of
Chromium's responsive `OverflowButton` with an original double-chevron glyph
and the shared inset control surface. Patch `0013` gained two guarded GN
source entries and one guarded class selection in `toolbar_view.cc`; the
existing overflow decision, menu model, accessible popup semantics and
alternate WebUI-toolbar mode were not changed. `gn gen` produced 36,683
targets, toolbar `gn check` passed, and `autoninja -j1 ... chrome` passed in
34.84 seconds with three steps. The checker found all 19 patches already
applied; `clang-format`, `node --check` and `git diff --check` passed.

On isolated X11 at a 500 px native window, reviewed dark, light and forced
contrast captures show the responsive control. An XTest click opened the
real menu with Forward, Home and Profile entries; Escape dismissed it.
Evidence is in `docs/evidence/prism-overflow-*-linux-20261020.png`. On the
final binary, ordinary-page/Prism WebUI smoke, F12, native panel lifecycle
and Back/Forward keyboard/click smoke all passed. The screenshot harness
lowered its minimum native width to 320 px and gained optional native
click/Escape controls; these tests used 500 px.

Windows, touch, RTL, keyboard focus traversal, assistive announcement and
custom themes remain **unverified**. Overflow menu rows retain Chromium's
presentation. The independent Phase 0 Windows build, actual Store version
transition and live OpenAI API call remain open.

### Selected-tabs context preview — 2026-10-15

`docs/design/selected-tabs-context-preview.md` records the native-selection,
task-scoped READ and atomic refusal design. Prism WebUI now previews redacted,
bounded visible text from two or three selected HTTP(S) tabs without sending
content to a model. A page navigation, internal tab, profile mismatch, or
invalid selection aborts disclosure. WebUI sends only a fixed command; the
browser resolves tab IDs and navigation entries itself. The two preview
buttons share a busy state and clear pending context on panel hide.

`gn gen` completed with 36,683 targets and `gn check` passed for
`//prism/ui/webui:prism_ai_ui`; the source-built Linux `chrome` target then
linked with `autoninja -j1`. The dedicated
`scripts/phase0/selected_tabs_preview_smoke.mjs` passed on isolated X11 for
two selected tabs, bounded redaction, changed navigation, one-tab and internal
tab refusals, and the four-tab cap. The existing page-context preview,
side-panel, ordinary-page/WebUI and F12 smoke tests passed after the final
C++ build. The reviewed screenshot is
`docs/evidence/phase2-selected-tabs-preview-linux-20261015.png`.
No OpenAI call was made; Windows behavior and a live model workflow remain
**unverified**. No upstream Chromium file changed in this slice.

### Linux installer input slice — 2026-10-15

`docs/design/linux-installer-identity.md` records a separate package identity
for ordinary Linux builds. `branding/chromium-theme/prism/BRANDING`, a Prism
installer info file, and seven Linux icon sizes were staged without modifying
upstream icon files. Patch `0010-prism-linux-installer-inputs.patch` changes
`chrome/installer/linux/BUILD.gn` and one metadata lookup in
`common/installer.py`. It selects these inputs, a `prism-browser` DEB/RPM
name, and a distinct URI scheme for the ordinary unbranded build, preserving
Chrome and Chrome for Testing. Prism Flatpak stays disabled until its app ID
and developer metadata can be changed coherently.

The existing component-build output has no Linux installer targets, so the
first target-only attempt there reported `unknown target`. A separate
`out/PrismInstallerProbe` GN configuration (`is_component_build=false`,
`enable_linux_installer=true`, `symbol_level=0`) generated 36,686 targets.
`autoninja -j1` passed for `common_packaging_files`, `theme_files`, and
`save_build_info` in 2.20 seconds (27 steps); a follow-up after GN formatting
passed in 5.68 seconds (one process-version action). `magick identify`
confirmed 16, 24, 32, 48, 64, 128, and 256 px PNGs; `cmp` matched staged
BRANDING and installer info byte for byte with the repository. Chromium's
installer parser read `PACKAGE=prism-browser`, `MENUNAME=Prism Browser`,
`RDN=io.github.xdziuba.PrismBrowser`, and
`PRODUCT_FULLNAME=Prism Browser`; GN declares
`prism-browser-stable_157.0.8095.0-1_amd64.deb` and the corresponding RPM
output. After the metadata update, the staging target passed again in 1.04
seconds. The pinned installer's own parser selected `prism-browser`, and its
template renderer produced a disposable `.desktop` file with `Name=Prism
Browser`, `Icon=prism-browser`, `StartupWMClass=prism-browser`, and the Prism
URI scheme. The patch checker reports all ten patches already applied.

This proves installer **input generation only**. No DEB/RPM package was built
or installed, no desktop entry or MIME registration was exercised, and the
existing component-build browser executable was not relinked. Its prior
browser runtime smoke evidence does not validate this packaging change.
Public maintainer contact, package signing, release permissions, Flatpak,
AppStream screenshot/metadata, actual window-class matching, Windows
packaging, and the independent Phase 0 gates remain open. The
GitHub no-reply address in the metadata is provisional for a local build.

### AI shell palette alignment — 2026-10-15

`docs/design/ai-shell-palette-alignment.md` records a Prism-owned WebUI
refinement: the original cyan mark replaces a temporary diamond glyph, and
both AI page origins now share cool blue-gray light/dark tokens aligned with
the native browser frame. The header remains the only translucent surface;
solid and reduced-transparency fallbacks remain in CSS. No upstream Chromium
file changed. `autoninja -j1 -C out/PrismFeasibility chrome` passed in 13.27
seconds (one `prism_ai_ui.o` compile and one link action).

On isolated X11 display `:101`, `settings_smoke.mjs` passed model persistence,
storage boundary, and 420 px layout; `command_palette_smoke.mjs` passed its
keyboard and Stop flow; `side_panel_smoke.mjs` passed panel lifecycle and
Incognito exclusion; `browser_smoke.py` passed ordinary-page and WebUI load;
and `devtools_f12_smoke.mjs` opened standard DevTools. Visual review of
`docs/evidence/phase1-ai-settings-cool-light-linux-20261015.png`,
`phase1-ai-settings-cool-dark-narrow-linux-20261015.png`, and
`phase1-command-palette-cool-dark-linux-20261015.png` found legible controls,
the original mark, and no narrow horizontal overflow. Calculated light/dark
card text and control-boundary contrast ratios are in the design note.
Windows appearance, OS-driven contrast, and reduced-transparency rendering
are **unverified** for this follow-up. The full Phase 0 gates remain open.

- Phase 0 stays on full Chromium; Electron, CEF, Qt WebEngine, and packaged Chromium are excluded from build proof.
- The pinned checkout carries the Prism browser-tools, WebUI, and side-panel patches listed in `docs/upstream-patches.md`. The AI session is linked in the browser, and its fake-key start/stop lifecycle was exercised; a real AI conversation remains untested.
- This Linux host exceeds the documented minimum memory but is below Chromium's recommended >16 GiB; the first build uses four parallel jobs.
- A native Windows host and a developer OpenAI API key are independent requirements to close the corresponding gates.
- The checkout and tools remain under `/home/pawel/coding/prism-chromium-work`; the Linux binary has passed the ordinary-page and Prism WebUI smoke tests. The build was incremental after the initial compiler failure rather than a second clean build.
- The 2026-10-10 compatibility probes added no Chromium or Prism product-source changes, so no browser relink was needed. A genuine Store version update, Windows build, and OpenAI API call remain independent gates.

## Repository checks

- `scripts/phase0/preflight.py` passed on this host with the external workspace; it also rejected a workspace inside the repository.
- `bash -n` passed for the Linux bootstrap; Python bytecode compilation passed for both Phase 0 Python scripts; JSON parsing passed for the lock and extension manifest; `node --check` passed for the extension popup script.
- All nine repository skills passed a frontmatter/name check. The bundled `skill-creator` validator could not run because its Python environment lacks `yaml`; its broader validation remains unverified.
- Windows PowerShell bootstrap syntax and behavior remain untested because PowerShell and a Windows host are unavailable here.
- After the tab/page adapters, tool codec, Responses client, session service, OS credential store, and `chrome://prism-ai` WebUI were staged into the pinned checkout, `gn gen` succeeded with 36,683 targets. The four Prism GN targets compiled, `gn check` passed for `//prism/ai:chromium`, `//prism/credentials:credentials`, and `//prism/ui/webui:prism_ai_ui`, and the `chrome` target linked. This proves build integration but not runtime behavior of the AI session, browser tools, or OS vault.
- The host-only broker and page-context test executables pass with C++20, `-Wall -Wextra -Werror`, and pthreads after the async ticket and typed tab-output changes. `clang-format --dry-run --Werror` passes for the touched C++ files. The Chromium adapter compiles and links; its tool execution remains untested in a live browser session.
- `scripts/phase0/devtools_f12_smoke.mjs`, `extension_ui_install.mjs`, `store_compat.mjs`, `dnr_smoke.mjs`, and `extension_update_smoke.mjs` passed on the built pinned browser on 2026-10-10. The X11 scripts used isolated display `:100`; the DNR script compared a local served script with and without its MV3 fixture. The update test checked the fetched feed and CRX, version change, storage, and restart. No second Chromium build was started.

No AI key was written to disk. The OpenAI probe reads `OPENAI_API_KEY` only at invocation and requests `store=false`. A binary now exists, but no same-revision upstream baseline or AI-on measurement has been collected, so no performance claim is made.
