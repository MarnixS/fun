# ugimps.com

The domain setup preserves the existing GitHub Pages frontend and Vercel API helper.
The registration and DNS steps remain pending until a Cloudflare account can be created.

## Registration and GitHub Pages

1. Create the owner's Cloudflare account and verify its email.
2. Register `ugimps.com` for one year through Cloudflare Registrar. Confirm the checkout price, contact information, payment method and renewal setting before purchase.
3. Verify domain ownership for the `MarnixS` GitHub account using GitHub's generated TXT record.
4. Set the custom domain to `ugimps.com` in `MarnixS/fun` → Settings → Pages. Keep the existing publication source. Include the generated CNAME file in future checkouts.
5. Create the records below in Cloudflare. Use **DNS only** and TTL **Auto**. Each IPv4 address is a separate record.

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | marnixs.github.io |

6. Enable Enforce HTTPS in GitHub Pages when its certificate is ready. GitHub Pages redirects `www.ugimps.com` to the configured apex domain.

## Vercel backend

The existing browser API URLs continue to use `united-gimps-temple-proxy.vercel.app`.
No Vercel custom domain is required. The Temple, shared snapshot and goal APIs
must accept the new frontend's origin to preserve refresh and goal editing.

After the owner has registered and verified the domain, set
`UGIMPS_DOMAIN_ENABLED=true` in the Vercel project's **production** environment
and redeploy the API helper from this source. The flag keeps the unowned domain
disabled during preparation. It permits only the HTTPS apex and www origins;
the GitHub Pages origin remains valid. Unrelated origins and originless writes
remain rejected, and goal editing still requires the member's private code.

When preparing the API deployment, include `lib/` and its existing dependency
`docs/assets/wom-store.js`, which the snapshot APIs require. The current
`.vercelignore` excludes `docs/`; use the existing deployment packaging process
or explicitly include that module in the package. Keep existing environment
variables and the production project unchanged.

## Verification

- Check apex and www DNS, HTTPS and the www redirect.
- Open the home page and Collection Log, Levels, Chronicle, Goals, RNG and Nemesis pages.
- Check each API's OPTIONS response with `Origin: https://ugimps.com`.
- Check snapshot manifest reads and the goal editor's authorization from the new site.
- A page load must read the saved baseline without refreshing WOM or Temple. Only an explicit refresh button should publish a new snapshot.
- Browser storage belongs to each origin. Existing local settings and drafts at the GitHub Pages address do not automatically move to the new domain.

Validation: `node scripts/test_site_origins.js`, `node scripts/test_temple_proxy.js`,
`node scripts/test_player_goals.js`, and `node scripts/test_shared_baseline.js`.

References:
- https://developers.cloudflare.com/registrar/get-started/register-domain/
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
