# Chromium tab tool adapter

Status: source and GN integration, 2026-10-09. Not compiled or browser tested.

The first Chromium adapter is scoped to the current browser window's tab strip.
It uses Chromium session tab IDs rather than strip indices, which can change
when tabs move. A weak browser-window reference prevents calls after window
destruction. All methods run on Chromium's UI thread.

`Inspect` accepts only list, open, close, and activate. It checks the live
profile for Off the Record mode, refuses invalid or credential-bearing URLs,
and resolves tab IDs in the current window. Open requests are treated as
consequential and require the broker's one-use approval. Close always requires
approval under the tool descriptor. `ExecuteTicket` checks cancellation and
re-inspects immediately before acting. Unsupported tools fail closed.

The typed list output contains only tab ID, active state, and HTTP(S) origin.
It never contains a page title, URL path, query, fragment, or user info. Open
and close return typed acknowledgements for dispatching the browser request,
because navigation and unload handling may complete later. The broker audit
stores no tab arguments or output.

The broker now separates authorization from completion: `Submit` or `Approve`
returns a trusted execution ticket; an adapter calls `Complete` once its work
finishes. This shape supports Chromium's asynchronous accessibility snapshot
API. Stop signals all live tickets; a completion after Stop cannot deliver
output to AI. A completed browser action is still recorded as completed even
if Stop arrived before its acknowledgement.

The adapter and `ChromiumBrowserToolService` are now source inputs of
`//chrome/browser:core`. The service has the broker, audit, and adapter and
dispatches tickets immediately for these synchronous tab operations. No
browser-window owner constructs it yet, and no trusted UI grant/approval
controls are wired. The service is therefore not reachable in a running
browser. Next integration work is that UI entry point, the asynchronous AX
snapshot path, and then the deferred full Chromium build and browser tests.
