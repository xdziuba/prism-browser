# Media and ad-blocking settings store

Status: isolated settings-store slice, 2026-10-13. Native settings UI and bundled component integration are pending.

## Decision

The future bundled browser component owns one versioned `chrome.storage.local` record for SponsorBlock-compatible segment preferences and the separate ad-blocking preferences. Store only global toggles, category actions, and explicit disabled-site domains; never store video IDs, visited URLs, page content, API responses, credentials, or filter packages in this record. Both features default off. Segment category defaults preserve the existing policy (`sponsor` auto, others off) but have no effect until the global segment toggle is enabled. Ad blocking has its own toggle and bounded site-exclusion list. The source of settings is trusted component UI, never a page or content script.

Before reading or writing, call `storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'})`. Chrome documents that `storage.local` is otherwise accessible from content scripts and persists across browser restarts. A failed access-level setup or storage read must yield disabled defaults. Incognito must explicitly pass `false` to the store; any other value disables reads and writes, regardless of what is stored in a shared or split profile. A save requires a complete version-1 object with exact keys and validated values, then writes one storage key. Malformed or future-version records are not migrated silently: load returns disabled defaults and a fixed error tag. Serializing saves prevents overlapping UI actions from overwriting each other out of order within one component instance.

Host tests will cover defaults, round-trip, validation, storage failure, concurrency, and Incognito. A disposable extension in the existing source-built Chromium will check persistence after restart and that a content script cannot read the settings after access restriction. These tests do not add a Prism settings page or component. A future native UI bridge must authenticate message source, validate every requested edit, enforce the same Incognito rule, and trigger DNR reconciliation when the ad-blocking toggle/site exceptions change. The product build and Linux/Windows UI smoke tests remain gates.

Reference: [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).
