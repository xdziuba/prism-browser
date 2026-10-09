# Phase 0 feasibility report

Updated: 2026-10-09. Baseline: Chromium `d5556885f34d231a63b3138269bc245aa6f6a408`, `depot_tools` `3de62e5b4fe72ecae5eff72356d0527eccb3b8c0`.

## Current environment

The repository initially contained only a README and the master prompt. The current host is CachyOS Linux x86-64 with 11.4 GiB RAM, 11.4 GiB swap, and about 423 GiB free disk at the repository path. Python 3.14.7 and Git 2.55.0 are available. A packaged Chromium 153.0.8010.52 is installed, but `depot_tools`, GN, and `autoninja` were not present at initial inspection. The packaged browser is **not** evidence of a source build or Web Store compatibility of Prism. Windows is not available on this host.

On this host, the Phase 0 bootstrap completed with a shallow Git checkout and DEPS sync. `git rev-parse HEAD` confirmed both locked hashes. The source and dependency checkout occupied about 29 GiB after hooks; `depot_tools` occupied about 1.1 GiB. `gn gen out/PrismFeasibility --args='is_debug=false is_component_build=true symbol_level=0'` succeeded and generated 36,678 targets. A `chrome` build was attempted with `autoninja -j4` and stopped at the user's request after 737 completed actions and no compiler failures. It produced no browser binary. `gn clean` removed partial build artifacts, and a fresh `gn gen` passed again. This is configuration evidence, not a passing Linux build.

## Gate matrix

| Requirement | Status | Evidence / next action |
| --- | --- | --- |
| Chromium builds on Linux x64 | Not yet proven | Pinned checkout and GN generation passed. Full build stopped by user after 737 actions; no binary. External log: `prism-chromium-work/build-linux.log`. |
| Chromium builds on Windows x64 | Not tested | Run the Windows bootstrap and build on a Windows x64 host. |
| Standard DevTools opens with F12 | Not tested | Run the built browser and capture Elements/Console evidence. |
| Extensions can be installed | Not tested | Load the in-repo MV3 fixture and one public extension in the built browser. |
| Selected Chrome Web Store extensions work | Not tested | Select and test two Store extensions, including actual Store installation. |
| Extensions persist after restart; update behavior understood | Not tested | Restart same profile; verify fixture value and public extension version/update path. |
| Custom internal page can be added | Not tested | Add a minimal WebUI page after stock build and record exact patch. |
| Minimal OpenAI Responses API call works | Not tested | Run `openai_probe.py` with a developer key; record status without secrets. |

No Phase 0 product feasibility gate has passed yet. The source and tools pins were read directly from their official Git remotes on 2026-10-09. The OpenAI probe was not run because `OPENAI_API_KEY` is not set on this host.

The user subsequently authorized isolated feature implementation before the full browser build (ADR 0002). This changes work order, not the gate results above. Browser integration and runtime behavior will remain unverified until the deferred builds and smoke tests run.

## Decisions and limitations

- Phase 0 stays on full Chromium; Electron, CEF, Qt WebEngine, and packaged Chromium are excluded from build proof.
- The pinned checkout now has a thirteen-line source/dependency addition in `chrome/browser/BUILD.gn`; see `docs/upstream-patches.md`. The AI session is not yet compiled or reachable from browser UI.
- This Linux host exceeds the documented minimum memory but is below Chromium's recommended >16 GiB; the first build uses four parallel jobs.
- A native Windows host and a developer OpenAI API key are independent requirements to close the corresponding gates.
- The checkout and tools remain under `/home/pawel/coding/prism-chromium-work` for a future build. The generated GN output occupies about 503 MiB after cleanup; no build process remains active.

## Repository checks

- `scripts/phase0/preflight.py` passed on this host with the external workspace; it also rejected a workspace inside the repository.
- `bash -n` passed for the Linux bootstrap; Python bytecode compilation passed for both Phase 0 Python scripts; JSON parsing passed for the lock and extension manifest; `node --check` passed for the extension popup script.
- All nine repository skills passed a frontmatter/name check. The bundled `skill-creator` validator could not run because its Python environment lacks `yaml`; its broader validation remains unverified.
- Windows PowerShell bootstrap syntax and behavior remain untested because PowerShell and a Windows host are unavailable here.
- After the tab/page adapters, tool codec, Responses client, and session service were staged into the pinned checkout, `gn gen` succeeded with 36,679 targets and `gn check out/PrismFeasibility //chrome/browser:core` passed. This validates target wiring and header dependencies, not C++ compilation.
- The host-only broker and page-context test executables pass with C++20, `-Wall -Wextra -Werror`, and pthreads after the async ticket and typed tab-output changes. `clang-format --dry-run --Werror` passes for the touched C++ files. The GN-integrated Chromium adapter remains uncompiled at the user's request.

No AI key was written to disk. The OpenAI probe reads `OPENAI_API_KEY` only at invocation and requests `store=false`. No browser runtime behavior or performance impact can yet be measured because no Prism binary exists.
