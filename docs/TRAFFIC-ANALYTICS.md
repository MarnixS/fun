# Visitor analytics for ugimps.com

## Current status
Cloudflare Web Analytics is integrated in the shared route script, but **inactive until a site token is supplied**. No historical visitor totals can be recovered from this new integration.

## Activate (no DNS or hosting change)
1. Open https://dash.cloudflare.com/?to=/:account/web-analytics and create a Web Analytics site with hostname `ugimps.com` (manual JavaScript installation).
2. Copy the token from the Cloudflare-provided JavaScript beacon. It is the value of `token`, not an API key.
3. In `docs/assets/site-routes.js`, replace `const analyticsToken='';` with `const analyticsToken='YOUR_SITE_TOKEN';` and commit.
4. Once GitHub Pages publishes the new script, load https://ugimps.com/ and check the browser network requests to `static.cloudflareinsights.com/beacon.min.js` and `cloudflareinsights.com/cdn-cgi/rum`. Check the Cloudflare Web Analytics dashboard for recorded data after processing.

## Site behavior
- The code runs for the live hostname `ugimps.com` and `www.ugimps.com`, not local previews or the github.io mirror.
- The common `site-routes.js` script loads on the public site and feature pages, so page views on these routes can be measured without editing them one by one.
- The maintenance page `/developer` is excluded from tracking.
- The dashboard is available privately inside Cloudflare; the public website never exposes traffic totals.
- Script works independently from game data requests (WOM, Temple, Wiki).
- This does not track identified persons and cannot perfectly distinguish repeat visitors. Treat vendor visitor metrics as estimates under browser protections and ad blockers.

## Useful historical sources
- GitHub repository traffic: https://github.com/MarnixS/fun/graphs/traffic . **This counts repository visitors, not website visitors**; GitHub offers a 14-day window.
- Google Search Console: https://search.google.com/search-console/ . A verification meta tag exists in the site, but access to the actual Search Console property is required to read historical search clicks. Search clicks are not total site visits.
- Cloudflare analytics begins only after token activation. Do not backfill invented statistics.

## Data to watch
Page views, visits/visitors, top pages, referrals, countries, device/browser breakdown and engagement availability vary by Cloudflare's report and plan. Track weekly/monthly trends and feature popularity; do not infer individual human identity from browser metrics.

Docs: https://developers.cloudflare.com/web-analytics/get-started/ and https://developers.cloudflare.com/web-analytics/about/
