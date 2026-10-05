# Static website sources

Edit page content in `site/pages/` and shared markup in `site/partials/`.
Run `python scripts/build_site.py` to update the committed pages in `docs/`.
The same build generates the overview at the repository root in `index.html`.
It uses a `docs/` base for resources and page links, so the public homepage stays
at `ugimps.com/`. Overview links return to that root from every page.
Run `python scripts/build_site.py --check` to check that generated pages match their sources. CI runs this check.

GitHub Pages continues to serve static HTML without a build server or client-side template fetches. Page-specific scripts remain in each page source; core dependencies share one partial. `nemesis-beta.html` is generated from `nemesis.html`, preserving both URLs, query strings and fragment links.

After each functional change, run the relevant tests before proceeding. `node scripts/run_site_audit.js audit_cleanup_runtime.js` runs a browser-DOM audit with its own static server; the same runner supports the other `audit_*.js` scripts.

Prices come from one shared `docs/data/ge-prices.json` snapshot. The scheduled
GitHub workflow checks its age hourly and contacts the Wiki only when at least
12 hours have elapsed. Failed refreshes keep the last saved snapshot. Visitors
read the committed file from GitHub and retain it in their browser between page
visits; they never contact the Wiki price API. Reading the latest commit avoids
depending on a Pages rebuild for workflow-generated data commits. GitHub may
delay scheduled runs, so prices can remain older than 12 hours until a run succeeds.
