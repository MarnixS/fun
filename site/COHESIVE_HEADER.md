# Cohesive Old School header

The Old School header uses the approved `129773.jpg` artwork as one banner.
An edge mask reveals the existing repeating page pillars in place of the
supplied pillar strips. The same body background continues through the header,
so there is no second painted copy to align or resample. The inner edge fades
into the courtyard; the old rectangular border image is disabled. Status cards
retain their previous content width.

The supplied artwork is unchanged:

- Asset: `docs/img/osrs-theme/united-gimps-cohesive-banner.jpg`
- Dimensions: 1536 × 512
- SHA-256: `f342b9ce3fd5f63c05c936f1f948e236d3b71811bcd88daaf79298f82a91e0c2`

The `data-osrs-header="cohesive"` marker scopes the layout and selects the
combined artwork. The original logo, courtyard image, companion sprites and
legacy theme initialization remain available. Modern continues to restore
its original banner and dimensions.

## Rollback

Revert the commit titled **Use the approved cohesive banner with continuous
site pillars**. This restores the previous header, generated pages and asset
versions together. Subsequent snapshot, FAQ and news updates remain intact.

## Verification

- Site unit tests and mobile regression suite.
- Shared page generation and resource checks for all 20 routes and the root.
- Browser layout checks at 320, 360, 390, 412, 700, 701, 850, 910, 950, 951,
  1024, 1280, 1440, 1536, 1920 and 2560 pixels, with native scrollbars.
- 45 browser layout checks passed with no JavaScript page errors.
- 28 left/right pillar strips matched the unobstructed body background exactly,
  including the join immediately below the banner.
- Chronicle and developer headers, scrolling, 200% pixel scale, static
  rendering before JavaScript, home link and Old School/Modern switching.

The theme regression test verifies that the combined banner has one logo and
one set of companions, and that Old School leaves Modern resources deferred.
