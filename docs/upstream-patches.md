# Upstream patch inventory

| Upstream file | Purpose | Owner | Evidence | Rebase risk |
| --- | --- | --- | --- | --- |
| `chrome/browser/BUILD.gn` (`source_set("core")`) | Compile the Prism tab/page adapters, Responses codec/client, and browser-process tool/session services from `//prism/ai/`, and link the independent policy core. Twelve Prism source entries and one GN dependency were added. | Prism AI browser tools | GN generation: 36,679 targets; `gn check out/PrismFeasibility //chrome/browser:core`: header dependency check OK. No C++ compile or browser runtime test yet. | Low to moderate: this large upstream target changes often; reapply the thirteen-line dependency/source addition when updating Chromium. |

The patch is saved as `patches/chromium/0001-prism-ai-browser-tools.patch` and is applied in the pinned external checkout at `/home/pawel/coding/prism-chromium-work/chromium/src`. Prism-owned files live in this repository and are staged into `src/prism/` by `scripts/dev/install_overlay.py`. `scripts/dev/apply_chromium_patches.py` checks or applies the patch idempotently against the locked revision.
