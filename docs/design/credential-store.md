# OpenAI credential storage

Status: Linux and Windows source implementations wired into the trusted WebUI,
2026-10-09. The Linux source now compiles in the pinned Chromium target after
fixing its schema terminator and static loader holder. Neither platform has
been tested against an OS vault; Windows compilation is still outstanding.

The browser keeps the API key in memory for a running AI task. Persistent
storage uses an operating-system credential vault: Secret Service through
libsecret on Linux and Credential Manager on Windows. The vault entry is
identified by Prism Browser and a fixed OpenAI account name. It is never
written to profile preferences, command-line arguments, logs, or the model
conversation.

All vault operations run off the browser UI thread. Linux dynamically loads
the system `libsecret-1.so.0` against Chromium's bundled headers, avoiding a
build-time dependency on a package absent from Chromium's Linux sysroot. A
failed or unavailable vault is reported to the UI; the browser never falls
back to a plaintext file. `OPENAI_API_KEY` is accepted only in non-official
developer builds and only when no saved credential exists.

The trusted `chrome://prism-ai` page offers save, load, and remove controls.
Loading a saved key starts the session in the browser process; the key is not
sent back to JavaScript. The transient key input remains available. Linux
Secret Service availability varies by desktop session; real runtime tests must
cover a locked collection, no service, and an unlocked collection. Windows
Credential Manager behavior requires a Windows x64 host.
