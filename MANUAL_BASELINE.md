# Shared manual baseline repair

The existing refresh buttons only saved data in the current browser. A successful refresh therefore could not become the website baseline for other visitors. Browser loads also chose whole WOM documents by fetch time, allowing a late stale or incomplete document to replace newer per-player history.

The repair keeps the existing pages and controls. Their manual actions call `api/shared-data.js`, which fetches trusted WOM or Temple data and commits the result to the existing repository snapshot files. GET requests only return a pointer to saved data; they never refresh either upstream. Every page reads the same immutable GitHub commit through the common loader.

WOM refreshes one member per request and saves each successful member independently. Missing player data and failed detail requests preserve previous values. Concurrent writes use GitHub file SHAs, reload after conflicts, and merge by source timestamps. History remains deduplicated by timestamp, including WOM's sentinel IDs. IndexedDB saves also merge inside one transaction. The old navigation migration that deleted browser Collection Log data has been removed.

Full WOM history already exceeds 4.5 MB. The API returns a small commit receipt; browsers download the complete JSON from the immutable GitHub raw URL. No history truncation or function response size workaround is required.

## Deployment order

1. Deploy this branch's backend to the existing `united-gimps-temple-proxy` Vercel project. Its production environment needs `DATA_GITHUB_TOKEN` with Contents read/write access to `MarnixS/fun`; the existing `GOALS_GITHUB_TOKEN` is supported as a fallback. Never put either token in browser code.
2. Verify GET `/api/shared-data?source=wom` and `?source=temple` return commit receipts. Verify one manual POST for each source commits and returns a readable snapshot. GET must not contact WOM or Temple.
3. Publish the frontend changes to `main` only after the backend is ready. This avoids pointing live refresh buttons at an unavailable endpoint.
4. Verify the manual buttons on the live site and reload from a separate browser. The success message must say the update is saved for everyone.

## Verification

- `pnpm test`: existing proxy/history/goal tests and shared backend, conflict, failed-save, large-history, partial-response and IndexedDB regressions.
- `pnpm test:ui` with `docs` served at port 8123: existing site audits plus independent visitors, both WOM buttons, repeated Temple updates, source isolation, seven-page baseline consistency and manual-only requests.
- `python scripts/check_site.py`: resources, IDs, script order and existing saved-data integrity.

The original separate-visitor regression failed before the repair and passes after it. Existing design assets, shared goals and committed baseline JSON are unchanged by this patch. Browser inspection reproduced a successful production Temple refresh that remained local. Real-browser verification of the repaired production service requires its Vercel deployment first.
