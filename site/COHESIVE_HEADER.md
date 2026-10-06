# Cohesive Old School header

The Old School header uses the approved `129773.jpg` artwork as one banner.
An edge mask reveals the existing repeating page pillars in place of the
supplied pillar strips. The same body background continues through the header,
so there is no second painted copy to align or resample. The inner edge fades
into the courtyard; the old rectangular border image is disabled. Status cards
retain their previous content width and stone-frame dimensions.

The banner is 103.5% wide and centred with a −1.75% offset. The narrow edge
fade begins outside the complete stone-and-vine silhouette (47 pixels in
the 910-pixel page background). This fills the former black gap and restores
the side characters without painting over the continuing site pillars.

The supplied artwork is unchanged:

- Asset: `docs/img/osrs-theme/united-gimps-cohesive-banner.jpg`
- Dimensions: 1536 × 512
- SHA-256: `f342b9ce3fd5f63c05c936f1f948e236d3b71811bcd88daaf79298f82a91e0c2`

The `data-osrs-header="cohesive"` marker scopes the layout and selects the
combined artwork. The original logo, courtyard image, companion sprites and
legacy theme initialization remain available. Modern continues to restore
its original banner and dimensions.

## Rollback

To undo the latest refinements, revert **Refine overview cards, collection links
and header alignment**. This restores the previous banner sizing, card content
layout, overview headings and Collection Log controls in one step. The earlier
approved banner remains in place. The Latest item card also returns to its
previous feed logic; its updated version shares Chronicle’s eligibility rules
and repeat-copy labels.

To undo the original combined-banner change as well, revert **Use the approved
cohesive banner with continuous site pillars**. Original artwork and Modern
assets remain available. Snapshot, FAQ and news updates are separate.

## Verification

- Site unit tests and mobile regression suite.
- All six status frames retain identical dimensions at six widths from 390 to
  1920 pixels; only the content spacing and type sizes change.
- Shared page generation and resource checks for all 20 routes and the root.
- Browser layout checks at 320, 360, 390, 412, 700, 701, 850, 910, 950, 951,
  1024, 1280, 1440, 1536, 1920 and 2560 pixels, with native scrollbars.
- 45 browser layout checks passed with no JavaScript page errors.
- 28 left/right strips covering the complete stone-and-vine silhouette matched
  the unobstructed body background exactly, including 12 pixels below the banner.
- Chronicle and developer headers, scrolling, 200% pixel scale, static
  rendering before JavaScript, home link and Old School/Modern switching.

The theme regression test verifies that the combined banner has one logo and
one set of companions, and that Old School leaves Modern resources deferred.
