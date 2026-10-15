# Linux installer identity, resource preparation

2026-10-15. Phase 1 native identity under ADR 0002. The source-built Linux
browser already has Prism resource-pack logos and visible product strings.
Its Linux installer inputs still copy Chromium icons and metadata.

## Decision

Give the ordinary unbranded Linux package a distinct `prism-browser` identity
and original Prism icons without altering Chrome or Chrome for Testing. Keep
the executable filename `chrome`, because the package launcher already wraps
that binary. Use `/opt/prism-browser`, `io.github.xdziuba.PrismBrowser`, and a
separate `prism-browser` package name and URI scheme so installation can
coexist with Chromium.
Preserve the Chromium authorship and license information in package metadata.
The source repository is the project and issue URL. A public maintainer
contact and signing policy are release gates. The package template uses the
repository owner's GitHub no-reply address as provisional build metadata;
distribution requires an explicit maintainer contact review.

Stage Prism-owned `BRANDING`, Linux icon sizes, and installer info via the
existing overlay. A narrow GN patch selects these only for ordinary builds;
the standard installer script continues to consume its expected
`chromium-browser.info` output filename. Disable Prism Flatpak generation until
its hard-coded Chromium app ID, command, and developer identity are addressed.
This slice prepares package inputs; it does not install a package or claim
desktop integration. The installer may read the optional Prism URI scheme from
metadata while other unbranded packages keep their Chromium default. Before
release, replace the inherited Chrome AppStream screenshot and confirm the
desktop startup class against a real installed window.

## Verification

Render icons from the single SVG master. Check dimensions and identity fields.
Generate GN, build only `common_packaging_files`, `theme_files`, and
`save_build_info` with one job, then inspect their staged outputs. Keep the
full DEB/RPM package build, installation, MIME registration, window-manager
matching, and release metadata for a separate validation stage.
