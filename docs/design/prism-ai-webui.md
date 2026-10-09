# Prism AI WebUI entry point

Status: first browser UI slice, 2026-10-09. The pinned Linux browser builds,
and `chrome://prism-ai/` loads with its CSS and JS in the Phase 0 smoke test.
An AI conversation and OS credential-vault interaction remain untested.

`chrome://prism-ai` is a trusted browser-owned page registered through one
WebUI config. It creates an `AiSessionService` lazily for its containing
regular-profile browser window. Only this WebUI handler receives the controls
to start a task, grant or revoke a capability, approve or reject an action,
send a prompt, and Stop. Message arguments have bounded type checks. The page
never renders model or page text as HTML. The API key field is cleared from
the renderer immediately after submission and is not stored by this slice.
Production credential storage will replace manual key entry.

The page can save a key to the OS vault, start from that saved key without
returning it to JavaScript, or remove the saved key. Non-official developer
builds may use `OPENAI_API_KEY` if no vault entry exists.

The page is a compact work surface: persistent title and Stop button,
conversation transcript, current approval, prompt composer, and an action
timeline. The approval must show the concrete operation and target. The
initial visual system uses ink, warm paper, and a restrained copper accent,
with one translucent header surface. It supports light/dark system themes,
visible keyboard focus, a narrow side-panel width, reduced motion, and a solid
background fallback when backdrop blur is unavailable. Text content remains
fully opaque and web content is unaffected.

Upstream surface: `chrome/browser/ui/webui/chrome_web_ui_configs.cc` and
`chrome/browser/ui/webui/BUILD.gn`. The host constant lives in Prism code,
so `chrome/common/webui_url_constants.h` needs no change. Prism files live under
`prism/ui/webui/`. The page is intentionally separate from standard DevTools.
