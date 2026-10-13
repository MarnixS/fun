# Player order and member selection

The approved transparent banner is unchanged, including its colours, faces,
clothing, pets, wordmark, swords and side characters. Its SHA-256 remains
`782b0476ddbe70cb3a72029068153bf0971fd9d4ec273fbf862b71cb2feaeb6a`.

The header uses code to move existing pixels into this order:
Poep Aura, Dikste, Big Dog Aura, Lijpste, Lompste. The red crab moves beside
Poep Aura, the cat beside Dikste, the dog beside Big Dog Aura, the boar beside
Lijpste and the EOC ghost beside Lompste. The wordmark and ten side characters
remain in their original positions. Frame dimensions and the 3:1 aspect ratio
are retained. Modern continues to restore its original banner.

`docs/assets/banner-roster.css` supplies responsive CSS clipping and offsets.
`site/banner-layout.json` records source geometry and translations. Every
opaque source pixel belongs to exactly one layer; local pixel checks found
no lost or mixed opaque pixels. The image file is never cropped or rewritten.
The repeated image elements share one cached resource. Visual asset QA used
composites of the exact artwork over the actual stone material.

`docs/assets/banner-roster.js` applies the existing saved member selection
before the header paints. Selected players and pets have opacity 1;
unselected pairs have opacity 0.22. All five are the default. Invalid or blocked
storage also defaults to all five. Changes, cross-tab updates and cleared
storage update the banner. Metric links may focus one player without replacing
the saved filter; displayed comparison selections also update the banner.

`node scripts/test_banner_roster.js` checks order, pairs, first-paint selection,
default and saved state, selection changes, cross-tab updates, transient
comparison scopes, storage fallback and the unchanged asset hash. Existing
theme tests check Modern restoration. Browser rendering was unavailable in
the managed environment; visual composites and DOM checks provide the local
verification, followed by live publication checks.
