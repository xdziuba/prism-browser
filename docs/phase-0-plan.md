# Phase 0: feasibility plan

## Goal and gate

Prove the master plan's eight prerequisites on the pinned full Chromium source before Phase 1 UI work. A passing result needs a reproducible command, platform, exact binary revision, observable outcome, and evidence path or log summary. The system-installed Chromium package is useful for local tooling checks only.

## Baseline and bootstrap

`chromium.lock.json` pins upstream source and `depot_tools`. Run `python3 scripts/phase0/preflight.py` (or `py -3 ...` on Windows), then `scripts/phase0/bootstrap-linux.sh /absolute/workdir` or `scripts/phase0/bootstrap-windows.ps1 -WorkDir C:\chromium-work`. Both scripts refuse a checkout at an unexpected source revision and sync DEPS to the pin. They do not change this repository.

The bootstrap uses shallow Git history. This avoids fetching the full-history pack that the upstream server advertised as about 76 GiB, but the source plus pinned dependencies still used about 29 GiB on the first Linux host. A complete build requires further disk space; Chromium's upstream Linux instructions require at least 100 GiB free before starting.

Follow the pinned revision's own `docs/linux/build_instructions.md` or `docs/windows_build_instructions.md` for prerequisites. On Ubuntu the upstream dependency installer is `build/install-build-deps.sh`; other distributions need manual dependency mapping. On Windows install the Visual Studio and SDK version required by the pinned source, not an assumed version from current `main` documentation.

## Build proof, per platform

From `<workdir>/chromium/src`, after prerequisites and hooks:

```text
gn gen out/PrismFeasibility --args='is_debug=false is_component_build=true symbol_level=0'
autoninja -j4 -C out/PrismFeasibility chrome           # conservative on 11 GiB RAM
git rev-parse HEAD
out/PrismFeasibility/chrome --version                 # Linux
out\PrismFeasibility\chrome.exe --version             # Windows
```

Use a fresh temporary user data directory for smoke tests. Record the complete GN args, compiler version, success or failure, and build duration. Resource limits are findings, not a reason to mark the build as passed.

After a successful Linux build, run `python3 scripts/phase0/browser_smoke.py <workdir>/chromium/src/out/PrismFeasibility/chrome`. It checks an ordinary local page and the actual Prism WebUI on separate temporary profiles. For the unpacked MV3 storage probe, run `npm ci --ignore-scripts` in this repository and then `npm run test:extension-persistence -- <workdir>/chromium/src/out/PrismFeasibility/chrome`. The npm install supplies only the Playwright driver; it does not download another browser. This automated probe tests storage across restart with the extension loaded on both launches. Use the manual browser procedure below to verify installation persistence and Store behavior separately.

## Browser compatibility probes

1. **DevTools:** launch the built browser, load a local test page, press F12, and confirm the standard Elements and Console panels work. Record a screenshot and any console errors.
2. **Extensions:** load the unpacked `tests/fixtures/persistence-extension` through `chrome://extensions` with Developer mode. Open its popup, press **Save probe**, restart the same profile, and confirm the stored value remains. Also install a selected public extension normally and inspect its relevant behavior and update path. Record extension ID/version and the method used.
3. **Chrome Web Store:** use the selected MV3 candidates [uBlock Origin Lite](https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh?hl=en) (declarativeNetRequest) and [Dark Reader](https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh?hl=en) (content scripts and font settings). Record their installed versions, attempt Store installation in the built browser, and exercise one function of each. Repeat after restart. Treat Store availability, installation, functionality, and updates as separate results. Do not infer Chrome Web Store compatibility from unpacked extensions.
4. **Internal page:** add the smallest isolated `chrome://prism-feasibility` WebUI page to the pinned source, document every touched upstream file and patch in `docs/upstream-patches.md`, then compile and open the page during the deferred full build. Do not count stock `chrome://version` as this proof. The original stock-build-first order was superseded by the user's feature-first decision in ADR 0002.
5. **OpenAI:** with a developer key in `OPENAI_API_KEY`, run `python3 scripts/phase0/openai_probe.py`. It makes one minimal Responses API call with `store=false`. Record success, model, response ID, and status only; never copy the key or response body into a report.

## Scheduling exception

Per ADR 0002, isolated feature work proceeded before the full browser build. The user authorized the full Linux build on 2026-10-09. The gate matrix still determines what is verified; a feature is not browser-tested merely because its host-only code exists. Windows build and browser smoke tests remain outstanding.

## Exit rule

Update `docs/feasibility-report.md` with evidence for Linux and Windows source builds and all compatibility probes. Resolve failures or document an explicit decision before release. Keep unverified feature behavior clearly labeled while the user-authorized scheduling exception is active.

## Primary references

- [Chromium Linux build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md)
- [Chromium Windows build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md)
- [gclient revision sync](https://chromium.googlesource.com/chromium/tools/depot_tools/+/main/gclient.py)
- [OpenAI Responses API create](https://developers.openai.com/api/reference/resources/responses/methods/create)
