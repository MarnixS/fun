# ugimps.com

The domain setup preserves the existing GitHub Pages frontend and Vercel API helper.
The owner registered `ugimps.com` through Porkbun on 5 October 2026. Manage the
domain and its DNS in Porkbun. GitHub Pages publishes `main` from the repository
root. The frontend preparation and updated Vercel API are deployed. The root `CNAME`
claims `ugimps.com` for this branch-based Pages site. Porkbun now has the four
GitHub Pages apex addresses and the `www` CNAME shown below, with a 600-second
TTL. The previous parking apex and wildcard records were replaced; mail and
verification TXT records were preserved. Public DNS and an HTTP response from
United Gimps were verified on 5 October 2026. Custom-domain HTTPS certificate
provisioning is still pending.

The root `index.html` renders the Overview directly, keeping the homepage URL at
`ugimps.com/`. The static generator creates it from the same Overview source as
`docs/index.html`; its asset base is `docs/`, and Overview links return to the
repository root. Other existing page URLs remain available.

## Registration and GitHub Pages

1. Confirm `ugimps.com` appears in Porkbun's Domain Management screen. Complete any registrant email verification requested by Porkbun.
2. Deploy the updated Vercel backend and verify its new-origin responses before activating the frontend domain. Changing Pages first can redirect the existing site to a domain whose refresh and goal APIs do not work yet.
3. Add a root-level file named `CNAME` containing exactly `ugimps.com` followed by a newline, then commit it to `main`. For this branch-based Pages source, GitHub supports configuring the domain through this file; a GitHub website login is not required. Wait for the Pages deployment to succeed before changing DNS. Keep this file in subsequent commits. GitHub account-level domain verification with a generated TXT record is also recommended when account settings are available; do not invent that verification value.
4. In Porkbun, open Domain Management, expand the domain's Details, and select the edit icon beside DNS Records. Configure the records below. Porkbun uses a blank Host field for the apex domain (`@` below). Replace conflicting frontend records for these names, and keep the default TTL. Each IPv4 address is a separate record. Preserve verification TXT and unrelated mail records. The frontend's domain routes to GitHub Pages; it should not be assigned to the API-only Vercel project.

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | marnixs.github.io |

5. Enable Enforce HTTPS in GitHub Pages when its certificate is ready. GitHub Pages redirects `www.ugimps.com` to the configured apex domain.

Normal frontend changes continue through GitHub and do not require Porkbun.
Porkbun is needed for domain administration, DNS changes and renewals. Automatic
backend deployments require a verified Vercel Git integration; the existing
production deployment was uploaded through the CLI.

## Vercel backend

The existing browser API URLs continue to use `united-gimps-temple-proxy.vercel.app`.
No Vercel custom domain is required. The Temple, shared snapshot and goal APIs
must accept the new frontend's origin to preserve refresh and goal editing.

`UGIMPS_DOMAIN_ENABLED=true` is configured in the Vercel project's **production**
environment. Production deployment `dpl_FehL7PPNaAVHZnYdRwVWKE4yvuxP` serves the
updated API helper at the existing production URL. The flag alone does not
update an older deployment. It permits only the HTTPS apex and www origins;
the GitHub Pages origin remains valid. Unrelated origins and originless writes
remain rejected, and goal editing still requires the member's private code.

The deployment includes `lib/` and `docs/assets/wom-store.js`, which the snapshot
APIs require. `.vercelignore` allows that shared module while excluding the rest
of the frontend's generated assets. Deploy this source into the existing Vercel
project, preserving its environment variables. Redeploying an older CLI upload
does not include the changes in this branch.

`vercel.json` sets an empty build command because this Vercel project hosts only
the API functions. The repository's Python frontend build belongs to GitHub
Pages, and its scripts are excluded from the Vercel upload.

## Verification

- Check apex and www DNS, HTTPS and the www redirect.
- Open the home page and Collection Log, Levels, Chronicle, Goals, RNG and Nemesis pages.
- Check each API's OPTIONS response with `Origin: https://ugimps.com`.
- Check snapshot manifest reads and the goal editor's authorization from the new site.
- A page load must read the saved baseline without refreshing WOM or Temple. Only an explicit refresh button should publish a new snapshot.
- Browser storage belongs to each origin. Existing local settings and drafts at the GitHub Pages address do not automatically move to the new domain.

Live backend checks passed on 5 October 2026: custom-origin preflights, goals
with publishing enabled, and both saved snapshot manifests. GitHub validation
and Pages deployment for source commit `65491ee6d63febdad0f9111915f6c29d760c5071`
both passed.

Validation: `node scripts/test_site_origins.js`, `node scripts/test_temple_proxy.js`,
`node scripts/test_player_goals.js`, and `node scripts/test_shared_baseline.js`.

References:
- https://kb.porkbun.com/article/64-how-to-connect-your-domain-to-github-pages
- https://kb.porkbun.com/article/68-what-is-dns-and-how-do-i-edit-it
- https://porkbun.com/support/payment_options
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages
- https://vercel.com/docs/project-configuration/vercel-json#buildcommand
