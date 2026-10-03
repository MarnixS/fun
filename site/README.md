# Static website sources

Edit page content in `site/pages/` and shared markup in `site/partials/`.
Run `python scripts/build_site.py` to update the committed pages in `docs/`.
Run `python scripts/build_site.py --check` to check that generated pages match their sources. CI runs this check.

GitHub Pages continues to serve static HTML without a build server or client-side template fetches. Page-specific scripts remain in each page source; core dependencies share one partial. `nemesis-beta.html` is generated from `nemesis.html`, preserving both URLs, query strings and fragment links.

After each functional change, run the relevant tests before proceeding. `node scripts/run_site_audit.js audit_cleanup_runtime.js` runs a browser-DOM audit with its own static server; the same runner supports the other `audit_*.js` scripts.
