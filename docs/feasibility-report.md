# Phase 0 feasibility report

Updated: 2026-10-09. Baseline: Chromium `d5556885f34d231a63b3138269bc245aa6f6a408`, `depot_tools` `3de62e5b4fe72ecae5eff72356d0527eccb3b8c0`.

## Current environment

The repository initially contained only a README and the master prompt. The current host is CachyOS Linux x86-64 with 11.4 GiB RAM, 11.4 GiB swap, and about 423 GiB free disk at the repository path. Python 3.14.7 and Git 2.55.0 are available. A packaged Chromium 153.0.8010.52 is installed, but `depot_tools`, GN, and `autoninja` were not present at initial inspection. The packaged browser is **not** evidence of a source build or Web Store compatibility of Prism. Windows is not available on this host.

On this host, the Phase 0 bootstrap completed with a shallow Git checkout and DEPS sync. `git rev-parse HEAD` confirmed both locked hashes. The source and dependency checkout occupied about 29 GiB after hooks; `depot_tools` occupied about 1.1 GiB. `gn gen out/PrismFeasibility --args='is_debug=false is_component_build=true symbol_level=0'` succeeded and generated 36,678 targets. A `chrome` build was attempted with `autoninja -j4` and stopped at the user's request after 737 completed actions and no compiler failures. It produced no browser binary. `gn clean` removed partial build artifacts, and a fresh `gn gen` passed again. This is configuration evidence, not a passing Linux build.

## Gate matrix

| Requirement | Status | Evidence / next action |
| --- | --- | --- |
| Chromium builds on Linux x64 | Not yet proven | The full build reached 52,872 actions and failed on Prism code; fixes passed targeted compilation and the incremental `chrome` build is running again. No binary yet. External log: `prism-chromium-work/build-linux.log`. |
| Chromium builds on Windows x64 | Not tested | Run the Windows bootstrap and build on a Windows x64 host. |
| Standard DevTools opens with F12 | Not tested | Run the built browser and capture Elements/Console evidence. |
| Extensions can be installed | Not tested | Load the in-repo MV3 fixture and one public extension in the built browser. |
| Selected Chrome Web Store extensions work | Not tested | Select and test two Store extensions, including actual Store installation. |
| Extensions persist after restart; update behavior understood | Not tested | Restart same profile; verify fixture value and public extension version/update path. |
| Custom internal page can be added | Not tested | Add a minimal WebUI page after stock build and record exact patch. |
| Minimal OpenAI Responses API call works | Not tested | Run `openai_probe.py` with a developer key; record status without secrets. |

No Phase 0 product feasibility gate has passed yet. The source and tools pins were read directly from their official Git remotes on 2026-10-09. The OpenAI probe was not run because `OPENAI_API_KEY` is not set on this host.

The user subsequently authorized isolated feature implementation before the full browser build (ADR 0002), then authorized resuming the full build on 2026-10-09. This changes work order, not the gate results above. Browser integration and runtime behavior remain unverified until the build and smoke tests pass.

At 15:33 CEST, the Linux `chrome` build started from the pinned checkout with `is_debug=false is_component_build=true symbol_level=0` and `autoninja -j4 -C out/PrismFeasibility chrome`. The user-level systemd service is `prism-build-linux-20261009.service`; its log is `/home/pawel/coding/prism-chromium-work/build-linux.log`. The source and `depot_tools` HEADs matched `chromium.lock.json`, and the overlay and upstream patches were already in place. The build is still in progress, so no binary or browser gate is claimed. `scripts/phase0/browser_smoke.py` is ready to check an ordinary local page and `chrome://prism-ai` with fresh temporary profiles after the binary exists.

The first full attempt ended at 21:51 CEST after 22,628 seconds, with 52,872 completed actions and one failed Prism object: `credential_store_linux.o`. Chromium's bundled libsecret header requires an enum constant for the schema terminator, and `base::NoDestructor` rejects the trivially destructible dynamic-loader holder. Both were corrected in Prism-owned code. Incremental compilation then exposed Chromium Clang-plugin style errors in the host-only broker header, an `override` omission, the pinned revision's renamed `base::DictValue` and `base::ListValue` APIs, an updated `SimpleURLLoader` callback type, and incomplete type and namespace qualifications. The revised `//prism/ai:core`, `//prism/ai:chromium`, `//prism/ui/webui:prism_ai_ui`, and `//prism/credentials:credentials` targets compile, and `gn check` passes for the latter three. The full `chrome` build has been resumed incrementally; its success and runtime behavior remain unverified.

The Store candidates are [uBlock Origin Lite](https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh?hl=en), listed at version `2026.1006.1931` on 2026-10-09, and [Dark Reader](https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh?hl=en), listed at `4.9.133`. Their upstream sources identify an MV3 [declarativeNetRequest manifest](https://github.com/gorhill/uBlock/blob/master/platform/mv3/chromium/manifest.json) and an MV3 [content-script manifest](https://github.com/darkreader/darkreader/blob/main/src/manifest-chrome-mv3.json). This only selects candidates; no Store install, behavior, restart, or update has been observed in Prism. The automated `scripts/phase0/extension_persistence.mjs` probe is prepared for the unpacked fixture after the binary exists.

## Decisions and limitations

- Phase 0 stays on full Chromium; Electron, CEF, Qt WebEngine, and packaged Chromium are excluded from build proof.
- The pinned checkout now has a one-line Prism dependency in `chrome/browser/BUILD.gn` and two narrow WebUI patches; see `docs/upstream-patches.md`. The AI session and `chrome://prism-ai` page compile as individual targets, but have not yet been linked or run in a Prism binary.
- This Linux host exceeds the documented minimum memory but is below Chromium's recommended >16 GiB; the first build uses four parallel jobs.
- A native Windows host and a developer OpenAI API key are independent requirements to close the corresponding gates.
- The checkout and tools remain under `/home/pawel/coding/prism-chromium-work`; the Linux build is currently running there. No Chromium binary has yet passed a smoke test.

## Repository checks

- `scripts/phase0/preflight.py` passed on this host with the external workspace; it also rejected a workspace inside the repository.
- `bash -n` passed for the Linux bootstrap; Python bytecode compilation passed for both Phase 0 Python scripts; JSON parsing passed for the lock and extension manifest; `node --check` passed for the extension popup script.
- All nine repository skills passed a frontmatter/name check. The bundled `skill-creator` validator could not run because its Python environment lacks `yaml`; its broader validation remains unverified.
- Windows PowerShell bootstrap syntax and behavior remain untested because PowerShell and a Windows host are unavailable here.
- After the tab/page adapters, tool codec, Responses client, session service, OS credential store, and `chrome://prism-ai` WebUI were staged into the pinned checkout, `gn gen` succeeded with 36,683 targets. After the first full-build errors were repaired, the four Prism GN targets compiled and `gn check` passed for `//prism/ai:chromium`, `//prism/credentials:credentials`, and `//prism/ui/webui:prism_ai_ui`. This validates target compilation and header dependencies, not a linked browser or runtime behavior.
- The host-only broker and page-context test executables pass with C++20, `-Wall -Wextra -Werror`, and pthreads after the async ticket and typed tab-output changes. `clang-format --dry-run --Werror` passes for the touched C++ files. The GN-integrated Chromium adapter compiles as an individual target; browser runtime checks remain pending.

No AI key was written to disk. The OpenAI probe reads `OPENAI_API_KEY` only at invocation and requests `store=false`. No browser runtime behavior or performance impact can yet be measured because no Prism binary exists.
