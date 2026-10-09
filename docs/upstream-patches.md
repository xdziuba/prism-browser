# Upstream patch inventory

| Upstream file | Purpose | Owner | Evidence | Rebase risk |
| --- | --- | --- | --- | --- |
| `chrome/browser/BUILD.gn` (`source_set("core")`) | Link the isolated `//prism/ai:chromium` source set on Linux and Windows. One guarded GN dependency was added. | Prism AI browser tools | GN generation: 36,683 targets; `gn check out/PrismFeasibility //prism/ai:chromium`: header dependency check OK. No C++ compile or browser runtime test yet. | Low: one guarded dependency must be carried across upstream updates. |
| `chrome/browser/ui/webui/BUILD.gn` (`source_set("configs")`) | Link the isolated Prism AI WebUI target on Linux and Windows. One guarded GN dependency was added. | Prism AI UI | GN generation and `gn check out/PrismFeasibility //prism/ui/webui:prism_ai_ui` passed. No browser runtime test yet. | Low: one guarded dependency in a frequently edited target. |
| `chrome/browser/ui/webui/chrome_web_ui_configs.cc` | Register `chrome://prism-ai` as an internal WebUI on Linux and Windows. A guarded include and registration were added. | Prism AI UI | GN header dependency check passed. The actual page has not run in a Prism binary. | Low to moderate: the registration list changes upstream. |

The patches are saved as `patches/chromium/0001-prism-ai-browser-tools.patch` and `0002-prism-ai-webui.patch` and are applied in the pinned external checkout at `/home/pawel/coding/prism-chromium-work/chromium/src`. Prism-owned files live in this repository and are staged into `src/prism/` by `scripts/dev/install_overlay.py`. `scripts/dev/apply_chromium_patches.py` checks or applies patches idempotently against the locked revision.
