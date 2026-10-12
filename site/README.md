# Static website sources

Edit page content in `site/pages/` and shared markup in `site/partials/`.
Run `python scripts/build_site.py` to generate public pages at the repository
root and compatibility copies in `docs/`. GitHub Pages serves the root HTML
files at extensionless URLs such as `ugimps.com/cumulative-xp`. Each public
page uses a `/docs/` base for shared assets and data, while feature links point
to clean root paths. `site/route-client.js` also cleans links rendered by scripts
and forwards old `/docs/` bookmarks on the public domain. Legacy docs remain
usable in offline previews. Query strings and functional tab fragments survive;
presentation-only summary fragments become scroll targets without appearing in
the URL. Canonical links and the root sitemap list the clean public URLs.
Run `python scripts/build_site.py --check` to check that generated pages match their sources. CI runs this check.

GitHub Pages continues to serve static HTML without a build server or client-side template fetches. Page-specific scripts remain in each page source; core dependencies share one partial. `nemesis-beta.html` is generated from `nemesis.html`, preserving both URLs, query strings and fragment links. `collection-log.html` is the released Collection Log Classic; `clog-beta.html` remains a compatibility alias and forwards to `/collection-log`.

`python scripts/build_favicon.py` exports square browser and touch icons from
the existing Group Ironman helmet (requires Pillow). The exported files are
committed; the normal site build does not require Pillow. Run
`node scripts/test_clean_routes.js` after changing routes or navigation.

After each functional change, run the relevant tests before proceeding. `node scripts/run_site_audit.js audit_cleanup_runtime.js` runs a browser-DOM audit with its own static server; the same runner supports the other `audit_*.js` scripts.

Prices come from one shared `docs/data/ge-prices.json` snapshot. The scheduled
GitHub workflow checks its age hourly and contacts the Wiki only when at least
12 hours have elapsed. Failed refreshes keep the last saved snapshot. Visitors
read the committed file from GitHub and retain it in their browser between page
visits; they never contact the Wiki price API. Reading the latest commit avoids
depending on a Pages rebuild for workflow-generated data commits. GitHub may
delay scheduled runs, so prices can remain older than 12 hours until a run succeeds.

XP Records reads saved WOM snapshots through the shared store. Its pure model
finds the largest observed gain within rolling 1/7/30/90/180/365-day windows;
unknown metrics and counter corrections do not create gains. The page shows
endpoints and actual observed spans, because sparse history cannot establish
exact all-time records. Run `node scripts/test_xp_records.js` and
`node scripts/audit_xp_records.js` when changing this feature.
